import { orders as initialOrders, tasks as initialTasks, florists as initialFlorists, staffCheckins as initialCheckins, workspaceSettings as initialSettings, staffProfiles } from './mock-data'
import type { Task, Order, CreateTaskInput, TaskStatus, Florist, CreateOrderInput, StaffCheckIn, WorkspaceSettings, User } from './types'
import type { ApiClient, AssignTaskPayload, CompleteTaskPayload } from './api.types'

const STORAGE_KEYS = {
  TASKS: 'mock_tasks_v1',
  ORDERS: 'mock_orders_v1',
  FLORISTS: 'mock_florists_v1',
  CHECKINS: 'mock_checkins_v1',
  SETTINGS: 'mock_settings_v1',
}

const loadFromStorage = <T>(key: string, defaults: T): T => {
  if (typeof window === 'undefined') return defaults
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaults
  } catch (e) {
    console.error(`Failed to load ${key} from storage`, e)
    return defaults
  }
}

const saveToStorage = <T>(key: string, data: T) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error(`Failed to save ${key} to storage`, e)
  }
}

let tasks: Task[] = loadFromStorage(STORAGE_KEYS.TASKS, [...initialTasks])
let orders: Order[] = loadFromStorage(STORAGE_KEYS.ORDERS, [...initialOrders])
let florists: Florist[] = loadFromStorage(STORAGE_KEYS.FLORISTS, [...initialFlorists])
let checkins: StaffCheckIn[] = loadFromStorage(STORAGE_KEYS.CHECKINS, [...initialCheckins])
// @ts-ignore
let settings: WorkspaceSettings = loadFromStorage(STORAGE_KEYS.SETTINGS, { ...initialSettings })

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const getTaskIndex = (taskId: string) => tasks.findIndex((task) => task.id === taskId)
const buildOrderCode = () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`

const buildTask = (input: CreateTaskInput, linkedOrder?: Order): Task => ({
  id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  orderId: linkedOrder?.id,
  orderCode: linkedOrder?.code,
  bouquetName: input.bouquetName || linkedOrder?.bouquetName || 'Unlinked task',
  bouquetImage: input.bouquetImage || linkedOrder?.bouquetImage,
  taskTitle:
    input.taskTitle ||
    `Build ${input.bouquetName || linkedOrder?.bouquetName || 'bouquet'}${linkedOrder ? ` for ${linkedOrder.customerName}` : ''}`,
  price: input.price,
  assigneeId: input.assigneeId,
  assigneeName: input.assigneeName,
  samplePhotoUrls: input.samplePhotoUrls || (input.bouquetImage ? [input.bouquetImage] : linkedOrder?.bouquetImage ? [linkedOrder.bouquetImage] : undefined),
  status: input.status || (input.assigneeId ? 'ASSIGNED' : 'UNASSIGNED'),
  dueTime: input.dueTime,
  createdAt: new Date().toISOString(),
  startTime: null,
  notes: input.notes || '',
  type: input.type || 'CAM_HOA',
  quantity: input.quantity ?? 1,
  customerName: linkedOrder?.customerName || 'Unlinked task',
  customerPhone: linkedOrder?.customerPhone,
  receiverName: linkedOrder?.receiverName,
  receiverPhone: linkedOrder?.receiverPhone,
  deliveryType: linkedOrder?.deliveryType || 'PICKUP',
  deliveryTime: linkedOrder?.receiveTime || new Date().toISOString(),
})

const withTask = (taskId: string, mutator: (task: Task) => Task): Task => {
  const index = getTaskIndex(taskId)
  if (index === -1) {
    throw new Error('Task not found')
  }
  const updated = mutator(tasks[index])
  tasks = [...tasks.slice(0, index), updated, ...tasks.slice(index + 1)]
  saveToStorage(STORAGE_KEYS.TASKS, tasks)
  return updated
}

const withOrder = (orderId: string, mutator: (order: Order) => Order): Order => {
  const index = orders.findIndex(o => o.id === orderId)
  if (index === -1) {
    throw new Error('Order not found')
  }
  const updated = mutator(orders[index])
  orders = [...orders.slice(0, index), updated, ...orders.slice(index + 1)]
  saveToStorage(STORAGE_KEYS.ORDERS, orders)
  return updated
}

const fileToDataUrl = (file: File | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

async function fetchTasks(): Promise<Task[]> {
  await delay()
  // Refresh from storage just in case another tab updated it
  tasks = loadFromStorage(STORAGE_KEYS.TASKS, tasks)
  return clone(tasks)
}

async function fetchTask(taskId: string): Promise<Task> {
  await delay()
  // Ensure we have the latest
  tasks = loadFromStorage(STORAGE_KEYS.TASKS, tasks)
  const task = tasks.find((entry) => entry.id === taskId)
  if (!task) {
    throw new Error('Task not found')
  }
  return clone(task)
}

async function fetchOrders(): Promise<Order[]> {
  await delay()
  orders = loadFromStorage(STORAGE_KEYS.ORDERS, orders)
  return clone(orders)
}

async function fetchOrder(orderId: string): Promise<Order> {
  await delay()
  orders = loadFromStorage(STORAGE_KEYS.ORDERS, orders)
  const order = orders.find((entry) => entry.id === orderId)
  if (!order) {
    throw new Error('Order not found')
  }
  return clone(order)
}

async function fetchFlorists(): Promise<Florist[]> {
  await delay()
  return clone(florists)
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  await delay()
  const newOrder: Order = {
    id: `order-${Date.now()}`,
    code: input.code || buildOrderCode(),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    receiverName: input.receiverName,
    receiverPhone: input.receiverPhone,
    bouquetName: input.bouquetName,
    bouquetImage: input.bouquetImage,
    receiveTime: input.receiveTime,
    deliveryType: input.deliveryType,
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

  orders = [newOrder, ...orders]
  saveToStorage(STORAGE_KEYS.ORDERS, orders)

  // Explicitly create tasks if requested (simplified for mock)
  return clone(newOrder)
}

async function updateOrder(orderId: string, input: Partial<CreateOrderInput>): Promise<Order> {
  await delay()
  const updated = withOrder(orderId, (order) => ({
    ...order,
    ...input,
    // Ensure we don't overwrite ID or Code
    id: order.id,
    code: order.code
  }))
  return clone(updated)
}

async function deleteOrder(orderId: string): Promise<void> {
  await delay()
  const index = orders.findIndex(o => o.id === orderId)
  if (index !== -1) {
    orders = [...orders.slice(0, index), ...orders.slice(index + 1)]
    saveToStorage(STORAGE_KEYS.ORDERS, orders)
  }
}

async function assignOrder(orderId: string, payload: AssignTaskPayload): Promise<Order> {
  await delay()
  const updated = withOrder(orderId, (order) => ({
    ...order,
    assigneeId: payload.userId,
    assigneeName: payload.userName
  }))
  // Mock propagation to tasks
  tasks = tasks.map(t => {
    if (t.orderId === orderId && t.status !== 'COMPLETED') {
      return { ...t, assigneeId: payload.userId, assigneeName: payload.userName, status: 'ASSIGNED' }
    }
    return t
  })
  saveToStorage(STORAGE_KEYS.TASKS, tasks)

  return clone(updated)
}

async function createTask(input: CreateTaskInput): Promise<Task> {
  await delay()
  const linkedOrder = input.orderId ? orders.find((order) => order.id === input.orderId) : undefined
  const newTask = buildTask(input, linkedOrder)

  tasks = [newTask, ...tasks]
  saveToStorage(STORAGE_KEYS.TASKS, tasks)
  return clone(newTask)
}

const resolveStartTime = (current: Task['startTime'], nextStatus: TaskStatus) => {
  if (nextStatus === 'IN_PROGRESS') {
    return current ?? new Date().toISOString()
  }
  if (nextStatus === 'UNASSIGNED' || nextStatus === 'ASSIGNED') {
    return null
  }
  return current ?? null
}

async function updateTask(taskId: string, input: Partial<CreateTaskInput>): Promise<Task> {
  await delay()
  const updated = withTask(taskId, (task) => {
    const nextStatus = input.status ?? task.status
    return {
      ...task,
      taskTitle: input.taskTitle ?? task.taskTitle,
      status: nextStatus,
      startTime: resolveStartTime(task.startTime, nextStatus),
      dueTime: input.dueTime ?? task.dueTime,
      price: input.price ?? task.price,
      notes: input.notes ?? task.notes,
      samplePhotoUrls: input.samplePhotoUrls ?? task.samplePhotoUrls,
      bouquetImage: input.bouquetImage ?? task.bouquetImage,
      assigneeId: input.assigneeId ?? task.assigneeId,
      assigneeName: input.assigneeName ?? task.assigneeName,
    }
  })

  return clone(updated)
}

async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  await delay()
  const updated = withTask(taskId, (task) => ({
    ...task,
    status,
    startTime: resolveStartTime(task.startTime, status),
  }))
  return clone(updated)
}

async function updateTaskNotes(taskId: string, notes: string): Promise<Task> {
  await delay()
  const updated = withTask(taskId, (task) => ({ ...task, notes }))
  return clone(updated)
}

async function assignTask(taskId: string, payload: AssignTaskPayload): Promise<Task> {
  await delay()
  const updated = withTask(taskId, (task) => ({
    ...task,
    assigneeId: payload.userId,
    assigneeName: payload.userName,
    status: task.status === 'UNASSIGNED' ? 'ASSIGNED' : task.status,
    startTime: resolveStartTime(task.startTime, task.status === 'UNASSIGNED' ? 'ASSIGNED' : task.status),
  }))
  return clone(updated)
}

async function unassignTask(taskId: string, _payload: AssignTaskPayload): Promise<Task> {
  await delay()
  const updated = withTask(taskId, (task) => ({
    ...task,
    lastAssigneeName: task.assigneeName || task.lastAssigneeName,
    lastAssignedAt: new Date().toISOString(),
    assigneeId: undefined,
    assigneeName: undefined,
    status: 'UNASSIGNED',
    startTime: resolveStartTime(task.startTime, 'UNASSIGNED'),
  }))
  return clone(updated)
}

async function completeTask(taskId: string, payload: CompleteTaskPayload): Promise<Task> {
  await delay()
  const dataUrl = await fileToDataUrl(payload.photo)
  const updated = withTask(taskId, (task) => ({
    ...task,
    status: 'COMPLETED',
    completionProofUrl: dataUrl,
    completedAt: new Date().toISOString(),
  }))
  return clone(updated)
}

async function fetchCheckIns(): Promise<StaffCheckIn[]> {
  await delay()
  checkins = loadFromStorage(STORAGE_KEYS.CHECKINS, checkins)
  return clone(checkins)
}

async function createCheckIn(input: Partial<StaffCheckIn>): Promise<StaffCheckIn> {
  await delay()
  const newCheckIn: StaffCheckIn = {
    id: `checkin-${Date.now()}`,
    staffId: input.staffId!,
    staffName: input.staffName!,
    discipline: input.discipline!,
    timestamp: new Date().toISOString(),
    checkInAt: new Date().toISOString(),
    locationLabel: input.locationLabel || 'Unknown',
    locationType: input.locationType || 'FIELD',
    coordinates: input.coordinates || { lat: 0, lng: 0 },
    distanceFromOfficeKm: input.distanceFromOfficeKm || 0,
    ordersTouched: 0,
    completedTasks: 0,
    notes: input.notes,
    checkOutAt: undefined,
    workingHours: undefined,
  }

  checkins = [newCheckIn, ...checkins]
  saveToStorage(STORAGE_KEYS.CHECKINS, checkins)
  return clone(newCheckIn)
}

async function checkOut(checkInId: string): Promise<StaffCheckIn> {
  await delay()
  const index = checkins.findIndex(c => c.id === checkInId)
  if (index === -1) throw new Error('Checkin not found')

  const now = new Date()
  const checkInAt = new Date(checkins[index].checkInAt || checkins[index].timestamp)
  const workingHours = (now.getTime() - checkInAt.getTime()) / (1000 * 60 * 60)

  const updated = {
    ...checkins[index],
    checkOutAt: now.toISOString(),
    workingHours
  }

  checkins = [...checkins.slice(0, index), updated, ...checkins.slice(index + 1)]
  saveToStorage(STORAGE_KEYS.CHECKINS, checkins)
  return clone(updated)
}

async function fetchDashboardStats(): Promise<any> {
  await delay()
  return {
    totalOrders: orders.length,
    completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
    totalRevenue: orders.reduce((acc, o) => acc + parseInt(o.total.replace(/\D/g, '') || '0'), 0),
    activeStaff: 12
  }
}

async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  await delay()
  return clone(settings)
}

async function login(email: string, password: string): Promise<User> {
  await delay()
  // Simple mock login
  if (email.includes('admin')) {
    return { id: 'user-1', name: 'Admin User', email: 'admin@bloemist.com', role: 'admin', phone: '0909090909', status: 'active', createdAt: new Date().toISOString() }
  }
  if (email.includes('boss')) {
    return { id: 'user-boss', name: 'Big Boss', email: 'boss@bloemist.com', role: 'boss', phone: '0888888888', status: 'active', createdAt: new Date().toISOString() }
  }
  // Default to Florist
  return { id: 'user-2', name: 'Sarah Florist', email: email, role: 'florist', phone: '0912345678', status: 'active', createdAt: new Date().toISOString() }
}

async function fetchUsers(): Promise<User[]> {
  await delay()
  // Map staff profiles to users for demo
  return staffProfiles.map(p => ({
    id: p.id,
    name: p.name,
    email: `${p.name.toLowerCase().replace(' ', '.')}@bloemist.com`,
    role: p.specialty as any, // varied roles
    phone: '—',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: p.avatar
  }))
}

async function fetchInventory(): Promise<any[]> {
  await delay()
  return []
}

async function updateInventory(item: any): Promise<any> {
  await delay()
  return item
}

const apiMock: ApiClient = {
  fetchTasks,
  fetchTask,
  fetchOrders,
  fetchOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  assignOrder,
  fetchFlorists,
  createTask,
  updateTask,
  updateTaskStatus,
  updateTaskNotes,
  assignTask,
  unassignTask,
  completeTask,
  fetchCheckIns,
  createCheckIn,
  checkOut,
  fetchDashboardStats,
  fetchWorkspaceSettings,
  login,
  fetchUsers,
  fetchInventory,
  updateInventory,
}

export {
  fetchTasks,
  fetchTask,
  fetchOrders,
  fetchOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  assignOrder,
  fetchFlorists,
  createTask,
  updateTask,
  updateTaskStatus,
  updateTaskNotes,
  assignTask,
  unassignTask,
  completeTask,
  fetchCheckIns,
  createCheckIn,
  checkOut,
  fetchDashboardStats,
  fetchWorkspaceSettings,
  login,
  fetchUsers,
  fetchInventory,
  updateInventory,
}

export default apiMock
