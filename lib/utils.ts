import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Upload ceiling for task completion photos, shared by the client and the API
 *  route. Proof photos are base64-inlined into a Postgres text column (~1.37x
 *  inflation) and the database is on a small free tier, so this is a storage
 *  limit, not just a UX one. */
export const MAX_COMPLETION_PHOTO_BYTES = 2 * 1024 * 1024

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

/** Split formatDateTime output into date and time parts without relying on a
 *  locale-specific comma - vi-VN emits no comma, which silently blanked the
 *  check-in/check-out columns. */
export function formatDateTimeParts(
  value: string | number | Date | null | undefined,
  lang: string = 'en',
  fallback = '--',
) {
  const formatted = formatDateTime(value, lang, '')
  if (!formatted) return { date: fallback, time: fallback }

  const match = formatted.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
  if (!match) return { date: formatted, time: fallback }

  const time = match[1]
  const date = formatted.replace(time, '').replace(/[,\s]+$/, '').replace(/^[,\s]+/, '').trim()
  return { date: date || fallback, time }
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

export function calculateDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusKm * c
}

export function formatCurrencyInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return Number(digitsOnly).toLocaleString('en-US')
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

export const fileToDataUrl = (file: File | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
