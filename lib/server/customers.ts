import db from './db'
import { ApiError } from './api-error'

export const CUSTOMER_SOURCES = ['facebook', 'zalo', 'instagram', 'walk_in', 'referral', 'other'] as const

/** Digits only, with the +84 country code folded into a leading 0.
 *  Must match the backfill in prisma/migrations/2_customers. */
export function normalizeCustomerPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits
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
  const counted = customer.orders.filter((order) => !REVENUE_EXCLUDED_STATUSES.includes(order.status))
  const latest = customer.orders[0]
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
  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          ...(phoneTerm ? [{ phone: { contains: phoneTerm } }] : []),
        ],
      }
    : {}

  const rows = await db.customer.findMany({ where, include: { orders: ORDER_SUMMARY_SELECT } })
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
    if (typeof body.marketingConsent !== 'boolean') throw new ApiError(400, 'marketingConsent must be true or false')
    data.marketingConsent = body.marketingConsent
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, 'No updatable fields supplied')

  const updated = await db.customer.update({ where: { id }, data, include: { orders: ORDER_SUMMARY_SELECT } })
  return summarise(updated)
}
