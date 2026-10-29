'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import type { CreateOrderInput, CreateTaskInput, ListParams, ShiftCorrectionInput, Task, TaskStatus, Order, Florist, StaffCheckIn, WorkspaceSettings, User } from '@/lib/types'
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
  unassignTask as unassignTaskRequest,
  completeTask as completeTaskRequest,
  addTaskProof as addTaskProofRequest,
  fetchCheckIns,
  createCheckIn as createCheckInRequest,
  checkOut as checkOutRequest,
  correctCheckIn as correctCheckInRequest,
  deleteCheckIn as deleteCheckInRequest,
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
  /** The photo is optional: sales add the finished-product photo afterwards. */
  completeTask: (taskId: string, file?: File | Blob | null) => Promise<Task>
  addTaskProof: (taskId: string, file: File | Blob) => Promise<Task>
  checkins: StaffCheckIn[]
  settings: WorkspaceSettings | null
  createCheckIn: (input: Partial<StaffCheckIn>) => Promise<StaffCheckIn>
  checkOut: (checkInId: string) => Promise<StaffCheckIn>
  correctCheckIn: (input: ShiftCorrectionInput) => Promise<StaffCheckIn>
  deleteCheckIn: (checkInId: string, reason: string) => Promise<void>
  users: User[]
  deleteOrder: (orderId: string) => Promise<{ lockedPayrollMonths: string[] }>
  updateUser: (userId: string, input: Partial<User>) => Promise<User>
  /** Which orders/tasks the current page shows. Lists load nothing until the
   *  page sets a scope, so no page downloads every order or task. */
  setOrderScope: (scope: ListParams) => void
  setTaskScope: (scope: ListParams) => void
  /** Reload the task lists (e.g. after an order's receive time moved its products). */
  refreshTasks: () => void
  /** "YYYY-MM" month of check-ins to load (Vietnam time). */
  setCheckinMonth: (month: string) => void
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

const AppDataContextProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const { user } = useAuth()
  // Every API route needs a session, so don't fire requests that can only 401/403.
  const canLoad = !!user && !user.mustChangePassword

  const dataNeeds = useMemo(() => {
    const route = pathname ?? ''
    const isOrdersRoute = route.includes('/orders')
    const isCheckinsRoute = route.includes('/checkins')
    const isStaffRoute = route.includes('/staff')
    const isSettingsRoute = route.includes('/settings')

    return {
      orders: canLoad && isOrdersRoute,
      tasks: canLoad && isOrdersRoute,
      florists: canLoad && isOrdersRoute,
      checkins: canLoad && isCheckinsRoute,
      settings: canLoad && (isCheckinsRoute || isSettingsRoute),
      users: canLoad && (isStaffRoute || isSettingsRoute || isCheckinsRoute || isOrdersRoute),
    }
  }, [pathname, canLoad])

  const [orderScope, setOrderScope] = useState<ListParams | null>(null)
  const [taskScope, setTaskScope] = useState<ListParams | null>(null)
  const [checkinMonth, setCheckinMonth] = useState<string | null>(null)

  const tasksQuery = useQuery({
    queryKey: ['tasks', taskScope],
    queryFn: () => fetchTasks(taskScope ?? undefined),
    enabled: dataNeeds.tasks && taskScope !== null,
  })
  const ordersQuery = useQuery({
    queryKey: ['orders', orderScope],
    queryFn: () => fetchOrders(orderScope ?? undefined),
    enabled: dataNeeds.orders && orderScope !== null,
    keepPreviousData: true,
  })
  const floristsQuery = useQuery({ queryKey: ['florists'], queryFn: fetchFlorists, enabled: dataNeeds.florists })
  const checkinsQuery = useQuery({
    queryKey: ['checkins', checkinMonth],
    queryFn: () => fetchCheckIns(checkinMonth ?? undefined),
    enabled: dataNeeds.checkins && checkinMonth !== null,
  })
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchWorkspaceSettings, enabled: dataNeeds.settings })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers, enabled: dataNeeds.users })

  // Lists are cached per scope (date window, search, order). An update replaces
  // the item wherever it is cached; a create/delete drops the cached lists so
  // each page refetches its own scope and new items land where they belong.
  const mergeTask = (updated: Task) => {
    queryClient.setQueriesData<Task[] | undefined>(['tasks'], (prev) =>
      prev?.map((task) => (task.id === updated.id ? updated : task)),
    )
  }

  const mergeOrder = (updated: Order) => {
    queryClient.setQueriesData<Order[] | undefined>(['orders'], (prev) =>
      prev?.map((order) => (order.id === updated.id ? updated : order)),
    )
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
    onSuccess: () => queryClient.removeQueries(['orders']),
  })

  const updateOrder = useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: Partial<CreateOrderInput> }) =>
      updateOrderRequest(orderId, input),
    onSuccess: (updated, { input }) => {
      mergeOrder(updated)
      // "Sẵn sàng" completes the products; a new person in charge takes them over.
      if (input.status !== undefined || input.assigneeId !== undefined) queryClient.removeQueries(['tasks'])
    },
  })

  const deleteOrder = useMutation({
    mutationFn: deleteOrderRequest,
    onSuccess: (_data, orderId) => {
      queryClient.setQueriesData<Order[] | undefined>(['orders'], (prev) => prev?.filter((o) => o.id !== orderId))
      queryClient.removeQueries(['tasks'])
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
    onSuccess: () => queryClient.removeQueries(['tasks']),
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
    mutationFn: ({ taskId, file }: { taskId: string; file?: File | Blob | null }) =>
      completeTaskRequest(taskId, { photo: file }),
    onSuccess: (updated) => mergeTask(updated),
  })

  const addTaskProof = useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File | Blob }) => addTaskProofRequest(taskId, file),
    onSuccess: (updated) => mergeTask(updated),
  })

  const createCheckIn = useMutation({
    mutationFn: createCheckInRequest,
    onSuccess: () => queryClient.removeQueries(['checkins']),
  })

  const checkOut = useMutation({
    mutationFn: checkOutRequest,
    onSuccess: (updated) => {
      queryClient.setQueriesData<StaffCheckIn[] | undefined>(['checkins'], (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      )
    },
  })

  const correctCheckIn = useMutation({
    mutationFn: correctCheckInRequest,
    // May create a shift, so reload rather than patch the cached month.
    onSuccess: () => queryClient.removeQueries(['checkins']),
  })

  const deleteCheckIn = useMutation({
    mutationFn: ({ checkInId, reason }: { checkInId: string; reason: string }) => deleteCheckInRequest(checkInId, reason),
    onSuccess: () => queryClient.removeQueries(['checkins']),
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
      isLoading:
        (dataNeeds.tasks && tasksQuery.isPending) ||
        (dataNeeds.orders && ordersQuery.isPending) ||
        (dataNeeds.florists && floristsQuery.isPending),
      createOrder: (input: CreateOrderInput) => createOrder.mutateAsync(input),
      updateOrder: (orderId: string, input: Partial<CreateOrderInput>) => updateOrder.mutateAsync({ orderId, input }),
      createTask: (input: CreateTaskInput) => createTask.mutateAsync(input),
      updateTask: (taskId: string, input: Partial<CreateTaskInput>) => updateTask.mutateAsync({ taskId, input }),
      updateTaskStatus: (taskId: string, status: TaskStatus) => updateTaskStatus.mutateAsync({ taskId, status }),
      updateTaskNotes: (taskId: string, notes: string) => updateTaskNotes.mutateAsync({ taskId, notes }),
      assignTask: (taskId: string, payload: AssignTaskPayload) => assignTask.mutateAsync({ taskId, payload }),
      unassignTask: (taskId: string, payload: AssignTaskPayload) => unassignTask.mutateAsync({ taskId, payload }),
      completeTask: (taskId: string, file?: File | Blob | null) => completeTask.mutateAsync({ taskId, file }),
      addTaskProof: (taskId: string, file: File | Blob) => addTaskProof.mutateAsync({ taskId, file }),
      checkins,
      settings,
      createCheckIn: (input: Partial<StaffCheckIn>) => createCheckIn.mutateAsync(input),
      checkOut: (checkInId: string) => checkOut.mutateAsync(checkInId),
      correctCheckIn: (input: ShiftCorrectionInput) => correctCheckIn.mutateAsync(input),
      deleteCheckIn: (checkInId: string, reason: string) => deleteCheckIn.mutateAsync({ checkInId, reason }),
      deleteOrder: (orderId: string) => deleteOrder.mutateAsync(orderId),
      users,
      updateUser: (userId: string, input: Partial<User>) => updateUser.mutateAsync({ userId, input }),
      setOrderScope,
      setTaskScope,
      refreshTasks: () => queryClient.removeQueries(['tasks']),
      setCheckinMonth,
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
      addTaskProof,
      checkins,
      settings,
      users,
      updateUser,
      dataNeeds.orders,
      dataNeeds.tasks,
      dataNeeds.florists,
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
