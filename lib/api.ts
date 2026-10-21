// ============================================================
// API Layer - Calls Real Backend API Routes
// ============================================================
import type { BouquetSuggestion, CreateOrderInput, CreateTaskInput, CustomerLookup, ListParams, CustomerPage, CustomerSummary, DashboardStats, Order, Task, TaskStatus, Florist, User, StaffCheckIn, WorkspaceSettings } from './types'
import type { ApiClient, AssignTaskPayload, CompleteTaskPayload } from './api.types'
import { compressImage } from './image-compress'

const API_BASE_URL = '/api'

/** "?from=..&to=.." from the set fields only. */
const toQuery = (params: object = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body instanceof FormData
    ? options.headers
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      message = JSON.parse(text).error ?? text
    } catch {
      // not JSON - keep the raw text
    }

    // Let the auth provider react (sign out / force a password change) without
    // every caller having to know about sessions.
    if (typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'))
      if (response.status === 403 && message === 'PASSWORD_CHANGE_REQUIRED') {
        window.dispatchEvent(new Event('auth:password-change-required'))
      }
    }

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
  fetchTasks: (params?: ListParams) => request<Task[]>(`/tasks${toQuery(params)}`),
  fetchTask: (taskId) => request<Task>(`/tasks/${taskId}`),
  createTask: (input) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (taskId, input) => request<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateTaskStatus: (taskId, status) => request<Task>(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateTaskNotes: (taskId, notes) => request<Task>(`/tasks/${taskId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  assignTask: (taskId, payload) => request<Task>(`/tasks/${taskId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  unassignTask: (taskId, payload) => request<Task>(`/tasks/${taskId}/unassign`, { method: 'POST', body: JSON.stringify(payload) }),
  completeTask: async (taskId, payload) => {
    const formData = new FormData()
    formData.append('photo', await compressImage(payload.photo))
    return request<Task>(`/tasks/${taskId}/complete`, { method: 'POST', body: formData })
  },
  uploadPhoto: async (file) => {
    const formData = new FormData()
    formData.append('photo', await compressImage(file))
    const { url } = await request<{ url: string }>('/uploads', { method: 'POST', body: formData })
    return url
  },

  fetchBouquets: () => request<BouquetSuggestion[]>('/bouquets'),
  fetchStaffReport: (month) => request<{ month: string; rows: unknown[] }>(`/reports/staff${toQuery({ month })}`),

  // Customers
  fetchCustomers: ({ q = '', sort = 'spend', page = 1 }) =>
    request<CustomerPage>(`/customers?${new URLSearchParams({ q, sort, page: String(page) })}`),
  lookupCustomer: (phone) => request<CustomerLookup | null>(`/customers/lookup?${new URLSearchParams({ phone })}`),
  updateCustomer: (customerId, input) =>
    request<CustomerSummary>(`/customers/${customerId}`, { method: 'PATCH', body: JSON.stringify(input) }),

  // Orders
  fetchOrders: (params?: ListParams) => request<Order[]>(`/orders${toQuery(params)}`),
  fetchOrder: (orderId) => request<Order>(`/orders/${orderId}`),
  createOrder: (input) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrder: (orderId, input) => request<Order>(`/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOrder: (orderId) => request<void>(`/orders/${orderId}`, { method: 'DELETE' }),
  assignOrder: (orderId, payload) => request<Order>(`/orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),

  // Users & Florists
  fetchFlorists: () => request<Florist[]>('/florists'),
  fetchUsers: () => request<User[]>('/users'),
  createUser: (input: Partial<User>) => request<User>('/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (userId: string, input: Partial<User>) => request<User>(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteUser: (userId: string) => request<void>(`/users/${userId}`, { method: 'DELETE' }),
  login: (email, password) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  fetchCurrentUser: () => request<User>('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request<User>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Check-ins
  fetchCheckIns: (month?: string) => request<StaffCheckIn[]>(`/checkins${toQuery({ month })}`),
  createCheckIn: (input) => request<StaffCheckIn>('/checkins', { method: 'POST', body: JSON.stringify(input) }),
  checkOut: (checkInId) => request<StaffCheckIn>(`/checkins/${checkInId}`, { method: 'PATCH' }),

  // Dashboard & Settings
  fetchDashboardStats: () => request<DashboardStats>('/reports/dashboard'),
  fetchWorkspaceSettings: () => request<WorkspaceSettings>('/settings'),
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
export const logout = apiClient.logout
export const uploadPhoto = apiClient.uploadPhoto
export const fetchCustomers = apiClient.fetchCustomers
export const fetchBouquets = apiClient.fetchBouquets
export const fetchStaffReport = apiClient.fetchStaffReport
export const lookupCustomer = apiClient.lookupCustomer
export const updateCustomer = apiClient.updateCustomer
export const fetchCurrentUser = apiClient.fetchCurrentUser
export const changePassword = apiClient.changePassword
export const fetchUsers = apiClient.fetchUsers
export const createUser = apiClient.createUser
export const updateUser = apiClient.updateUser
export const deleteUser = apiClient.deleteUser

export type { AssignTaskPayload, CompleteTaskPayload } from './api.types'
export default apiClient
