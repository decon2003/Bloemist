export type TaskStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'

export type TaskType =
  | 'CAM_HOA'
  | 'BO_HOA'
  | 'SO_CHE'
  | 'DON_DEP'
  | 'IN_BIEN'
  | 'BOC_HOA'
  | 'SHIP_DON'

export interface Task {
  id: string
  orderId?: string
  orderCode?: string
  bouquetName: string
  bouquetImage?: string
  taskTitle: string
  price?: string
  assigneeId?: string
  assigneeName?: string
  samplePhotoUrls?: string[]
  status: TaskStatus
  dueTime: string
  createdAt: string
  startTime?: string | null
  notes: string
  type: TaskType
  quantity?: number
  customerName: string
  customerPhone?: string
  receiverName?: string
  receiverPhone?: string
  deliveryType: 'DELIVERY' | 'PICKUP'
  deliveryTime: string
  bom?: never
  materialsUsed?: never
  lastAssigneeName?: string
  lastAssignedAt?: string
  completionProofUrl?: string
  completedAt?: string
}

export interface Order {
  id: string
  code: string
  customerName: string
  customerPhone: string
  receiverName: string
  receiverPhone: string
  bouquetName: string
  bouquetImage?: string
  receiveTime: string
  deliveryType: 'DELIVERY' | 'PICKUP'
  status: 'NEW' | 'IN_PROGRESS' | 'READY' | 'DELIVERED'
  listedPrice: string
  discount?: string
  deliveryFee?: string
  deliveryCoveredByShop?: boolean
  vatPercent?: number
  deposit?: string
  sellingPrice?: string
  remainingBalance?: string
  total: string
  notes?: string
  createdById?: string
  createdByName?: string
  assigneeId?: string
  assigneeName?: string
  new_customer?: boolean
  deliveryAddress?: string
  createdAt: string
}

export interface CreateOrderInput {
  customerName: string
  customerPhone: string
  receiverName: string
  receiverPhone: string
  deliveryAddress?: string
  bouquetName: string
  bouquetImage?: string
  receiveTime: string
  deliveryType: 'DELIVERY' | 'PICKUP'
  status?: Order['status']
  listedPrice: string
  discount?: string
  deliveryFee?: string
  deliveryCoveredByShop?: boolean
  vatPercent?: number
  deposit?: string
  sellingPrice?: string
  remainingBalance?: string
  total: string
  notes?: string
  code?: string
  createdById?: string
  createdByName?: string
  new_customer?: boolean
  assigneeId?: string
  assigneeName?: string
  tasks?: Array<{ name: string; price?: string; note?: string }>
  products?: Array<{ name: string; quantity: number; note?: string; samplePhotoUrls?: string[] }>
}

export interface CreateTaskInput {
  orderId?: string
  bouquetName: string
  assigneeId?: string
  assigneeName?: string
  bouquetImage?: string
  samplePhotoUrls?: string[]
  dueTime: string
  status?: TaskStatus
  price?: string
  notes?: string
  taskTitle?: string
  type?: TaskType
  quantity?: number
  bom?: never
  materialsUsed?: never
}

export interface Florist {
  id: string
  name: string
}

export type UserRole = 'boss' | 'sales' | 'florist' | 'admin'

export type StaffDiscipline = 'sales' | 'florist' | 'hybrid'

export type StaffRoleSpecialty = 'sales' | 'florist' | 'hybrid'

export interface StaffProfile {
  id: string
  name: string
  avatar?: string
  title: string
  specialty: StaffRoleSpecialty
}

export type CheckInLocationType = 'AT_OFFICE' | 'FIELD'

export type CheckInVerificationStatus = 'pending' | 'approved' | 'flagged'

export interface StaffCheckIn {
  id: string
  staffId: string
  staffName: string
  discipline: StaffDiscipline
  timestamp: string
  checkInAt?: string
  checkOutAt?: string
  workingHours?: number
  locationLabel: string
  locationType: CheckInLocationType
  coordinates: {
    lat: number
    lng: number
  }
  distanceFromOfficeKm: number
  ordersTouched: number
  completedTasks: number
  notes?: string
  requiresReview?: boolean
  verificationStatus?: CheckInVerificationStatus
  verificationNote?: string
}

export interface StoreLocation {
  id: string
  label: string
  coordinates: {
    lat: number
    lng: number
  }
  address?: string
}

export interface WorkspaceSettings {
  storeLocations: StoreLocation[]
  workingHours: {
    start: string
    end: string
  }
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  status: 'active' | 'disabled'
  avatar?: string
  createdAt: string
}

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}
