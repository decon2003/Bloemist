import db from './db'
import type {
  AssignTaskPayload,
  CompleteTaskPayload,
} from '../api.types'
import type { CreateOrderInput, CreateTaskInput, Florist, Order, Task, TaskStatus, StaffCheckIn } from '../types'

import { ApiError } from './api-error'
import { storePhoto } from './storage'
import { assertPayrollOpen } from './payroll'
import { computeOrderTotals, parseCurrencyToNumber, toVatPercent, toVnd, type OrderMoneyInput } from './money'
import { addVnDays, startOfVnMonth, vnDateKey } from './vn-time'
import { LIST_LIMIT, SEARCH_LIMIT, type ListScope } from './list-scope'
import type { Prisma } from '@prisma/client'
import { isNewCustomer, linkCustomer, normalizeCustomerPhone, orderSearchWhere } from './customers'
import { ORDER_STATUSES, TASK_STATUSES, assertOneOf } from './validation'

const DELIVERY_TYPES = ['DELIVERY', 'PICKUP'] as const

// Helper to map Prisma entity to App entity
// Most fields match exactly due to camelCase in schema
const mapOrder = (o: any): Order => ({
  ...o,
  // Ensure types match what UI expects
  deliveryCoveredByShop: o.deliveryCoveredByShop ?? false,
  new_customer: o.new_customer ?? false,
  receiveTime: o.receiveTime.toISOString(),
  createdAt: o.createdAt.toISOString(),
})

const mapTask = (t: any): Task => ({
  ...t,
  samplePhotoUrls: t.samplePhotoUrls ? JSON.parse(t.samplePhotoUrls) : [],
  dueTime: t.dueTime.toISOString(),
  startTime: t.startTime?.toISOString() ?? null,
  completedAt: t.completedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
  lastAssignedAt: t.lastAssignedAt?.toISOString() ?? null,
  // Joined fields from simple include
  customerName: t.order?.customerName ?? 'Unknown',
  deliveryType: t.order?.deliveryType ?? 'PICKUP',
  deliveryTime: t.order?.receiveTime?.toISOString() ?? '',
})

export const mapCheckIn = (c: any): StaffCheckIn => ({
  ...c,
  timestamp: c.timestamp.toISOString(),
  checkInAt: c.checkInAt?.toISOString() ?? undefined,
  checkOutAt: c.checkOutAt?.toISOString() ?? undefined,
  coordinates: { lat: c.lat, lng: c.lng },
})

const mapUser = (u: any) => ({
  ...u,
  createdAt: u.createdAt.toISOString(),
})

const DATE_FIELD_LABELS: Record<string, string> = { receiveTime: 'ngày giờ nhận', dueTime: 'hạn làm' }

const parseRequiredDate = (value: string | Date, field: string) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Vui lòng chọn ${DATE_FIELD_LABELS[field] ?? field}`)
  }
  return date
}

// Florists work from the bouquet and the deadline; they never need the
// customer's or receiver's phone number, so it is not sent to them at all
// (the UI already hid it, but the API used to return it to everyone).
export const redactOrderFor = <T extends { customerPhone?: string; receiverPhone?: string }>(
  viewer: { role: string },
  order: T,
): T => (viewer.role === 'florist' ? { ...order, customerPhone: '', receiverPhone: '' } : order)

// Photos saved before object storage existed are base64 data URLs inside the
// row. Sending them in list responses blew through Vercel's 4.5 MB response
// limit after a handful of photos, so lists point at /api/legacy-photos instead.
const isInline = (value: string | null | undefined): value is string => !!value && value.startsWith('data:')
const legacyTaskPhoto = (id: string, field: string, index?: number) =>
  `/api/legacy-photos?task=${encodeURIComponent(id)}&field=${field}${index === undefined ? '' : `&i=${index}`}`

const slimTaskPhotos = (task: Task, { samples }: { samples: boolean }): Task => ({
  ...task,
  completionProofUrl: isInline(task.completionProofUrl) ? legacyTaskPhoto(task.id, 'proof') : task.completionProofUrl,
  // Detail views send samples and bouquetImage back on save, so they keep the
  // real values there; only lists swap them for links.
  ...(samples
    ? {
        bouquetImage: isInline(task.bouquetImage) ? legacyTaskPhoto(task.id, 'bouquet') : task.bouquetImage,
        samplePhotoUrls: (task.samplePhotoUrls ?? []).map((url, index) =>
          isInline(url) ? legacyTaskPhoto(task.id, 'sample', index) : url,
        ),
      }
    : {}),
})

const slimOrderPhotos = <T extends { id: string; bouquetImage?: string | null }>(order: T): T =>
  isInline(order.bouquetImage)
    ? { ...order, bouquetImage: `/api/legacy-photos?order=${encodeURIComponent(order.id)}&field=bouquet` }
    : order

type ListViewer = { id: string; role: string }

/** Tasks due in a Vietnam-day window, matching a search, or belonging to one
 *  order. Never the whole table - see lib/server/list-scope.ts. */
export const listTasks = async (
  scope: ListScope | { kind: 'order'; orderId: string },
  options: { assigneeId?: string; viewerRole?: string } = {},
) => {
  const where: Prisma.TaskWhereInput = {}
  if (scope.kind === 'order') {
    where.orderId = scope.orderId
  } else if (scope.kind === 'range') {
    where.dueTime = { gte: scope.start, lt: scope.end }
  } else {
    where.OR = [
      { taskTitle: { contains: scope.q, mode: 'insensitive' } },
      { bouquetName: { contains: scope.q, mode: 'insensitive' } },
      { orderCode: { contains: scope.q, mode: 'insensitive' } },
      // Florists never see phone numbers, so they don't search by them either.
      { order: await orderSearchWhere(scope.q, { matchPhones: options.viewerRole !== 'florist' }) },
    ]
    if (scope.since) where.dueTime = { gte: scope.since }
  }
  if (options.assigneeId) where.assigneeId = options.assigneeId

  const tasks = await db.task.findMany({
    where,
    orderBy: scope.kind === 'search' ? { dueTime: 'desc' } : { dueTime: 'asc' },
    take: scope.kind === 'search' ? SEARCH_LIMIT : LIST_LIMIT,
    include: {
      order: {
        select: {
          customerName: true,
          receiverName: true,
          deliveryType: true,
          receiveTime: true,
        }
      }
    }
  })
  return tasks.map((task) => slimTaskPhotos(mapTask(task), { samples: true }))
}

export const getTask = async (taskId: string) => {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      order: {
        select: {
          customerName: true,
          deliveryType: true,
          receiveTime: true,
        }
      }
    }
  })
  if (!task) throw new ApiError(404, 'Task not found')
  return slimTaskPhotos(mapTask(task), { samples: false })
}

/** Orders not yet delivered or cancelled: overdue ones stay in today's list. */
const OPEN_ORDER_STATUSES = ['NEW', 'IN_PROGRESS', 'READY'] as const

export type OrderListFilters = {
  assigneeId?: string | null
  salespersonId?: string | null
  status?: string | null
}

/** Where-clause for the Orders list. `withOverdue`: a window
 *  that includes today also carries unfinished orders whose receive day has
 *  passed, so they never drop out of sight. */
const orderListWhere = async (
  scope: ListScope,
  viewer: ListViewer,
  filters: OrderListFilters,
  { withOverdue }: { withOverdue: boolean },
) => {
  const where: Prisma.OrderWhereInput = {}
  const and: Prisma.OrderWhereInput[] = []
  if (filters.assigneeId === 'none') {
    and.push({ assigneeId: null, tasks: { none: { assigneeId: { not: null } } } })
  } else if (filters.assigneeId) {
    and.push({ OR: [{ assigneeId: filters.assigneeId }, { tasks: { some: { assigneeId: filters.assigneeId } } }] })
  }
  if (filters.salespersonId) where.salespersonId = filters.salespersonId === 'none' ? null : filters.salespersonId
  if (filters.status) where.status = filters.status
  if (scope.kind === 'range') {
    const window = { receiveTime: { gte: scope.start, lt: scope.end } }
    const now = new Date()
    where.OR = withOverdue && scope.start <= now && now < scope.end
      ? [window, { status: { in: [...OPEN_ORDER_STATUSES] }, receiveTime: { lt: scope.start } }]
      : [window]
  } else {
    Object.assign(where, await orderSearchWhere(scope.q, { matchPhones: viewer.role !== 'florist' }))
    // Staff history limit; their unfinished orders stay findable.
    if (scope.since) {
      and.push({ OR: [{ receiveTime: { gte: scope.since } }, { status: { in: [...OPEN_ORDER_STATUSES] } }] })
    }
  }
  if (and.length) where.AND = and
  return where
}

/** Orders received in a Vietnam-day window or matching a search, optionally
 *  narrowed to one person in charge / salesperson ('none' = not set) or a
 *  status. Every staff member sees every order (florists without phone numbers). */
export const listOrders = async (scope: ListScope, viewer: ListViewer, filters: OrderListFilters = {}) => {
  const where = await orderListWhere(scope, viewer, filters, { withOverdue: true })
  const orders = await db.order.findMany({
    where,
    orderBy: scope.kind === 'search' ? { createdAt: 'desc' } : [{ receiveTime: 'asc' }, { code: 'asc' }],
    take: Math.min(scope.limit ?? LIST_LIMIT, scope.kind === 'search' ? SEARCH_LIMIT : LIST_LIMIT),
  })
  return orders.map(o => slimOrderPhotos({
    ...mapOrder(o),
    receiveTime: o.receiveTime.toISOString()
  }))
}

export const getOrder = async (orderId: string) => {
  const order = await db.order.findUnique({
    where: { id: orderId }
  })
  if (!order) throw new ApiError(404, 'Order not found')
  return {
    ...mapOrder(order),
    receiveTime: order.receiveTime.toISOString()
  }
}

export const listFlorists = async () => {
  const users = await db.user.findMany({
    where: {
      role: 'florist',
      status: 'active'
    },
    select: { id: true, name: true }
  })
  return users
}

/** Next readable order code for today (Vietnam time): "DDMMYY-NNN", e.g.
 *  "211026-047" = the 47th order of 21 Oct 2026. The counter row is created or
 *  incremented in one statement, so concurrent orders get distinct numbers. */
export const nextOrderCode = async (now = new Date()) => {
  const day = vnDateKey(now)
  const [{ value }] = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO "OrderCounter" ("day", "value") VALUES (${day}, 1)
    ON CONFLICT ("day") DO UPDATE SET "value" = "OrderCounter"."value" + 1
    RETURNING "value"`
  const [year, month, date] = day.split('-')
  return `${date}${month}${year.slice(2)}-${String(value).padStart(3, '0')}`
}

/** A stored photo value: our own photo links, an inline image (only when R2 is
 *  not configured) or an https link kept from older orders. Anything else -
 *  notably a pasted "data:text/html" - is refused. */
const isPhotoValue = (value: string) =>
  value.startsWith('/api/photos/') ||
  value.startsWith('/api/legacy-photos?') ||
  /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/i.test(value) ||
  /^https:\/\//i.test(value)

const readPhoto = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !isPhotoValue(value)) throw new ApiError(400, 'Ảnh không hợp lệ, hãy tải ảnh lên lại')
  return value
}

const readPhotoList = (value: unknown): string[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ApiError(400, 'Ảnh mẫu không hợp lệ')
  return value.map((item) => readPhoto(item)).filter((item): item is string => item !== null)
}

type ProductInput = { name: string; quantity: number; note: string; samplePhotoUrls: string[]; image: string | null; lineTotal: number }

/** Validate the order's product lines. Each line becomes one task, and its
 *  price (unit price x quantity) is what the maker earns commission on. */
const readProducts = (value: unknown): ProductInput[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ApiError(400, 'products must be a list')
  return value.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const label = `Sản phẩm ${index + 1}`
    if (typeof item.name !== 'string' || !item.name.trim()) throw new ApiError(400, `${label}: thiếu tên`)
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, `${label}: số lượng không hợp lệ`)
    const unitPrice = toVnd(item.unitPrice, `${label}: đơn giá`, { required: true })!
    const photos = readPhotoList(item.samplePhotoUrls)
    return {
      name: item.name.trim().slice(0, 300),
      quantity,
      note: typeof item.note === 'string' ? item.note.trim() : '',
      samplePhotoUrls: photos,
      image: readPhoto(item.image) ?? photos[0] ?? null,
      lineTotal: unitPrice * quantity,
    }
  })
}

/** The staff member credited with the sale (any staff member - whoever
 *  brought the order in). They earn the order's sales commission. */
const readSalesperson = async (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new ApiError(400, 'Vui lòng chọn người sale')
  const user = await db.user.findUnique({ where: { id: value }, select: { id: true, name: true } })
  if (!user) throw new ApiError(400, 'Người sale không tồn tại')
  return { salespersonId: user.id, salespersonName: user.name }
}

/** Create an order and, when product lines are given, one task per product in
 *  the same transaction - the browser used to create tasks one request at a
 *  time, so a dropped connection left orders with missing products. With
 *  product lines the listed price is their sum. */
export const createOrder = async (input: CreateOrderInput) => {
  // A retried "Tạo đơn" (the reply was lost on a weak connection) carries the
  // same requestId: hand back the order the first attempt created.
  const requestId = typeof input.requestId === 'string' && input.requestId ? input.requestId.slice(0, 100) : null
  if (requestId) {
    const existing = await db.order.findUnique({ where: { requestId } })
    if (existing) return mapOrder(existing)
  }
  const products = readProducts(input.products)
  const deliveryType = assertOneOf(input.deliveryType ?? 'PICKUP', DELIVERY_TYPES, 'deliveryType')
  const status = input.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NEW'
  // Defaults to whoever creates the order.
  const salesperson = input.salespersonId
    ? await readSalesperson(input.salespersonId)
    : { salespersonId: input.createdById ?? null, salespersonName: input.createdByName ?? null }
  const receiveTime = parseRequiredDate(input.receiveTime, 'receiveTime')
  const money = readOrderMoney(
    products.length ? { ...input, listedPrice: products.reduce((sum, p) => sum + p.lineTotal, 0) } : input,
  )

  // Codes are always assigned here; a client-supplied code could collide or mislead.
  const code = await nextOrderCode()
  const customerId = await linkCustomer(input.customerPhone, input.customerName)
  // Decided here, not by the form: a slow phone lookup used to mark repeat
  // customers as new.
  const newCustomer = customerId ? await isNewCustomer(customerId) : false
  // Customers often give only part of the details; blanks are filled in later.
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        code,
        requestId,
        customerId,
        customerName: text(input.customerName),
        customerPhone: text(input.customerPhone),
        receiverName: text(input.receiverName),
        receiverPhone: text(input.receiverPhone),
        bouquetName: input.bouquetName,
        bouquetImage: readPhoto(input.bouquetImage),
        receiveTime,
        deliveryType,
        deliveryAddress: deliveryType === 'DELIVERY' ? text(input.deliveryAddress) || null : null,
        status,
        ...money,
        ...computeOrderTotals(money),
        notes: input.notes,
        createdById: input.createdById,
        createdByName: input.createdByName,
        assigneeId: input.assigneeId,
        assigneeName: input.assigneeName,
        new_customer: newCustomer,
        ...salesperson,
      },
    })
    // Tasks are due two hours before the customer receives the order. A florist
    // chosen on the order is the maker of its products.
    const dueTime = new Date(receiveTime.getTime() - 2 * 60 * 60 * 1000)
    for (const product of products) {
      await tx.task.create({
        data: {
          orderId: created.id,
          orderCode: created.code,
          bouquetName: product.name,
          bouquetImage: product.image,
          taskTitle: `${product.quantity} × ${product.name}`,
          samplePhotoUrls: JSON.stringify(product.samplePhotoUrls),
          status: input.assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
          assigneeId: input.assigneeId || null,
          assigneeName: input.assigneeId ? input.assigneeName ?? null : null,
          dueTime,
          notes: [product.note, input.notes].filter(Boolean).join('\n'),
          type: 'CAM_HOA',
          quantity: product.quantity,
          price: product.lineTotal,
        },
      })
    }
    return created
  }).catch(async (error) => {
    // Two copies of the same request racing: the loser returns the winner's order.
    if (requestId && error?.code === 'P2002') {
      const existing = await db.order.findUnique({ where: { requestId } })
      if (existing) return existing
    }
    throw error
  })

  return mapOrder(order)
}

// Only these columns may be written by an update. Anything else in the request
// body is ignored - notably id, code and createdAt, which the dashboard groups
// revenue by and which callers must never be able to rewrite.
const ORDER_UPDATABLE_FIELDS = [
  'customerName', 'customerPhone', 'receiverName', 'receiverPhone',
  'deliveryAddress', 'bouquetName', 'bouquetImage', 'deliveryType', 'status',
  'notes', 'assigneeId', 'assigneeName', 'new_customer',
] as const

// Price inputs; sellingPrice, total and remainingBalance are always derived.
const ORDER_MONEY_FIELDS = ['listedPrice', 'deliveryFee', 'deliveryCoveredByShop', 'vatPercent', 'deposit'] as const

/** Validated price inputs as whole VND. `fallback` supplies the stored values
 *  for fields an update leaves out. */
const readOrderMoney = (input: Partial<CreateOrderInput>, fallback?: OrderMoneyInput): OrderMoneyInput => {
  const pick = <K extends keyof OrderMoneyInput>(key: K, read: () => OrderMoneyInput[K]) =>
    input[key] !== undefined ? read() : fallback ? fallback[key] : read()
  return {
    listedPrice: pick('listedPrice', () => toVnd(input.listedPrice, 'listedPrice', { required: true })!),
    deliveryFee: pick('deliveryFee', () => toVnd(input.deliveryFee, 'deliveryFee')),
    deliveryCoveredByShop: pick('deliveryCoveredByShop', () => input.deliveryCoveredByShop === true),
    vatPercent: pick('vatPercent', () => toVatPercent(input.vatPercent)),
    deposit: pick('deposit', () => toVnd(input.deposit, 'deposit')),
  }
}

export const updateOrder = async (orderId: string, input: Partial<CreateOrderInput>) => {
  const data: any = {}
  for (const field of ORDER_UPDATABLE_FIELDS) {
    if (input[field] !== undefined) data[field] = input[field]
  }
  if (data.status !== undefined) assertOneOf(data.status, ORDER_STATUSES, 'status')
  if (data.deliveryType !== undefined) assertOneOf(data.deliveryType, DELIVERY_TYPES, 'deliveryType')
  if (data.bouquetImage !== undefined) data.bouquetImage = readPhoto(data.bouquetImage)

  // A new receive time moves the due time of the products not yet made by the
  // same amount, so they show up on the right day for the florists.
  let dueShiftMs = 0
  if (input.receiveTime !== undefined) {
    data.receiveTime = parseRequiredDate(input.receiveTime, 'receiveTime')
    const current = await db.order.findUnique({ where: { id: orderId }, select: { receiveTime: true } })
    if (!current) throw new ApiError(404, 'Không tìm thấy đơn hàng')
    dueShiftMs = data.receiveTime.getTime() - current.receiveTime.getTime()
  }

  if (input.salespersonId !== undefined) Object.assign(data, await readSalesperson(input.salespersonId))

  // Changing any price input recomputes the derived amounts from the merged values.
  if (ORDER_MONEY_FIELDS.some((field) => input[field] !== undefined)) {
    const current = await db.order.findUnique({ where: { id: orderId } })
    if (!current) throw new ApiError(404, 'Order not found')
    const money = readOrderMoney(input, {
      listedPrice: current.listedPrice,
      deliveryFee: current.deliveryFee,
      deliveryCoveredByShop: current.deliveryCoveredByShop ?? false,
      vatPercent: current.vatPercent,
      deposit: current.deposit,
    })
    Object.assign(data, money, computeOrderTotals(money))
  }

  // A corrected phone number moves the order to the right customer.
  if (input.customerPhone !== undefined) {
    const current = await db.order.findUnique({ where: { id: orderId }, select: { customerPhone: true, customerName: true } })
    if (current && normalizeCustomerPhone(current.customerPhone) !== normalizeCustomerPhone(input.customerPhone)) {
      data.customerId = await linkCustomer(input.customerPhone, input.customerName ?? current.customerName)
    }
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, 'No updatable fields supplied')
  }

  const order = await db.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: orderId }, data })
    if (dueShiftMs !== 0) {
      const open = await tx.task.findMany({
        where: { orderId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, dueTime: true },
      })
      for (const task of open) {
        await tx.task.update({ where: { id: task.id }, data: { dueTime: new Date(task.dueTime.getTime() + dueShiftMs) } })
      }
    }
    return updated
  })
  return mapOrder(order)
}

/** Cancelling an order cancels its products not yet made, so florists stop
 *  on them; restoring it puts those products back in the queue. Products
 *  already made stay completed (cancelled orders earn no commission). */
export const syncTasksWithOrderStatus = async (orderId: string, previous: string, next: string) => {
  if (next === 'CANCELLED' && previous !== 'CANCELLED') {
    await db.task.updateMany({ where: { orderId, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, data: { status: 'CANCELLED' } })
  } else if (previous === 'CANCELLED' && next !== 'CANCELLED') {
    await db.task.updateMany({ where: { orderId, status: 'CANCELLED', assigneeId: null }, data: { status: 'UNASSIGNED' } })
    await db.task.updateMany({ where: { orderId, status: 'CANCELLED', assigneeId: { not: null } }, data: { status: 'ASSIGNED' } })
  }
}

export const deleteOrder = async (orderId: string) => {
  // Manual cascade delete
  await db.task.deleteMany({ where: { orderId } })

  try {
    await db.order.delete({ where: { id: orderId } })
  } catch (e) {
    throw new ApiError(404, 'Order not found')
  }
}

export const createTask = async (input: CreateTaskInput) => {
  let linkedOrder: Order | undefined
  if (input.orderId) {
    const o = await db.order.findUnique({ where: { id: input.orderId } })
    if (!o) throw new ApiError(404, 'Không tìm thấy đơn hàng')
    if (o.status === 'CANCELLED') throw new ApiError(409, 'Đơn đã huỷ, không thêm sản phẩm được')
    linkedOrder = mapOrder(o)
  }
  const maker = input.assigneeId ? await readAssignee(input.assigneeId) : null
  const dueTime = input.dueTime
    ? parseRequiredDate(input.dueTime, 'dueTime')
    : linkedOrder
      ? new Date(new Date(linkedOrder.receiveTime).getTime() - 2 * 60 * 60 * 1000)
      : parseRequiredDate('', 'dueTime')

  const taskTitle = (typeof input.taskTitle === 'string' && input.taskTitle.trim()) ||
    input.bouquetName || linkedOrder?.bouquetName || 'Sản phẩm'

  const task = await db.task.create({
    data: {
      orderId: input.orderId,
      orderCode: linkedOrder?.code,
      bouquetName: input.bouquetName || linkedOrder?.bouquetName || 'Sản phẩm',
      bouquetImage: readPhoto(input.bouquetImage) ?? linkedOrder?.bouquetImage,
      taskTitle,
      samplePhotoUrls: JSON.stringify(
        input.samplePhotoUrls !== undefined
          ? readPhotoList(input.samplePhotoUrls)
          : input.bouquetImage ? [readPhoto(input.bouquetImage)] : linkedOrder?.bouquetImage ? [linkedOrder.bouquetImage] : [],
      ),
      status: maker ? 'ASSIGNED' : 'UNASSIGNED',
      dueTime,
      startTime: null,
      notes: input.notes || '',
      type: input.type || 'CAM_HOA',
      quantity: input.quantity ?? 1,
      price: toVnd(input.price, 'price'),
      assigneeId: maker?.id ?? null,
      assigneeName: maker?.name ?? null,
    }
  })

  return getTask(task.id)
}

type TaskActor = { id: string; name: string; role: string }
const isManagerRole = (role: string) => role === 'boss' || role === 'admin'
/** Sales and managers run orders: they assign, edit and complete on someone's behalf. */
const canManageTasks = (role: string) => isManagerRole(role) || role === 'sales'

const loadTask = async (taskId: string) => {
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) throw new ApiError(404, 'Không tìm thấy sản phẩm')
  return task
}

const assertNotCancelled = (task: { status: string }) => {
  if (task.status === 'CANCELLED') throw new ApiError(409, 'Sản phẩm này đã huỷ (đơn bị huỷ hoặc quản lý đã huỷ).')
}

/** The maker, read from the account (never a name sent by the browser). */
const readAssignee = async (userId: unknown) => {
  if (typeof userId !== 'string' || !userId) throw new ApiError(400, 'Chọn người làm')
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, status: true } })
  if (!user || user.status !== 'active') throw new ApiError(400, 'Người làm không tồn tại hoặc đã nghỉ việc')
  return user
}

/** An order without a person in charge takes the first maker of its products. */
const setOrderAssigneeIfEmpty = async (orderId: string | null, user: { id: string; name: string | null }) => {
  if (!orderId) return
  await db.order.updateMany({ where: { id: orderId, assigneeId: null }, data: { assigneeId: user.id, assigneeName: user.name } })
}

/** Order status follows its products: every product made -> "Sẵn sàng"; a
 *  product reopened -> back to "Đang xử lý"; work started on a new order ->
 *  "Đang xử lý". Delivered and cancelled orders are left alone. Returns the
 *  change, if any, for the audit log. */
export const syncOrderStatusWithTasks = async (orderId: string | null) => {
  if (!orderId) return null
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, code: true, tasks: { select: { status: true } } } })
  if (!order || order.status === 'DELIVERED' || order.status === 'CANCELLED') return null
  const live = order.tasks.filter((t) => t.status !== 'CANCELLED')
  const allDone = live.length > 0 && live.every((t) => t.status === 'COMPLETED')
  const started = live.some((t) => t.status === 'COMPLETED' || t.status === 'IN_PROGRESS')
  const next = allDone ? 'READY' : order.status === 'READY' || (order.status === 'NEW' && started) ? 'IN_PROGRESS' : order.status
  if (next === order.status) return null
  await db.order.update({ where: { id: orderId }, data: { status: next } })
  return { code: order.code, from: order.status, to: next }
}

/** Edit a task's details. Florists may only change notes; sales and managers
 *  the rest. Status changes go through updateTaskStatus and assignment through
 *  assignTask/unassignTask; completion through completeTask (with a photo). */
export const updateTask = async (taskId: string, input: Partial<CreateTaskInput>, actor: TaskActor) => {
  const task = await loadTask(taskId)
  if (!canManageTasks(actor.role)) {
    const others = Object.entries(input).filter(([key, value]) => value !== undefined && key !== 'notes')
    if (others.length) throw new ApiError(403, 'Thợ chỉ sửa được ghi chú của sản phẩm')
  }
  const data: Prisma.TaskUpdateInput = {}

  if (input.taskTitle !== undefined) {
    if (typeof input.taskTitle !== 'string' || !input.taskTitle.trim()) throw new ApiError(400, 'Vui lòng nhập tên sản phẩm')
    data.taskTitle = input.taskTitle.trim().slice(0, 300)
  }
  if (input.bouquetName !== undefined) data.bouquetName = String(input.bouquetName).slice(0, 300)
  if (input.bouquetImage !== undefined) data.bouquetImage = readPhoto(input.bouquetImage)
  if (input.notes !== undefined) data.notes = typeof input.notes === 'string' ? input.notes : ''
  if (input.type !== undefined) data.type = String(input.type)
  if (input.quantity !== undefined) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new ApiError(400, 'Số lượng phải là số nguyên dương')
    data.quantity = input.quantity
  }
  if (input.price !== undefined) {
    // The price is the maker's commission base: frozen once it is in a locked payroll.
    if (task.status === 'COMPLETED') await assertPayrollOpen(task.completedAt ?? new Date(), 'Sản phẩm này')
    data.price = toVnd(input.price, 'price')
  }
  if (input.dueTime !== undefined) data.dueTime = parseRequiredDate(input.dueTime, 'dueTime')
  if (input.samplePhotoUrls !== undefined) data.samplePhotoUrls = JSON.stringify(readPhotoList(input.samplePhotoUrls))

  if (Object.keys(data).length > 0) {
    await db.task.update({ where: { id: taskId }, data })
  }
  if (input.status !== undefined) {
    return updateTaskStatus(taskId, input.status, actor)
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, 'Không có gì để lưu')
  return getTask(taskId)
}

export const updateTaskStatus = async (taskId: string, status: TaskStatus, actor: TaskActor) => {
  // `status` is a bare String column, so any value at all used to be persisted.
  const nextStatus = assertOneOf(status, TASK_STATUSES, 'status')
  const current = await loadTask(taskId)
  if (nextStatus === current.status) return getTask(taskId)

  // Completion needs the proof photo, so it only goes through completeTask().
  if (nextStatus === 'COMPLETED') throw new ApiError(400, 'Hoàn tất sản phẩm bằng nút "Hoàn tất" (kèm ảnh thành phẩm)')
  if (nextStatus === 'CANCELLED' && !isManagerRole(actor.role)) throw new ApiError(403, 'Chỉ quản lý được huỷ sản phẩm')
  if (current.status === 'CANCELLED' && !isManagerRole(actor.role)) assertNotCancelled(current)
  if (current.status === 'COMPLETED') {
    // Reopening moves the making commission to another month; never for pay already locked.
    if (!isManagerRole(actor.role)) throw new ApiError(403, 'Sản phẩm đã hoàn tất. Chỉ quản lý được mở lại.')
    await assertPayrollOpen(current.completedAt ?? new Date(), 'Sản phẩm này')
  }
  if (current.assigneeId !== actor.id && !canManageTasks(actor.role)) {
    throw new ApiError(403, 'Bạn chỉ đổi được trạng thái sản phẩm của mình')
  }

  const data: Prisma.TaskUpdateInput = { status: nextStatus }
  if (nextStatus === 'IN_PROGRESS' && !current.startTime) data.startTime = new Date()
  // Moving a task back out of COMPLETED clears the completion evidence.
  if (current.status === 'COMPLETED') {
    data.completedAt = null
    data.completionProofUrl = null
  }
  await db.task.update({ where: { id: taskId }, data })
  return getTask(taskId)
}

export const updateTaskNotes = async (taskId: string, notes: string) => {
  if (typeof notes !== 'string') throw new ApiError(400, 'Ghi chú không hợp lệ')
  await loadTask(taskId)
  await db.task.update({ where: { id: taskId }, data: { notes } })
  return getTask(taskId)
}

/** Give a product to a maker. Florists may only take an unassigned product for
 *  themselves (first come, first served); sales and managers assign anyone.
 *  A finished product changes maker only by a manager, since its commission
 *  moves with it. */
export const assignTask = async (taskId: string, payload: { userId?: unknown }, actor: TaskActor) => {
  const task = await loadTask(taskId)
  assertNotCancelled(task)
  const assignee = await readAssignee(payload?.userId)

  if (!canManageTasks(actor.role)) {
    if (assignee.id !== actor.id) throw new ApiError(403, 'Bạn chỉ nhận được sản phẩm cho chính mình')
    const { count } = await db.task.updateMany({
      where: { id: taskId, assigneeId: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: { assigneeId: assignee.id, assigneeName: assignee.name, status: 'ASSIGNED' },
    })
    if (count === 0) throw new ApiError(409, 'Sản phẩm này đã có người nhận')
    await setOrderAssigneeIfEmpty(task.orderId, assignee)
    return getTask(taskId)
  }

  if (task.status === 'COMPLETED') {
    if (!isManagerRole(actor.role)) throw new ApiError(403, 'Sản phẩm đã hoàn tất. Chỉ quản lý được đổi người làm (hoa hồng chuyển theo).')
    await assertPayrollOpen(task.completedAt ?? new Date(), 'Sản phẩm này')
  }
  await db.task.update({
    where: { id: taskId },
    data: { assigneeId: assignee.id, assigneeName: assignee.name, status: task.status === 'UNASSIGNED' ? 'ASSIGNED' : task.status },
  })
  await setOrderAssigneeIfEmpty(task.orderId, assignee)
  return getTask(taskId)
}

export const unassignTask = async (taskId: string, actor: TaskActor) => {
  const task = await loadTask(taskId)
  assertNotCancelled(task)
  // A finished product keeps its maker (and the commission) unless a manager changes it.
  if (task.status === 'COMPLETED') throw new ApiError(409, 'Sản phẩm đã hoàn tất, không bỏ nhận được')
  if (!task.assigneeId) throw new ApiError(409, 'Sản phẩm chưa có người làm')
  if (task.assigneeId !== actor.id && !canManageTasks(actor.role)) throw new ApiError(403, 'Bạn chỉ bỏ nhận được sản phẩm của mình')

  await db.task.update({
    where: { id: taskId },
    data: {
      lastAssigneeName: task.assigneeName || task.lastAssigneeName,
      lastAssignedAt: new Date(),
      assigneeId: null,
      assigneeName: null,
      status: 'UNASSIGNED',
      startTime: null,
    },
  })
  return getTask(taskId)
}

/** Mark a product made, with a photo of the result. The maker is its assignee;
 *  a florist finishing an unassigned product becomes its maker. Sales and
 *  managers may complete on the maker's behalf (e.g. the florist forgot). */
export const completeTask = async (taskId: string, payload: CompleteTaskPayload, actor: TaskActor) => {
  const current = await loadTask(taskId)
  assertNotCancelled(current)
  // Completing twice would replace completedAt and the earlier proof photo.
  if (current.status === 'COMPLETED') throw new ApiError(409, 'Sản phẩm này đã hoàn tất')

  let maker: { id: string; name: string | null }
  if (current.assigneeId) {
    if (current.assigneeId !== actor.id && !canManageTasks(actor.role)) {
      throw new ApiError(403, `Sản phẩm này giao cho ${current.assigneeName ?? 'người khác'}`)
    }
    maker = { id: current.assigneeId, name: current.assigneeName }
  } else {
    if (canManageTasks(actor.role)) throw new ApiError(400, 'Chọn thợ làm sản phẩm trước khi hoàn tất')
    maker = { id: actor.id, name: actor.name }
  }

  // Validates type/size and uploads to R2 (or inlines it when R2 is not set up).
  const proofUrl = await storePhoto(payload.photo, 'proofs', payload.thumb)

  const { count } = await db.task.updateMany({
    where: { id: taskId, assigneeId: current.assigneeId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    data: {
      status: 'COMPLETED',
      completionProofUrl: proofUrl,
      completedAt: new Date(),
      assigneeId: maker.id,
      assigneeName: maker.name,
    },
  })
  if (count === 0) throw new ApiError(409, 'Sản phẩm vừa được người khác cập nhật. Tải lại trang để xem.')
  await setOrderAssigneeIfEmpty(current.orderId, maker)
  return getTask(taskId)
}

/** Check-ins in one Vietnam calendar month, optionally for one staff member. */
export const listStaffCheckIns = async (month: { start: Date; end: Date }, staffId?: string) => {
  const checkins = await db.staffCheckIn.findMany({
    where: { timestamp: { gte: month.start, lt: month.end }, ...(staffId ? { staffId } : {}) },
    orderBy: { timestamp: 'desc' },
  })
  return checkins.map(mapCheckIn)
}

// Orders in these states never represent realised revenue and must be excluded
// from every revenue figure. Previously the revenue queries filtered on date
// only, so a cancelled order still counted for its full total.
const REVENUE_EXCLUDED_STATUSES = ['CANCELLED']

export const getDashboardStats = async () => {
  const now = new Date()
  // Vietnam calendar boundaries - the server clock is UTC.
  const startOfMonth = startOfVnMonth(now)
  const weekAgo = addVnDays(now, -6)

  // Bound the window at "now" as well as at the start of the period. Without an
  // upper bound a future-dated order counts towards this month's revenue, and
  // keeps counting every month thereafter.
  const revenueWindow = (from: Date) => ({
    createdAt: { gte: from, lte: now },
    status: { notIn: REVENUE_EXCLUDED_STATUSES },
  })

  const [monthlyOrders, weeklyOrders, activeOrders, monthlyTasks, recentOrders] = await Promise.all([
    db.order.findMany({
      where: revenueWindow(startOfMonth),
      select: { total: true },
    }),
    db.order.findMany({
      where: revenueWindow(weekAgo),
      select: { createdAt: true, total: true },
    }),
    db.order.count({
      where: { status: { in: ['NEW', 'IN_PROGRESS'] } },
    }),
    db.task.count({
      where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        code: true,
        bouquetName: true,
        receiveTime: true,
        status: true,
        total: true,
      },
    }),
  ])

  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => ({
    date: vnDateKey(addVnDays(weekAgo, index)),
    revenue: 0,
  }))
  const weeklyIndex = new Map(weeklyRevenue.map((entry, index) => [entry.date, index]))

  for (const order of weeklyOrders) {
    const index = weeklyIndex.get(vnDateKey(order.createdAt))
    if (index !== undefined) {
      weeklyRevenue[index].revenue += parseCurrencyToNumber(order.total)
    }
  }

  return {
    monthlyRevenue: monthlyOrders.reduce((sum, order) => sum + parseCurrencyToNumber(order.total), 0),
    monthlyOrders: monthlyOrders.length,
    activeOrders,
    monthlyTasks,
    weeklyRevenue,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      receiveTime: order.receiveTime.toISOString(),
    })),
  }
}

export const listStoreLocations = async () => {
  const locs = await db.storeLocation.findMany()
  return locs.map(l => ({
    id: l.id,
    label: l.label,
    address: l.address,
    coordinates: { lat: l.lat, lng: l.lng }
  }))
}

export const listUsers = async () => {
  const users = await db.user.findMany()
  return users.map(mapUser)
}

export { ApiError }
