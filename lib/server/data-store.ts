import db from './db'
import type {
  AssignTaskPayload,
  CompleteTaskPayload,
} from '../api.types'
import type { CreateOrderInput, CreateTaskInput, Florist, Order, Task, TaskStatus, StaffCheckIn } from '../types'

import { ApiError } from './api-error'
import { storePhoto } from './storage'
import { parseCurrencyToNumber } from './money'
import { addVnDays, startOfVnMonth, vnDateKey } from './vn-time'
import { LIST_LIMIT, SEARCH_LIMIT, searchDigits, type ListScope } from './list-scope'
import type { Prisma } from '@prisma/client'
import { linkCustomer, normalizeCustomerPhone } from './customers'
import { TASK_STATUSES, assertOneOf } from './validation'

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

const mapCheckIn = (c: any): StaffCheckIn => ({
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

const parseRequiredDate = (value: string | Date, field: string) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Invalid date for field "${field}"`)
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
  options: { assigneeId?: string } = {},
) => {
  const where: Prisma.TaskWhereInput = {}
  if (scope.kind === 'order') {
    where.orderId = scope.orderId
  } else if (scope.kind === 'range') {
    where.dueTime = { gte: scope.start, lt: scope.end }
  } else {
    const digits = searchDigits(scope.q)
    where.OR = [
      { taskTitle: { contains: scope.q, mode: 'insensitive' } },
      { bouquetName: { contains: scope.q, mode: 'insensitive' } },
      { orderCode: { contains: scope.q, mode: 'insensitive' } },
      { order: { customerName: { contains: scope.q, mode: 'insensitive' } } },
      ...(digits.length >= 4 ? [{ order: { customer: { phone: { contains: digits } } } }] : []),
    ]
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

/** Orders received in a Vietnam-day window or matching a search. Florists only
 *  see orders that have a task assigned to them. */
export const listOrders = async (scope: ListScope, viewer: ListViewer) => {
  const where: Prisma.OrderWhereInput = {}
  if (scope.kind === 'range') {
    where.receiveTime = { gte: scope.start, lt: scope.end }
  } else {
    const digits = searchDigits(scope.q)
    where.OR = [
      { code: { contains: scope.q, mode: 'insensitive' } },
      { customerName: { contains: scope.q, mode: 'insensitive' } },
      { receiverName: { contains: scope.q, mode: 'insensitive' } },
      { bouquetName: { contains: scope.q, mode: 'insensitive' } },
      ...(digits.length >= 4 ? [{ customer: { phone: { contains: digits } } }] : []),
    ]
  }
  if (viewer.role === 'florist') where.tasks = { some: { assigneeId: viewer.id } }

  const orders = await db.order.findMany({
    where,
    orderBy: scope.kind === 'search' ? { createdAt: 'desc' } : { receiveTime: 'asc' },
    take: scope.kind === 'search' ? SEARCH_LIMIT : LIST_LIMIT,
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

export const createOrder = async (input: CreateOrderInput) => {
  const code = input.code || `ORD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`

  const customerId = await linkCustomer(input.customerPhone, input.customerName)

  const order = await db.order.create({
    data: {
      code,
      customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      receiverName: input.receiverName,
      receiverPhone: input.receiverPhone,
      bouquetName: input.bouquetName,
      bouquetImage: input.bouquetImage,
      receiveTime: parseRequiredDate(input.receiveTime, 'receiveTime'),
      deliveryType: input.deliveryType,
      deliveryAddress: input.deliveryAddress,
      status: input.status || 'NEW',
      listedPrice: input.listedPrice,
      discount: input.discount,
      deliveryFee: input.deliveryFee,
      deliveryCoveredByShop: input.deliveryCoveredByShop,
      vatPercent: input.vatPercent,
      deposit: input.deposit,
      sellingPrice: input.sellingPrice,
      remainingBalance: input.remainingBalance,
      total: input.total,
      notes: input.notes,
      createdById: input.createdById,
      createdByName: input.createdByName,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      new_customer: input.new_customer,
    }
  })

  return mapOrder(order)
}

// Only these columns may be written by an update. Anything else in the request
// body is ignored - notably id, code and createdAt, which the dashboard groups
// revenue by and which callers must never be able to rewrite.
const ORDER_UPDATABLE_FIELDS = [
  'customerName', 'customerPhone', 'receiverName', 'receiverPhone',
  'deliveryAddress', 'bouquetName', 'bouquetImage', 'deliveryType', 'status',
  'listedPrice', 'discount', 'deliveryFee', 'deliveryCoveredByShop',
  'vatPercent', 'deposit', 'sellingPrice', 'remainingBalance', 'total',
  'notes', 'assigneeId', 'assigneeName', 'new_customer',
] as const

export const updateOrder = async (orderId: string, input: Partial<CreateOrderInput>) => {
  const data: any = {}
  for (const field of ORDER_UPDATABLE_FIELDS) {
    if (input[field] !== undefined) data[field] = input[field]
  }

  if (input.receiveTime !== undefined) {
    data.receiveTime = parseRequiredDate(input.receiveTime, 'receiveTime')
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

  const order = await db.order.update({
    where: { id: orderId },
    data
  })
  return mapOrder(order)
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
    try {
      const o = await db.order.findUnique({ where: { id: input.orderId } })
      if (o) linkedOrder = mapOrder(o)
    } catch { }
  }

  const taskTitle = input.taskTitle ||
    `Build ${input.bouquetName || linkedOrder?.bouquetName || 'bouquet'}${linkedOrder ? ` for ${linkedOrder.customerName}` : ''}`

  const task = await db.task.create({
    data: {
      orderId: input.orderId,
      orderCode: linkedOrder?.code,
      bouquetName: input.bouquetName || linkedOrder?.bouquetName || 'Unlinked task',
      bouquetImage: input.bouquetImage || linkedOrder?.bouquetImage,
      taskTitle,
      samplePhotoUrls: JSON.stringify(
        input.samplePhotoUrls || (input.bouquetImage ? [input.bouquetImage] : linkedOrder?.bouquetImage ? [linkedOrder.bouquetImage] : [])
      ),
      status: input.status || ((input.assigneeId || linkedOrder?.assigneeId) ? 'ASSIGNED' : 'UNASSIGNED'),
      dueTime: new Date(input.dueTime),
      startTime: null,
      notes: input.notes || '',
      type: input.type || 'CAM_HOA',
      quantity: input.quantity ?? 1,
      price: input.price,
      assigneeId: input.assigneeId || linkedOrder?.assigneeId,
      assigneeName: input.assigneeName || linkedOrder?.assigneeName,
    }
  })

  return getTask(task.id)
}

export const updateTask = async (taskId: string, input: Partial<CreateTaskInput>) => {
  const { status, assigneeId, assigneeName, ...rest } = input
  const data: any = { ...rest }

  if (status) data.status = status
  if (assigneeId !== undefined) data.assigneeId = assigneeId
  if (assigneeName !== undefined) data.assigneeName = assigneeName
  if (input.samplePhotoUrls) data.samplePhotoUrls = JSON.stringify(input.samplePhotoUrls)
  if (input.dueTime) data.dueTime = new Date(input.dueTime)

  // Handle start time logic
  if (status === 'IN_PROGRESS') {
    // Only set if not already set? Or update?
    // Prisma doesn't support "COALESCE(start_time, NOW())" easily in update without raw, but we can read first or just assume override.
    // Let's read first to be safe, or just set it if it's null?
    // Optimization: Just set it.
    // If strict logic:
    const t = await db.task.findUnique({ where: { id: taskId } })
    if (t && !t.startTime) {
      data.startTime = new Date()
    }
  }

  const task = await db.task.update({
    where: { id: taskId },
    data
  })
  return getTask(task.id)
}

export const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
  // `status` is a bare String column, so without this check any value at all -
  // "COMPLETED" typed by hand, or "banana" - was persisted verbatim.
  const nextStatus = assertOneOf(status, TASK_STATUSES, 'status')

  const current = await db.task.findUnique({ where: { id: taskId } })
  if (!current) throw new ApiError(404, 'Task not found')

  // Completion requires proof of work and must go through completeTask(), which
  // enforces the photo. Allowing a direct PATCH to COMPLETED bypassed that
  // control entirely.
  if (nextStatus === 'COMPLETED' && !current.completionProofUrl) {
    throw new ApiError(
      400,
      'A task can only be completed through the completion endpoint, which requires a proof photo',
    )
  }

  const data: any = { status: nextStatus }

  if (nextStatus === 'IN_PROGRESS' && !current.startTime) {
    data.startTime = new Date()
  }

  // Moving a task back out of COMPLETED must clear the completion evidence,
  // otherwise the row claims to be in progress and completed at the same time.
  if (current.status === 'COMPLETED' && nextStatus !== 'COMPLETED') {
    data.completedAt = null
    data.completionProofUrl = null
  }

  await db.task.update({ where: { id: taskId }, data })
  return getTask(taskId)
}

export const updateTaskNotes = async (taskId: string, notes: string) => {
  if (typeof notes !== 'string') {
    throw new ApiError(400, 'Field "notes" must be a string')
  }
  await db.task.update({ where: { id: taskId }, data: { notes } })
  return getTask(taskId)
}

export const assignTask = async (taskId: string, payload: AssignTaskPayload) => {
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) throw new ApiError(404, 'Task not found')

  const newStatus = task.status === 'UNASSIGNED' ? 'ASSIGNED' : task.status

  await db.task.update({
    where: { id: taskId },
    data: {
      assigneeId: payload.userId,
      assigneeName: payload.userName,
      status: newStatus
    }
  })
  return getTask(taskId)
}

export const assignOrder = async (orderId: string, payload: AssignTaskPayload) => {
  await db.order.update({
    where: { id: orderId },
    data: {
      assigneeId: payload.userId,
      assigneeName: payload.userName
    }
  })

  // Propagate to tasks
  // status = CASE WHEN status = 'COMPLETED' THEN 'COMPLETED' ELSE 'ASSIGNED' END
  // We can do UpdateMany but conditional status update is tricky in one go if we strictly follow that logic.
  // Actually, standard prisma updateMany sets a fixed value.
  // We can filter tasks that are NOT completed and update them.
  await db.task.updateMany({
    where: {
      orderId: orderId,
      status: { not: 'COMPLETED' }
    },
    data: {
      assigneeId: payload.userId,
      assigneeName: payload.userName,
      status: 'ASSIGNED'
    }
  })
  // For completed tasks, also update assignee? The requirement implied valid tasks.
  // The SQL checked "CASE WHEN status = 'COMPLETED'".
  // If task is completed, we probably still want to update 'assignee' field for record?
  // The SQL: "status = CASE ... END". So assigneeId IS updated regardless.
  await db.task.updateMany({
    where: {
      orderId: orderId,
      status: 'COMPLETED'
    },
    data: {
      assigneeId: payload.userId,
      assigneeName: payload.userName
      // status remains COMPLETED
    }
  })

  return getOrder(orderId)
}

export const unassignTask = async (taskId: string, _payload: AssignTaskPayload) => {
  // Needs current values to set lastAssignee.
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) throw new ApiError(404, 'Task not found')

  // Unassigning a completed task used to strip the assignee and startTime while
  // leaving completedAt and the proof photo in place, so the row was completed
  // by nobody and the florist lost attribution for finished work.
  if (task.status === 'COMPLETED') {
    throw new ApiError(409, 'A completed task cannot be unassigned. Reopen it first.')
  }

  if (task.status === 'UNASSIGNED') {
    throw new ApiError(409, 'This task is already unassigned')
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      lastAssigneeName: task.assigneeName || task.lastAssigneeName,
      lastAssignedAt: new Date(),
      assigneeId: null,
      assigneeName: null,
      status: 'UNASSIGNED',
      startTime: null
    }
  })
  return getTask(taskId)
}

export const completeTask = async (taskId: string, payload: CompleteTaskPayload) => {
  const current = await db.task.findUnique({ where: { id: taskId } })
  if (!current) throw new ApiError(404, 'Task not found')

  // Completing twice previously overwrote completedAt and destroyed the earlier
  // proof photo - a retry after a timeout silently replaced the evidence.
  if (current.status === 'COMPLETED') {
    throw new ApiError(409, 'This task is already completed')
  }

  // Validates type/size and uploads to R2 (or inlines it when R2 is not set up).
  const proofUrl = await storePhoto(payload.photo, 'proofs')

  await db.task.update({
    where: { id: taskId },
    data: {
      status: 'COMPLETED',
      completionProofUrl: proofUrl,
      completedAt: new Date()
    }
  })
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

export const createStaffCheckIn = async (input: Partial<StaffCheckIn>) => {
  const checkin = await db.staffCheckIn.create({
    data: {
      staffId: input.staffId!,
      staffName: input.staffName!,
      discipline: input.discipline!,
      timestamp: new Date(),
      checkInAt: new Date(),
      locationLabel: input.locationLabel || 'Unknown',
      locationType: input.locationType || 'FIELD',
      lat: input.coordinates?.lat || 0,
      lng: input.coordinates?.lng || 0,
      distanceFromOfficeKm: input.distanceFromOfficeKm || 0,
      ordersTouched: 0,
      completedTasks: 0,
      notes: input.notes
      // displayName: undefined // Removed to fix type error
    }
  })
  return mapCheckIn(checkin)
}

export const checkOutStaff = async (checkInId: string) => {
  const checkIn = await db.staffCheckIn.findUnique({ where: { id: checkInId } })
  if (!checkIn) throw new ApiError(404, 'Check-in not found')
  if (checkIn.checkOutAt) throw new ApiError(400, 'Already checked out')

  const now = new Date()
  const checkInTime = checkIn.checkInAt ? new Date(checkIn.checkInAt) : new Date(checkIn.timestamp)
  const workingHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

  const updated = await db.staffCheckIn.update({
    where: { id: checkInId },
    data: {
      checkOutAt: now,
      workingHours
    }
  })
  return mapCheckIn(updated)
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
      where: { createdAt: { gte: startOfMonth } },
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
