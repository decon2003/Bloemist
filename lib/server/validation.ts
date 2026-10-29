import { ApiError, fieldLabel } from './api-error'

export const USER_ROLES = ['admin', 'sales', 'florist'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const USER_STATUSES = ['active', 'inactive'] as const

export const ORDER_STATUSES = ['NEW', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'] as const

export const TASK_STATUSES = [
  'UNASSIGNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const

/** Columns that must never be returned to a client that is not an admin.
 *  baseSalary and commissionRate are the most sensitive fields in the schema. */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatar: true,
  createdAt: true,
} as const

export const PRIVILEGED_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  payType: true,
  baseSalary: true,
  hourlyRate: true,
  commissionRate: true,
  salesCommissionRate: true,
  holidayHourlyRate: true,
  onlineHourlyRate: true,
  otHourlyRate: true,
  allowances: true,
  daysOffPerMonth: true,
} as const

/** The staff list as other staff see it (pickers, filters): no contact details. */
export const STAFF_DIRECTORY_SELECT = {
  id: true,
  name: true,
  role: true,
  status: true,
  avatar: true,
  createdAt: true,
} as const

export const PAY_TYPES = ['MONTHLY', 'HOURLY'] as const

export function assertOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ApiError(400, `${fieldLabel(field)} không hợp lệ`)
  }
  return value as T[number]
}

/** Trim and reject blank/whitespace-only strings, which previously slipped past
 *  every `!value` guard in the codebase. */
export function requireNonBlank(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `Vui lòng nhập ${fieldLabel(field)}`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${fieldLabel(field)} dài quá ${maxLength} ký tự`)
  }
  return trimmed
}

/** Commission is a percentage: 0-100 inclusive. Rejects NaN, Infinity, negative
 *  rates and the null-wipe that silently zeroed an employee's commission. */
export function parseCommissionRate(value: unknown, field = 'commissionRate'): number {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    throw new ApiError(400, `${fieldLabel(field)} phải là một số`)
  }
  if (numeric < 0 || numeric > 100) {
    throw new ApiError(400, `${fieldLabel(field)} phải từ 0 đến 100`)
  }
  return numeric
}

/** Money stays a string in the schema for now, but it must at least be a
 *  well-formed non-negative amount before it is persisted. */
export function parseMoneyString(value: unknown, field: string, { allowNegative = false } = {}): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ApiError(400, `${fieldLabel(field)} không phải số tiền hợp lệ`)
    if (!allowNegative && value < 0) throw new ApiError(400, `${fieldLabel(field)} không được âm`)
    return String(value)
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `Vui lòng nhập ${fieldLabel(field)}`)
  }
  const cleaned = value.trim()
  if (!/^-?[\d.,\s]+$/.test(cleaned)) {
    throw new ApiError(400, `${fieldLabel(field)} không phải số tiền hợp lệ`)
  }
  if (!allowNegative && cleaned.startsWith('-')) {
    throw new ApiError(400, `${fieldLabel(field)} không được âm`)
  }
  return cleaned
}

export function parseNonNegativeInt(value: unknown, field: string, fallback?: number): number {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback
    throw new ApiError(400, `Vui lòng nhập ${fieldLabel(field)}`)
  }
  const numeric = typeof value === 'string' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isInteger(numeric) || numeric < 0) {
    throw new ApiError(400, `${fieldLabel(field)} phải là số nguyên không âm`)
  }
  return numeric
}

export function normalizeEmail(value: unknown, field = 'email'): string {
  const email = requireNonBlank(value, field, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, `${fieldLabel(field)} không đúng định dạng email`)
  }
  return email
}
