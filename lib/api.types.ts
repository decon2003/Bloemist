import { CreateOrderInput, CreateTaskInput, DashboardStats, Order, Task, TaskStatus, Florist, StaffCheckIn, WorkspaceSettings, User, CustomerPage, CustomerLookup, CustomerSummary, ListParams, BouquetSuggestion, AuditEntry, ShiftCorrectionInput } from './types'

export interface AssignTaskPayload {
  userId: string
  userName: string
}

export interface CompleteTaskPayload {
  photo: File | Blob
  /** Small JPEG for list views; optional. */
  thumb?: unknown
}

export interface ApiClient {
  fetchTasks: (params?: ListParams) => Promise<Task[]>
  fetchTask: (taskId: string) => Promise<Task>
  fetchOrders: (params?: ListParams) => Promise<Order[]>
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
  fetchCheckIns: (month?: string) => Promise<StaffCheckIn[]>
  correctCheckIn: (input: ShiftCorrectionInput) => Promise<StaffCheckIn>
  fetchRecentCheckIns: (days: number) => Promise<StaffCheckIn[]>
  updateWorkingHours: (hours: { start: string; end: string }) => Promise<WorkspaceSettings>
  createCheckIn: (input: Partial<StaffCheckIn>) => Promise<StaffCheckIn>
  checkOut: (checkInId: string) => Promise<StaffCheckIn>
  fetchDashboardStats: () => Promise<DashboardStats>
  fetchWorkspaceSettings: () => Promise<WorkspaceSettings>
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  uploadPhoto: (file: File | Blob) => Promise<string>
  fetchBouquets: () => Promise<BouquetSuggestion[]>
  fetchAudit: (params: { entity?: string; entityId?: string }) => Promise<AuditEntry[]>
  fetchStaffReport: (month: string) => Promise<{ month: string; rows: unknown[] }>
  fetchCustomers: (params: { q?: string; sort?: 'spend' | 'recent' | 'orders'; page?: number }) => Promise<CustomerPage>
  lookupCustomer: (phone: string) => Promise<CustomerLookup | null>
  updateCustomer: (customerId: string, input: Partial<Pick<CustomerSummary, 'name' | 'notes' | 'source' | 'marketingConsent'>>) => Promise<CustomerSummary>
  fetchCurrentUser: () => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>
  fetchUsers: () => Promise<User[]>
  createUser: (input: Partial<User>) => Promise<User>
  updateUser: (userId: string, input: Partial<User>) => Promise<User>
  deleteUser: (userId: string) => Promise<void>
}
