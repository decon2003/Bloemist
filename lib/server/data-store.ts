import db from './db'
import type {
  AssignTaskPayload,
  CompleteTaskPayload,
} from '../api.types'
import type { CreateOrderInput, CreateTaskInput, Florist, Order, Task, TaskStatus, StaffCheckIn } from '../types'

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Helper to map Prisma entity to App entity
// Most fields match exactly due to camelCase in schema
const mapOrder = (o: any): Order => ({
  ...o,
  // Ensure types match what UI expects
  deliveryCoveredByShop: o.deliveryCoveredByShop ?? false,
  new_customer: o.new_customer ?? false,
  receiveTime: o.receiveTime.toISOString(),
  // createdAt is Date in Prisma, string in App? Check types.ts. Usually string in App.
  // We need to verify types.ts. Assuming string for now based on previous code usage (row.created_at ISO string).
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
      receiveTime: new Date(input.receiveTime), // Convert string to Date
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

export const updateOrder = async (orderId: string, input: Partial<CreateOrderInput>) => {
  const data: any = { ...input }

  // Clean up fields specifically
  if (data.receiveTime) data.receiveTime = new Date(data.receiveTime)
  // Ensure we don't update ID or Code if passed
  delete data.id
  delete data.code

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
  const data: any = { status }
  if (status === 'IN_PROGRESS') {
    const t = await db.task.findUnique({ where: { id: taskId } })
    if (t && !t.startTime) {
      data.startTime = new Date()
    }
  }

  await db.task.update({ where: { id: taskId }, data })
  return getTask(taskId)
}

export const updateTaskNotes = async (taskId: string, notes: string) => {
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
  if (!payload.photo) {
    throw new ApiError(400, 'Completion photo is required')
  }

  const buffer = Buffer.from(await payload.photo.arrayBuffer())
  const mime = (payload.photo as any).type || 'application/octet-stream'
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

export const getDashboardStats = async () => {
  const totalOrders = await db.order.count()
  const completedTasks = await db.task.count({ where: { status: 'COMPLETED' } })

  // Revenue: Sum total. Orders store total as "200,000". Need to parse.
  // Prisma aggregate doesn't support complex regex replace.
  // We might have to fetch all totals or use raw query.
  // For small scale, fetch all totals is fine.
  // For performance, use raw query.
  // Let's use raw query for revenue to keep it fast.
  const revenueResult: any[] = await db.$queryRaw`
      SELECT sum(CAST(REPLACE(REPLACE(total, '₫', ''), '.', '') AS INTEGER)) as total FROM "Order"
  `
  // Note: Table name "Order" is quoted and PascalCase because of Prisma Model naming convention in PG?
  // Prisma usually maps model Order to "Order" table unless @@map is used.
  // Postgres is case sensitive if quoted.

  const totalRevenue = revenueResult[0]?.total ? Number(revenueResult[0].total) : 0

  const activeStaff = await db.user.count({
    where: {
      role: { in: ['florist', 'sales', 'hybrid'] },
      status: 'active'
    }
  })

  return {
    totalOrders,
    completedTasks,
    totalRevenue,
    activeStaff
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
