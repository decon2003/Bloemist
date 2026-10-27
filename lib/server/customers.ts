import db from './db'
import { ApiError } from './api-error'

export const CUSTOMER_SOURCES = ['facebook', 'zalo', 'instagram', 'walk_in', 'referral', 'other'] as const

/** Digits only, with the +84 country code folded into a leading 0.
 *  Must match the backfill in prisma/migrations/2_customers. */
export function normalizeCustomerPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits
}

/** Ids of orders whose sender (customer) or receiver phone contains these
 *  digits, however the number was typed (spaces, dots, +84). Phones on orders
 *  are stored as typed, so they are normalised in SQL the way
 *  normalizeCustomerPhone does. The "+84 -> 0" replacement is a parameter
 *  because a backslash is not allowed inside a tagged template. */
export async function orderIdsByPhone(digits: string, field: 'any' | 'receiver' = 'any'): Promise<string[]> {
  const like = `%${digits}%`
  const fold = '0\\1'
  const rows = field === 'receiver'
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Order"
        WHERE regexp_replace(regexp_replace("receiverPhone", '[^0-9]', '', 'g'), '^84([0-9]{9})$', ${fold}) LIKE ${like}
        ORDER BY "createdAt" DESC LIMIT 500`
    : await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Order"
        WHERE regexp_replace(regexp_replace("customerPhone", '[^0-9]', '', 'g'), '^84([0-9]{9})$', ${fold}) LIKE ${like}
           OR regexp_replace(regexp_replace("receiverPhone", '[^0-9]', '', 'g'), '^84([0-9]{9})$', ${fold}) LIKE ${like}
        ORDER BY "createdAt" DESC LIMIT 500`
  return rows.map((r) => r.id)
}

/** Search orders by code, sender/receiver name or phone, or bouquet. Florists
 *  search by code and bouquet only (they don't see names or phones). */
export async function orderSearchWhere(q: string, { matchPhones = true, matchPeople = true } = {}) {
  const digits = normalizeCustomerPhone(q)
  const phoneIds = matchPhones && digits.length >= 4 ? await orderIdsByPhone(digits) : []
  const text = { contains: q, mode: 'insensitive' as const }
  return {
    OR: [
      { code: text },
      ...(matchPeople ? [{ customerName: text }, { receiverName: text }] : []),
      { bouquetName: text },
      ...(phoneIds.length ? [{ id: { in: phoneIds } }] : []),
    ],
  }
}

/** Find or create the customer for an order's phone. The customer's stored
 *  name is not overwritten by later orders - it is curated on the Customers
 *  page - so a typo on one order does not rename the customer. */
export async function linkCustomer(phone: string | null | undefined, name: string | null | undefined) {
  const normalised = normalizeCustomerPhone(phone)
  if (!normalised) return null
  const customer = await db.customer.upsert({
    where: { phone: normalised },
    update: {},
    create: { phone: normalised, name: name?.trim() || normalised },
    select: { id: true },
  })
  return customer.id
}

const REVENUE_EXCLUDED_STATUSES = ['CANCELLED']

type CustomerRow = {
  id: string
  phone: string
  name: string
  notes: string | null
  source: string | null
  marketingConsent: boolean
  createdAt: Date
  orders: { total: number; status: string; createdAt: Date; bouquetName: string }[]
}

const summarise = (customer: CustomerRow) => {
  // Cancelled orders count neither towards spend nor as the last purchase.
  const counted = customer.orders.filter((order) => !REVENUE_EXCLUDED_STATUSES.includes(order.status))
  const latest = counted[0]
  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name,
    notes: customer.notes,
    source: customer.source,
    marketingConsent: customer.marketingConsent,
    createdAt: customer.createdAt.toISOString(),
    orderCount: counted.length,
    totalSpend: counted.reduce((sum, order) => sum + order.total, 0),
    lastOrderAt: latest?.createdAt.toISOString() ?? null,
    lastBouquet: latest?.bouquetName ?? null,
  }
}

const ORDER_SUMMARY_SELECT = {
  orderBy: { createdAt: 'desc' as const },
  select: { total: true, status: true, createdAt: true, bouquetName: true },
}

export type CustomerSort = 'spend' | 'recent' | 'orders'

/** Paged, searchable list. Totals are computed here, not in the browser, so the
 *  page no longer downloads every order ever placed. A shop at ~400 orders a
 *  month has a few thousand customers - aggregating in memory is fine. */
export async function listCustomers({ q, sort, page, pageSize }: { q: string; sort: CustomerSort; page: number; pageSize: number }) {
  const term = q.trim()
  const phoneTerm = normalizeCustomerPhone(term)
  // Also finds the customer through the people they sent flowers to.
  const receiverIds = phoneTerm.length >= 4 ? await orderIdsByPhone(phoneTerm, 'receiver') : []
  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
          { orders: { some: { receiverName: { contains: term, mode: 'insensitive' as const } } } },
          ...(receiverIds.length ? [{ orders: { some: { id: { in: receiverIds } } } }] : []),
        ],
      }
    : {}

  // A customer whose only orders were deleted or moved to another phone is
  // not listed (the record stays and comes back with their next order).
  const rows = await db.customer.findMany({
    where: { AND: [where, { orders: { some: {} } }] },
    include: { orders: ORDER_SUMMARY_SELECT },
  })
  const summaries = rows.map(summarise)
  const key: Record<CustomerSort, (c: ReturnType<typeof summarise>) => number> = {
    spend: (c) => c.totalSpend,
    orders: (c) => c.orderCount,
    recent: (c) => (c.lastOrderAt ? Date.parse(c.lastOrderAt) : 0),
  }
  summaries.sort((a, b) => key[sort](b) - key[sort](a))

  return {
    total: summaries.length,
    page,
    pageSize,
    items: summaries.slice((page - 1) * pageSize, page * pageSize),
  }
}

/** For the new-order form: who is this phone number, and who did they send
 *  flowers to before? */
export async function lookupCustomer(phone: string) {
  const normalised = normalizeCustomerPhone(phone)
  if (normalised.length < 9) return null

  const customer = await db.customer.findUnique({
    where: { phone: normalised },
    include: { orders: ORDER_SUMMARY_SELECT },
  })
  if (!customer) return null

  const recent = await db.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { receiverName: true, receiverPhone: true, deliveryAddress: true },
  })
  const seen = new Set<string>()
  const recentReceivers = recent.filter((r) => {
    const key = `${r.receiverName}|${r.receiverPhone}|${r.deliveryAddress ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)

  return { ...summarise(customer), recentReceivers }
}

/** One customer's page: totals, everyone they sent flowers to, and every order. */
export async function getCustomer(id: string) {
  const customer = await db.customer.findUnique({ where: { id }, include: { orders: ORDER_SUMMARY_SELECT } })
  if (!customer) throw new ApiError(404, 'Không tìm thấy khách hàng')

  const orders = await db.order.findMany({
    where: { customerId: id },
    orderBy: { receiveTime: 'desc' },
    select: {
      id: true, code: true, receiveTime: true, createdAt: true, status: true, total: true, bouquetName: true,
      receiverName: true, receiverPhone: true, deliveryType: true, deliveryAddress: true, salespersonName: true,
    },
  })

  // People they sent flowers to, most frequent first.
  const receivers = new Map<string, { receiverName: string; receiverPhone: string; deliveryAddress: string | null; count: number; lastAt: string }>()
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue
    const key = `${o.receiverName.trim().toLowerCase()}|${normalizeCustomerPhone(o.receiverPhone)}`
    const existing = receivers.get(key)
    if (existing) existing.count += 1
    else receivers.set(key, { receiverName: o.receiverName, receiverPhone: o.receiverPhone, deliveryAddress: o.deliveryAddress, count: 1, lastAt: o.receiveTime.toISOString() })
  }
  const counted = orders.filter((o) => o.status !== 'CANCELLED')

  return {
    ...summarise(customer),
    // Both by receive day, so first and latest read the same way.
    firstOrderAt: counted.length ? counted[counted.length - 1].receiveTime.toISOString() : null,
    lastOrderAt: counted.length ? counted[0].receiveTime.toISOString() : null,
    lastBouquet: counted[0]?.bouquetName ?? null,
    receivers: [...receivers.values()].sort((a, b) => b.count - a.count),
    orders: orders.map((o) => ({ ...o, receiveTime: o.receiveTime.toISOString(), createdAt: o.createdAt.toISOString() })),
  }
}

/** True when the phone belongs to no customer with a non-cancelled order yet. */
export async function isNewCustomer(customerId: string | null) {
  if (!customerId) return true
  const previous = await db.order.count({ where: { customerId, status: { notIn: REVENUE_EXCLUDED_STATUSES } } })
  return previous === 0
}

export async function updateCustomer(id: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) throw new ApiError(400, 'Tên khách không được để trống')
    data.name = body.name.trim().slice(0, 120)
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') throw new ApiError(400, 'Ghi chú không hợp lệ')
    data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null
  }
  if (body.source !== undefined) {
    if (body.source !== null && !CUSTOMER_SOURCES.includes(body.source as never)) {
      throw new ApiError(400, `Nguồn khách không hợp lệ. Chọn một trong: ${CUSTOMER_SOURCES.join(', ')}`)
    }
    data.source = body.source
  }
  if (body.marketingConsent !== undefined) {
    if (typeof body.marketingConsent !== 'boolean') throw new ApiError(400, 'Đồng ý nhận tin không hợp lệ')
    data.marketingConsent = body.marketingConsent
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, 'Không có gì để cập nhật')

  const updated = await db.customer.update({ where: { id }, data, include: { orders: ORDER_SUMMARY_SELECT } })
  return summarise(updated)
}
