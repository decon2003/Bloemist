'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { CreateOrderInput, CreateTaskInput, Task, TaskStatus, Order, Florist, StaffCheckIn, WorkspaceSettings, User } from '@/lib/types'
import {
  fetchTasks,
  fetchOrders,
  fetchFlorists,
  createOrder as createOrderRequest,
  updateOrder as updateOrderRequest,
  deleteOrder as deleteOrderRequest,
  createTask as createTaskRequest,
  updateTask as updateTaskRequest,
  updateTaskStatus as updateTaskStatusRequest,
  updateTaskNotes as updateTaskNotesRequest,
  assignTask as assignTaskRequest,
  assignOrder as assignOrderRequest,
  unassignTask as unassignTaskRequest,
  completeTask as completeTaskRequest,
  fetchCheckIns,
  createCheckIn as createCheckInRequest,
  checkOut as checkOutRequest,
  fetchWorkspaceSettings,
  fetchUsers,
  createUser as createUserRequest,
  updateUser as updateUserRequest,
  type AssignTaskPayload,
} from '@/lib/api'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@/lib/query-client'

interface AppDataContextValue {
  tasks: Task[]
  orders: Order[]
  florists: Florist[]
  isLoading: boolean
  createOrder: (input: CreateOrderInput) => Promise<Order>
  updateOrder: (orderId: string, input: Partial<CreateOrderInput>) => Promise<Order>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (taskId: string, input: Partial<CreateTaskInput>) => Promise<Task>
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<Task>
  updateTaskNotes: (taskId: string, notes: string) => Promise<Task>
  assignTask: (taskId: string, payload: AssignTaskPayload) => Promise<Task>
  unassignTask: (taskId: string, payload: AssignTaskPayload) => Promise<Task>
  completeTask: (taskId: string, file: File | Blob) => Promise<Task>
  checkins: StaffCheckIn[]
  settings: WorkspaceSettings | null
  createCheckIn: (input: Partial<StaffCheckIn>) => Promise<StaffCheckIn>
  checkOut: (checkInId: string) => Promise<StaffCheckIn>
  users: User[]
  assignOrder: (orderId: string, payload: AssignTaskPayload) => Promise<Order>
  deleteOrder: (orderId: string) => Promise<void>
  updateUser: (userId: string, input: Partial<User>) => Promise<User>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

const AppDataContextProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient()

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks })
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })
  const floristsQuery = useQuery({ queryKey: ['florists'], queryFn: fetchFlorists })
  const checkinsQuery = useQuery({ queryKey: ['checkins'], queryFn: fetchCheckIns })
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchWorkspaceSettings })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })

  const mergeTask = (updated: Task) => {
    queryClient.setQueryData<Task[]>(['tasks'], (prev = []) => {
      const existing = prev.some((task) => task.id === updated.id)
      if (!existing) {
        return [...prev, updated]
      }
      return prev.map((task) => (task.id === updated.id ? updated : task))
    })
  }

  const mergeOrder = (updated: Order) => {
    queryClient.setQueryData<Order[]>(['orders'], (prev = []) => {
      const existing = prev.some((order) => order.id === updated.id)
      if (!existing) {
        return [...prev, updated]
      }
      return prev.map((order) => (order.id === updated.id ? updated : order))
    })
  }

  const mergeUser = (updated: User) => {
    queryClient.setQueryData<User[]>(['users'], (prev = []) => {
      const existing = prev.some((u) => u.id === updated.id)
      if (!existing) {
        return [...prev, updated]
      }
      return prev.map((u) => (u.id === updated.id ? updated : u))
    })
  }

  const createOrder = useMutation({
    mutationFn: createOrderRequest,
    onSuccess: (created) => {
      queryClient.setQueryData<Order[]>(['orders'], (prev = []) => [...prev, created])
    },
  })

  const updateOrder = useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: Partial<CreateOrderInput> }) =>
      updateOrderRequest(orderId, input),
    onSuccess: (updated) => mergeOrder(updated),
  })

  const assignOrder = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: AssignTaskPayload }) =>
      assignOrderRequest(orderId, payload),
    onSuccess: (updated) => mergeOrder(updated),
  })

  const deleteOrder = useMutation({
    mutationFn: deleteOrderRequest,
    onSuccess: (_data, orderId) => {
      queryClient.setQueryData<Order[]>(['orders'], (prev = []) => prev.filter((o) => o.id !== orderId))
    },
  })

  const createUser = useMutation({
    mutationFn: ({ input }: { input: Partial<User> }) =>
      createUserRequest(input),
    onSuccess: (created) => {
      queryClient.setQueryData<User[]>(['users'], (prev = []) => [...prev, created])
    },
  })

  // Actually I should import { updateUser } from '@/lib/api' which I did.
  // Let's use the imported one.

  const updateUser = useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: Partial<User> }) =>
      updateUserRequest(userId, input),
    onSuccess: (updated) => mergeUser(updated),
  })

  const createTask = useMutation({
    mutationFn: createTaskRequest,
    onSuccess: (created) => {
      queryClient.setQueryData<Task[]>(['tasks'], (prev = []) => [...prev, created])
    },
  })

  const updateTask = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: Partial<CreateTaskInput> }) =>
      updateTaskRequest(taskId, input),
    onSuccess: (updated) => mergeTask(updated),
  })

  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTaskStatusRequest(taskId, status),
    onSuccess: (updated) => mergeTask(updated),
  })

  const updateTaskNotes = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) => updateTaskNotesRequest(taskId, notes),
    onSuccess: (updated) => mergeTask(updated),
  })

  const assignTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: AssignTaskPayload }) =>
      assignTaskRequest(taskId, payload),
    onSuccess: (updated) => mergeTask(updated),
  })

  const unassignTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: AssignTaskPayload }) =>
      unassignTaskRequest(taskId, payload),
    onSuccess: (updated) => mergeTask(updated),
  })

  const completeTask = useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File | Blob }) =>
      completeTaskRequest(taskId, { photo: file }),
    onSuccess: (updated) => mergeTask(updated),
  })

  const createCheckIn = useMutation({
    mutationFn: createCheckInRequest,
    onSuccess: (created) => {
      queryClient.setQueryData<StaffCheckIn[]>(['checkins'], (prev = []) => [created, ...prev])
    },
  })

  const checkOut = useMutation({
    mutationFn: checkOutRequest,
    onSuccess: (updated) => {
      queryClient.setQueryData<StaffCheckIn[]>(['checkins'], (prev = []) => {
        return prev.map((c) => c.id === updated.id ? updated : c)
      })
    },
  })

  const tasks = tasksQuery.data ?? []
  const orders = ordersQuery.data ?? []
  const florists = floristsQuery.data ?? []
  const checkins = checkinsQuery.data ?? []
  const settings = settingsQuery.data ?? null
  const users = usersQuery.data ?? []

  const value = useMemo(
    () => ({
      tasks,
      orders,
      florists,
      isLoading: tasksQuery.isPending || ordersQuery.isPending || floristsQuery.isPending,
      createOrder: (input: CreateOrderInput) => createOrder.mutateAsync(input),
      updateOrder: (orderId: string, input: Partial<CreateOrderInput>) => updateOrder.mutateAsync({ orderId, input }),
      createTask: (input: CreateTaskInput) => createTask.mutateAsync(input),
      updateTask: (taskId: string, input: Partial<CreateTaskInput>) => updateTask.mutateAsync({ taskId, input }),
      updateTaskStatus: (taskId: string, status: TaskStatus) => updateTaskStatus.mutateAsync({ taskId, status }),
      updateTaskNotes: (taskId: string, notes: string) => updateTaskNotes.mutateAsync({ taskId, notes }),
      assignTask: (taskId: string, payload: AssignTaskPayload) => assignTask.mutateAsync({ taskId, payload }),
      unassignTask: (taskId: string, payload: AssignTaskPayload) => unassignTask.mutateAsync({ taskId, payload }),
      completeTask: (taskId: string, file: File | Blob) => completeTask.mutateAsync({ taskId, file }),
      checkins,
      settings,
      createCheckIn: (input: Partial<StaffCheckIn>) => createCheckIn.mutateAsync(input),
      checkOut: (checkInId: string) => checkOut.mutateAsync(checkInId),
      assignOrder: (orderId: string, payload: AssignTaskPayload) => assignOrder.mutateAsync({ orderId, payload }),
      deleteOrder: (orderId: string) => deleteOrder.mutateAsync(orderId),
      users,
      updateUser: (userId: string, input: Partial<User>) => updateUser.mutateAsync({ userId, input }),
    }),
    [
      tasks,
      orders,
      florists,
      tasksQuery.isPending,
      ordersQuery.isPending,
      floristsQuery.isPending,
      createOrder,
      updateOrder,
      createTask,
      updateTask,
      updateTaskStatus,
      updateTaskNotes,
      assignTask,
      unassignTask,
      completeTask,
      updateUser,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AppDataContextProvider>{children}</AppDataContextProvider>
    </QueryClientProvider>
  )
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return context
}
