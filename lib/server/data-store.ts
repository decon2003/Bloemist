import db from './db'
import type {
  AssignTaskPayload,
  CompleteTaskPayload,
} from '../api.types'
import type { CreateOrderInput, CreateTaskInput, Florist, Order, Task, TaskStatus, StaffCheckIn } from '../types'

import { MAX_COMPLETION_PHOTO_BYTES } from '../utils'
import { ApiError } from './api-error'
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

// Money arrives as free-form strings ("1.500.000 d", "-50000", "1 234,56").
// Strip grouping separators and currency decoration but preserve the sign and
// the decimal separator - dropping either silently turns refunds into revenue
// and inflates decimal amounts by 10x/100x.
const parseCurrencyToNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let text = value.trim().replace(/[^\d,.\-]/g, '')
  const negative = text.startsWith('-')
  text = text.replace(/-/g, '')

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const decimalAt = Math.max(lastComma, lastDot)

  // A separator is decimal only when it is the last one and leaves 1-2 digits
  // after it; otherwise every separator is thousands grouping (VN style).
  if (decimalAt !== -1 && text.length - decimalAt - 1 <= 2 && text.length - decimalAt - 1 > 0) {
    const whole = text.slice(0, decimalAt).replace(/[.,]/g, '')
    const fraction = text.slice(decimalAt + 1)
    text = `${whole}.${fraction}`
  } else {
    text = text.replace(/[.,]/g, '')
  }

  const numeric = Number(text)
  if (!Number.isFinite(numeric)) return 0
  return negative ? -numeric : numeric
}

// Local-time date key. Must match lib/date-utils.ts so that server buckets and
// client buckets agree; toISOString() here would shift every VN evening order
// into the previous day.
const getDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseRequiredDate = (value: string | Date, field: string) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Invalid date for field "${field}"`)
  }
  return date
}

export const listTasks = async () => {
  const tasks = await db.task.findMany({
    orderBy: { createdAt: 'desc' },
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
  return tasks.map(mapTask)
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
  return mapTask(task)
}

export const listOrders = async () => {
  const orders = await db.order.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return orders.map(o => ({
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

  const order = await db.order.create({
    data: {
      code,
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

// Proof photos are base64-inlined into a text column (there is no object
// storage yet), and base64 inflates a file by ~1.37x. On the current Neon free
// tier a handful of unbounded uploads is enough to fill the database, so the
// cap here is a storage guard, not just a performance one.
const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export const completeTask = async (taskId: string, payload: CompleteTaskPayload) => {
  // `photo` is cast from formData.get(), so a plain text field arrives here as a
  // string and would blow up on .arrayBuffer(). Check the shape, not truthiness.
  const photo = payload.photo as unknown
  if (!photo || typeof photo !== 'object' || typeof (photo as Blob).arrayBuffer !== 'function') {
    throw new ApiError(400, 'Completion photo is required and must be an uploaded file')
  }

  const blob = photo as Blob
  const mime = blob.type || 'application/octet-stream'

  if (!ALLOWED_PHOTO_MIME.includes(mime)) {
    throw new ApiError(400, `Unsupported image type "${mime}". Allowed: JPEG, PNG, WebP, HEIC.`)
  }

  if (blob.size === 0) {
    throw new ApiError(400, 'Completion photo is empty')
  }

  if (blob.size > MAX_COMPLETION_PHOTO_BYTES) {
    throw new ApiError(
      413,
      `Completion photo is too large (${(blob.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_COMPLETION_PHOTO_BYTES / 1024 / 1024} MB.`,
    )
  }

  const current = await db.task.findUnique({ where: { id: taskId } })
  if (!current) throw new ApiError(404, 'Task not found')

  // Completing twice previously overwrote completedAt and destroyed the earlier
  // proof photo - a retry after a timeout silently replaced the evidence.
  if (current.status === 'COMPLETED') {
    throw new ApiError(409, 'This task is already completed')
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

  await db.task.update({
    where: { id: taskId },
    data: {
      status: 'COMPLETED',
      completionProofUrl: dataUrl,
      completedAt: new Date()
    }
  })
  return getTask(taskId)
}

export const listStaffCheckIns = async () => {
  const checkins = await db.staffCheckIn.findMany({
    orderBy: { timestamp: 'desc' }
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 6)
  weekAgo.setHours(0, 0, 0, 0)

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

  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekAgo)
    date.setDate(weekAgo.getDate() + index)
    return {
      date: getDateKey(date),
      revenue: 0,
    }
  })
  const weeklyIndex = new Map(weeklyRevenue.map((entry, index) => [entry.date, index]))

  for (const order of weeklyOrders) {
    const index = weeklyIndex.get(getDateKey(order.createdAt))
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
