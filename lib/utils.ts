import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const dateTimeFormatterCache: Record<string, Intl.DateTimeFormat> = {}

export function formatDateTime(value: string | number | Date, lang: string = 'en') {
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

  const dateValue = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  return dateTimeFormatterCache[key].format(dateValue)
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

export function parseCurrencyToNumber(value: string) {
  if (!value) return 0
  const numeric = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

export function formatCurrencyFromNumber(amount: number) {
  if (!Number.isFinite(amount)) return ''
  const sanitized = Math.max(Math.round(amount), 0)
  const formatted = sanitized.toLocaleString('vi-VN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })
  return `₫${formatted}`
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
