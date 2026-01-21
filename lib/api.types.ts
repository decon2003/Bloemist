import { CreateOrderInput, CreateTaskInput, Order, Task, TaskStatus, Florist, StaffCheckIn, WorkspaceSettings, User } from './types'

export interface AssignTaskPayload {
  userId: string
  userName: string
}

export interface CompleteTaskPayload {
  photo: File | Blob
}

export interface ApiClient {
  fetchTasks: () => Promise<Task[]>
  fetchTask: (taskId: string) => Promise<Task>
  fetchOrders: () => Promise<Order[]>
  fetchOrder: (orderId: string) => Promise<Order>
  createOrder: (input: CreateOrderInput) => Promise<Order>
  updateOrder: (orderId: string, input: Partial<CreateOrderInput>) => Promise<Order>
  deleteOrder: (orderId: string) => Promise<void>
  assignOrder: (orderId: string, payload: AssignTaskPayload) => Promise<Order>
  fetchFlorists: () => Promise<Florist[]>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (taskId: string, input: Partial<CreateTaskInput>) => Promise<Task>
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<Task>
  updateTaskNotes: (taskId: string, notes: string) => Promise<Task>
  assignTask: (taskId: string, payload: AssignTaskPayload) => Promise<Task>
  unassignTask: (taskId: string, payload: AssignTaskPayload) => Promise<Task>
  completeTask: (taskId: string, payload: CompleteTaskPayload) => Promise<Task>
  fetchCheckIns: () => Promise<StaffCheckIn[]>
  createCheckIn: (input: Partial<StaffCheckIn>) => Promise<StaffCheckIn>
  checkOut: (checkInId: string) => Promise<StaffCheckIn>
  fetchDashboardStats: () => Promise<any>
  fetchWorkspaceSettings: () => Promise<WorkspaceSettings>
  login: (email: string, password: string) => Promise<User>
  fetchUsers: () => Promise<User[]>
  createUser: (input: Partial<User>) => Promise<User>
  updateUser: (userId: string, input: Partial<User>) => Promise<User>
  deleteUser: (userId: string) => Promise<void>
  fetchInventory: () => Promise<any[]>
  updateInventory: (item: any) => Promise<any>
}
