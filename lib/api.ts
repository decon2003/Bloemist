// ============================================================
// API Layer - Calls Real Backend API Routes
// ============================================================
import type { CreateOrderInput, CreateTaskInput, Order, Task, TaskStatus, Florist, User, StaffCheckIn, WorkspaceSettings } from './types'
import type { ApiClient, AssignTaskPayload, CompleteTaskPayload } from './api.types'

const API_BASE_URL = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body instanceof FormData
    ? options.headers
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

// API Client Implementation
const apiClient: ApiClient = {
  // Tasks
  fetchTasks: () => request<Task[]>('/tasks'),
  fetchTask: (taskId) => request<Task>(`/tasks/${taskId}`),
  createTask: (input) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (taskId, input) => request<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateTaskStatus: (taskId, status) => request<Task>(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateTaskNotes: (taskId, notes) => request<Task>(`/tasks/${taskId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  assignTask: (taskId, payload) => request<Task>(`/tasks/${taskId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  unassignTask: (taskId, payload) => request<Task>(`/tasks/${taskId}/unassign`, { method: 'POST', body: JSON.stringify(payload) }),
  completeTask: (taskId, payload) => {
    const formData = new FormData()
    formData.append('photo', payload.photo)
    return request<Task>(`/tasks/${taskId}/complete`, { method: 'POST', body: formData })
  },

  // Orders
  fetchOrders: () => request<Order[]>('/orders'),
  fetchOrder: (orderId) => request<Order>(`/orders/${orderId}`),
  createOrder: (input) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrder: (orderId, input) => request<Order>(`/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOrder: (orderId) => request<void>(`/orders/${orderId}`, { method: 'DELETE' }),
  assignOrder: (orderId, payload) => request<Order>(`/orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),

  // Users & Florists
  fetchFlorists: () => request<Florist[]>('/florists'),
  fetchUsers: () => request<User[]>('/users'),
  login: (email, password) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Check-ins
  fetchCheckIns: () => request<StaffCheckIn[]>('/checkins'),
  createCheckIn: (input) => request<StaffCheckIn>('/checkins', { method: 'POST', body: JSON.stringify(input) }),
  checkOut: (checkInId) => request<StaffCheckIn>(`/checkins/${checkInId}`, { method: 'PATCH' }),

  // Dashboard & Settings
  fetchDashboardStats: () => request<any>('/reports/dashboard'),
  fetchWorkspaceSettings: () => request<WorkspaceSettings>('/settings'),

  // Inventory
  fetchInventory: () => request<any[]>('/inventory'),
  updateInventory: (item) => request<any>('/inventory', { method: 'POST', body: JSON.stringify(item) }),
}

// Named exports for convenience
export const fetchTasks = apiClient.fetchTasks
export const fetchTask = apiClient.fetchTask
export const fetchOrders = apiClient.fetchOrders
export const fetchOrder = apiClient.fetchOrder
export const createOrder = apiClient.createOrder
export const updateOrder = apiClient.updateOrder
export const deleteOrder = apiClient.deleteOrder
export const assignOrder = apiClient.assignOrder
export const fetchFlorists = apiClient.fetchFlorists
export const createTask = apiClient.createTask
export const updateTask = apiClient.updateTask
export const updateTaskStatus = apiClient.updateTaskStatus
export const updateTaskNotes = apiClient.updateTaskNotes
export const assignTask = apiClient.assignTask
export const unassignTask = apiClient.unassignTask
export const completeTask = apiClient.completeTask
export const fetchCheckIns = apiClient.fetchCheckIns
export const createCheckIn = apiClient.createCheckIn
export const checkOut = apiClient.checkOut
export const fetchDashboardStats = apiClient.fetchDashboardStats
export const fetchWorkspaceSettings = apiClient.fetchWorkspaceSettings
export const login = apiClient.login
export const fetchUsers = apiClient.fetchUsers
export const fetchInventory = apiClient.fetchInventory
export const updateInventory = apiClient.updateInventory

export type { AssignTaskPayload, CompleteTaskPayload } from './api.types'
export default apiClient
