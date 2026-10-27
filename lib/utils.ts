import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

const VN_WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/** "15:00 · Thứ Sáu 24/10" in Vietnam time: when an order is delivered or picked up. */
export function formatDeliveryTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const vn = new Date(date.getTime() + 7 * 3_600_000)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(vn.getUTCHours())}:${two(vn.getUTCMinutes())} · ${VN_WEEKDAYS[vn.getUTCDay()]} ${two(vn.getUTCDate())}/${two(vn.getUTCMonth() + 1)}`
}

/** Shown after cancelling, restoring or deleting an order whose commissions
 *  sit in a payroll that is already locked. */
export function lockedPayrollNotice(months: string[] | undefined) {
  if (!months?.length) return null
  const list = months.map((m) => `${m.slice(5)}/${m.slice(0, 4)}`).join(', ')
  return `Bảng lương tháng ${list} đã chốt nên chưa đổi. Mở khoá và cập nhật bảng lương, hoặc thêm khoản điều chỉnh.`
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Upload ceiling for task completion photos, shared by the client and the API
 *  route. Proof photos are base64-inlined into a Postgres text column (~1.37x
 *  inflation) and the database is on a small free tier, so this is a storage
 *  limit, not just a UX one. */
const dateTimeFormatterCache: Record<string, Intl.DateTimeFormat> = {}

// Intl throws RangeError on an Invalid Date. These formatters are called from
// render paths (task cards, list rows), so one bad timestamp would unmount the
// whole list rather than blanking a single cell. Always return a placeholder.
export function formatDateTime(value: string | number | Date | null | undefined, lang: string = 'en', fallback = '--') {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-GB'
  const key = `${locale}-datetime`
  if (!dateTimeFormatterCache[key]) {
    dateTimeFormatterCache[key] = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }

  if (value === null || value === undefined || value === '') return fallback
  const dateValue = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(dateValue.getTime())) return fallback
  return dateTimeFormatterCache[key].format(dateValue)
}

/** True when a value can be turned into a usable Date. */
export function isValidDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === '') return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

/** Format a Date for a <input type="datetime-local"> value in LOCAL wall-clock
 *  time. Using toISOString() here shifts every value by the UTC offset (-7h in
 *  Vietnam) and, because the input is read back as local time, corrupts the
 *  stored timestamp a further 7 hours on every save. */
export function toDateTimeLocalValue(value: string | number | Date | null | undefined) {
  if (!isValidDate(value)) return ''
  const date = value instanceof Date ? value : new Date(value as string | number)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Inverse of toDateTimeLocalValue: read a datetime-local value back into an
 *  ISO string, returning null instead of throwing on a cleared/partial input. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function formatCurrencyInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return Number(digitsOnly).toLocaleString('vi-VN')
}

// Keep in sync with parseCurrencyToNumber in lib/server/data-store.ts.
// The sign and the decimal separator must survive: stripping them turns
// refunds into revenue and inflates decimal amounts by 10x/100x.
export function parseCurrencyToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let text = value.trim().replace(/[^\d,.\-]/g, '')
  const negative = text.startsWith('-')
  text = text.replace(/-/g, '')

  const decimalAt = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'))
  const fractionLength = decimalAt === -1 ? 0 : text.length - decimalAt - 1

  if (decimalAt !== -1 && fractionLength > 0 && fractionLength <= 2) {
    text = `${text.slice(0, decimalAt).replace(/[.,]/g, '')}.${text.slice(decimalAt + 1)}`
  } else {
    text = text.replace(/[.,]/g, '')
  }

  const numeric = Number(text)
  if (!Number.isFinite(numeric)) return 0
  return negative ? -numeric : numeric
}

export function formatCurrencyFromNumber(amount: number) {
  if (!Number.isFinite(amount)) return ''
  // Negative amounts are legitimate (refunds, credit notes) and must render as
  // such rather than being clamped to zero.
  const rounded = Math.round(amount)
  const formatted = Math.abs(rounded).toLocaleString('vi-VN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })
  return `${rounded < 0 ? '-' : ''}₫${formatted}`
}

export function formatCurrencyDisplay(value?: string | number | null, fallback: string = '₫0') {
  if (value === null || value === undefined || value === '') return fallback
  const numeric = typeof value === 'number' ? value : parseCurrencyToNumber(value)
  return formatCurrencyFromNumber(numeric)
}

