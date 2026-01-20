import { CreateOrderInput, CreateTaskInput, Order, Task, TaskStatus, Florist, User, StaffCheckIn, WorkspaceSettings } from './types'
import type { ApiClient, AssignTaskPayload, CompleteTaskPayload } from './api.types'
import mockApiClient from './api.mock'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
const DEV_MODE = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true'

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const response = await fetch(buildUrl(path), { ...options, headers })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  const data = (await response.json()) as T
  return data
}

const realApi: ApiClient = {
  fetchTasks: () => request<Task[]>('/tasks'),
  fetchTask: (taskId: string) => request<Task>(`/tasks/${taskId}`),
  fetchOrders: () => request<Order[]>('/orders'),
  fetchOrder: (orderId: string) => request<Order>(`/orders/${orderId}`),
  createOrder: (input: CreateOrderInput) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrder: (orderId: string, input: Partial<CreateOrderInput>) =>
    request<Order>(`/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOrder: (orderId: string) => request<void>(`/orders/${orderId}`, { method: 'DELETE' }),
  assignOrder: (orderId: string, payload: AssignTaskPayload) =>
    request<Order>(`/orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  fetchFlorists: () => request<Florist[]>('/florists'),
  createTask: (input: CreateTaskInput) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (taskId: string, input: Partial<CreateTaskInput>) =>
    request<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateTaskStatus: (taskId: string, status: TaskStatus) =>
    request<Task>(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateTaskNotes: (taskId: string, notes: string) =>
    request<Task>(`/tasks/${taskId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  assignTask: (taskId: string, payload: AssignTaskPayload) =>
    request<Task>(`/tasks/${taskId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  unassignTask: (taskId: string, payload: AssignTaskPayload) =>
    request<Task>(`/tasks/${taskId}/unassign`, { method: 'POST', body: JSON.stringify(payload) }),
  completeTask: (taskId: string, payload: CompleteTaskPayload) => {
    const formData = new FormData()
    formData.append('photo', payload.photo)
    return request<Task>(`/tasks/${taskId}/complete`, { method: 'POST', body: formData })
  },
  fetchCheckIns: () => request<StaffCheckIn[]>('/checkins'),
  createCheckIn: (input: Partial<StaffCheckIn>) => request<StaffCheckIn>('/checkins', { method: 'POST', body: JSON.stringify(input) }),
  checkOut: (checkInId: string) => request<StaffCheckIn>(`/checkins/${checkInId}`, { method: 'PATCH' }),
  fetchDashboardStats: () => request<any>('/reports/dashboard'),
  fetchWorkspaceSettings: () => request<WorkspaceSettings>('/settings'),
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  fetchUsers: () => request<User[]>('/users'),
  fetchInventory: () => request<any[]>('/inventory'),
  updateInventory: (item: any) => request<any>('/inventory', { method: 'POST', body: JSON.stringify(item) }),
}

const activeApi: ApiClient = DEV_MODE ? mockApiClient : realApi

export const fetchTasks = (...args: Parameters<ApiClient['fetchTasks']>) => activeApi.fetchTasks(...args)
export const fetchTask = (...args: Parameters<ApiClient['fetchTask']>) => activeApi.fetchTask(...args)
export const fetchOrders = (...args: Parameters<ApiClient['fetchOrders']>) => activeApi.fetchOrders(...args)
export const fetchOrder = (...args: Parameters<ApiClient['fetchOrder']>) => activeApi.fetchOrder(...args)
export const createOrder = (...args: Parameters<ApiClient['createOrder']>) => activeApi.createOrder(...args)
export const updateOrder = (...args: Parameters<ApiClient['updateOrder']>) => activeApi.updateOrder(...args)
export const deleteOrder = (...args: Parameters<ApiClient['deleteOrder']>) => activeApi.deleteOrder(...args)
export const assignOrder = (...args: Parameters<ApiClient['assignOrder']>) => activeApi.assignOrder(...args)
export const fetchFlorists = (...args: Parameters<ApiClient['fetchFlorists']>) => activeApi.fetchFlorists(...args)
export const createTask = (...args: Parameters<ApiClient['createTask']>) => activeApi.createTask(...args)
export const updateTask = (...args: Parameters<ApiClient['updateTask']>) => activeApi.updateTask(...args)
export const updateTaskStatus = (...args: Parameters<ApiClient['updateTaskStatus']>) => activeApi.updateTaskStatus(...args)
export const updateTaskNotes = (...args: Parameters<ApiClient['updateTaskNotes']>) => activeApi.updateTaskNotes(...args)
export const assignTask = (...args: Parameters<ApiClient['assignTask']>) => activeApi.assignTask(...args)
export const unassignTask = (...args: Parameters<ApiClient['unassignTask']>) => activeApi.unassignTask(...args)
export const completeTask = (...args: Parameters<ApiClient['completeTask']>) => activeApi.completeTask(...args)
export const fetchCheckIns = (...args: Parameters<ApiClient['fetchCheckIns']>) => activeApi.fetchCheckIns(...args)
export const createCheckIn = (...args: Parameters<ApiClient['createCheckIn']>) => activeApi.createCheckIn(...args)
export const checkOut = (...args: Parameters<ApiClient['checkOut']>) => activeApi.checkOut(...args)
export const fetchDashboardStats = (...args: Parameters<ApiClient['fetchDashboardStats']>) => activeApi.fetchDashboardStats(...args)
export const fetchWorkspaceSettings = (...args: Parameters<ApiClient['fetchWorkspaceSettings']>) => activeApi.fetchWorkspaceSettings(...args)
export const login = (...args: Parameters<ApiClient['login']>) => activeApi.login(...args)
export const fetchUsers = (...args: Parameters<ApiClient['fetchUsers']>) => activeApi.fetchUsers(...args)
export const fetchInventory = (...args: Parameters<ApiClient['fetchInventory']>) => activeApi.fetchInventory(...args)
export const updateInventory = (...args: Parameters<ApiClient['updateInventory']>) => activeApi.updateInventory(...args)

export const apiClient: ApiClient = {
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

export type { AssignTaskPayload, CompleteTaskPayload } from './api.types'
export default apiClient
