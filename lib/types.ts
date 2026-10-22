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
  /** Whole VND. */
  price?: number | null
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
  // Money is whole VND.
  listedPrice: number
  discount?: number | null
  deliveryFee?: number | null
  deliveryCoveredByShop?: boolean
  vatPercent?: number | null
  deposit?: number | null
  sellingPrice?: number | null
  remainingBalance?: number | null
  total: number
  notes?: string
  createdById?: string
  createdByName?: string
  assigneeId?: string
  assigneeName?: string
  /** Staff member credited with the sale (earns the sales commission). */
  salespersonId?: string | null
  salespersonName?: string | null
  new_customer?: boolean
  deliveryAddress?: string
  sourcePlatform?: string
  sourceChatId?: string
  sourceMessageId?: string
  sourceThreadId?: string
  sourceRawText?: string
  requiresAttention?: boolean
  sourceLastUpdatedAt?: string | null
  createdAt: string
}

export interface DashboardStats {
  monthlyRevenue: number
  monthlyOrders: number
  activeOrders: number
  monthlyTasks: number
  weeklyRevenue: Array<{
    date: string
    revenue: number
  }>
  recentOrders: Array<Pick<Order, 'id' | 'code' | 'bouquetName' | 'receiveTime' | 'status' | 'total'>>
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
  // Price inputs: whole VND or typed text ("1.250.000"). The server derives
  // sellingPrice, total and remainingBalance itself.
  listedPrice: number | string
  discount?: number | string
  deliveryFee?: number | string
  deliveryCoveredByShop?: boolean
  vatPercent?: number
  deposit?: number | string
  notes?: string
  code?: string
  createdById?: string
  createdByName?: string
  new_customer?: boolean
  assigneeId?: string
  assigneeName?: string
  sourcePlatform?: string
  sourceChatId?: string
  sourceMessageId?: string
  sourceThreadId?: string
  sourceRawText?: string
  requiresAttention?: boolean
  sourceLastUpdatedAt?: string | null
  tasks?: Array<{ name: string; price?: string; note?: string }>
  /** One task per line; with lines, the listed price is their sum. */
  products?: Array<{ name: string; quantity: number; note?: string; samplePhotoUrls?: string[]; unitPrice: number | string; image?: string }>
  /** Staff member credited with the sale; defaults to the creator. */
  salespersonId?: string | null
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
  /** Whole VND, or typed text such as "150.000". */
  price?: number | string
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
  /** Vietnam date of the shift, YYYY-MM-DD. */
  workDate: string
  /** Closed at closing time by the nightly job because nobody checked out. */
  autoClosed?: boolean
  correctedAt?: string | null
  correctedByName?: string | null
  correctionReason?: string | null
}

export type OtDecision = 'PENDING' | 'OT' | 'REGULAR' | 'EXCLUDE' | 'NONE'

export interface PayrollShift {
  date: string
  checkIn: string | null
  checkOut: string | null
  hours: number
  regularHours: number
  otHours: number
  otDecision: OtDecision
  autoClosed: boolean
}

export type CommissionKind = 'MAKER' | 'SALES'

export interface PayrollCommission {
  key: string
  kind: CommissionKind
  orderId: string | null
  orderCode: string | null
  label: string
  base: number
  rate: number
  included: boolean
}

export interface PayrollAdjustment {
  label: string
  amount: number
}

export interface PayrollLine {
  id: string
  userId: string
  userName: string
  role: string
  payType: 'MONTHLY' | 'HOURLY'
  baseSalary: number
  hourlyRate: number
  makerRate: number
  salesRate: number
  shifts: PayrollShift[]
  commissions: PayrollCommission[]
  adjustments: PayrollAdjustment[]
  note: string | null
  totals: {
    regularHours: number
    otHours: number
    pendingOtDays: number
    basePay: number
    otPay: number
    commissionByKind: Record<CommissionKind, number>
    commission: number
    adjustmentsTotal: number
    total: number
  }
}

export interface Payroll {
  id: string
  month: string
  status: 'DRAFT' | 'LOCKED'
  otMultiplier: number
  lockedAt: string | null
  lockedByName: string | null
  lines: PayrollLine[]
  summary: { total: number; pendingOtDays: number }
}

export interface PayrollLineUpdate {
  payType?: 'MONTHLY' | 'HOURLY'
  baseSalary?: number
  hourlyRate?: number
  makerRate?: number
  salesRate?: number
  shiftDecisions?: { date: string; otDecision: OtDecision }[]
  commissionChanges?: { key: string; included?: boolean; rate?: number }[]
  adjustments?: PayrollAdjustment[]
  note?: string | null
}

export interface ShiftCorrectionInput {
  workDate: string
  /** HH:mm, Vietnam time */
  checkIn: string
  checkOut?: string | null
  reason: string
  /** Managers only: whose shift. */
  staffId?: string
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
  /** MONTHLY = lương cứng, HOURLY = theo giờ. */
  payType?: 'MONTHLY' | 'HOURLY'
  /** Whole VND. */
  baseSalary?: number | null
  /** Whole VND per hour; also the base for overtime. */
  hourlyRate?: number
  /** % of the products this person made (hoa hồng làm đơn). */
  commissionRate?: number
  /** % of the orders credited to this person as salesperson (hoa hồng sale). */
  salesCommissionRate?: number
  mustChangePassword?: boolean
  /** Write-only: a temporary password set by a manager. Never returned. */
  password?: string
}

/** What a list should load: a Vietnam-day window (YYYY-MM-DD, inclusive), a
 *  search across all history, or (tasks only) one order's tasks. Empty = the
 *  server's default working window. */
export interface ListParams {
  from?: string
  to?: string
  q?: string
  orderId?: string
  /** Orders only: person in charge / salesperson (user id, or 'none' = not set). */
  assigneeId?: string
  salespersonId?: string
}

export interface AuditEntry {
  id: string
  at: string
  userId: string | null
  userName: string | null
  action: string
  entity: string
  entityId: string | null
  summary: string | null
  /** field -> [before, after] */
  changes: Record<string, [unknown, unknown]> | null
}

export interface BouquetSuggestion {
  name: string
  image: string | null
}

export type CustomerSource = 'facebook' | 'zalo' | 'instagram' | 'walk_in' | 'referral' | 'other'

export interface CustomerSummary {
  id: string
  phone: string
  name: string
  notes: string | null
  source: CustomerSource | null
  marketingConsent: boolean
  createdAt: string
  orderCount: number
  totalSpend: number
  lastOrderAt: string | null
  lastBouquet: string | null
}

export interface CustomerLookup extends CustomerSummary {
  recentReceivers: { receiverName: string; receiverPhone: string; deliveryAddress: string | null }[]
}

export interface CustomerPage {
  total: number
  page: number
  pageSize: number
  items: CustomerSummary[]
}

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  updateUser: (user: User) => void
}
