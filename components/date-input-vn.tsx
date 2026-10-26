'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// The browser's own date field shows the device's format (10/22/2026 on an
// English (US) phone). These always read dd/mm/yyyy; the calendar button still
// opens the device's date picker. Values stay "YYYY-MM-DD" like <input type="date">.

const toVn = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

/** "24/10/2026" or "24102026" -> "2026-10-24"; null when not a real date. */
export function parseVnDate(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 2000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Digits typed so far, shown as dd/mm/yyyy. */
const mask = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

export function DateInputVN({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}) {
  const [text, setText] = useState(toVn(value))
  const pickerRef = useRef<HTMLInputElement>(null)
  useEffect(() => setText(toVn(value)), [value])

  const accept = (iso: string | null) => iso !== null && (!min || iso >= min) && (!max || iso <= max)

  return (
    <div className={cn('relative', className?.includes('w-full') ? 'w-full' : 'inline-block')}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const next = mask(e.target.value)
          setText(next)
          const iso = parseVnDate(next)
          if (accept(iso)) onChange(iso!)
        }}
        onBlur={() => {
          if (!text.trim()) {
            if (value) onChange('')
            return
          }
          const iso = parseVnDate(text)
          if (!accept(iso)) setText(toVn(value))
        }}
        className={cn(className, 'pr-9 tabular-nums')}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Chọn ngày"
        onClick={() => {
          const input = pickerRef.current
          if (!input) return
          if ('showPicker' in input && typeof input.showPicker === 'function') input.showPicker()
          else input.click()
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {/* Only opens the device's calendar; what is shown is the field above. */}
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  )
}

/** Month picker ("Tháng 10" / "2026"), value "YYYY-MM". */
export function MonthInputVN({
  value,
  onChange,
  max,
  className,
}: {
  value: string
  onChange: (value: string) => void
  max?: string
  className?: string
}) {
  const [year, month] = value.split('-')
  const lastYear = Number((max ?? `${new Date().getFullYear() + 1}`).slice(0, 4))
  const years = Array.from({ length: Math.max(1, lastYear - 2024 + 1) }, (_, i) => String(2024 + i))
  const set = (y: string, m: string) => {
    let next = `${y}-${m}`
    if (max && next > max) next = max
    onChange(next)
  }
  return (
    <div className="flex gap-2">
      <select value={month} onChange={(e) => set(year, e.target.value)} className={className} aria-label="Tháng">
        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
          <option key={m} value={m} disabled={Boolean(max && `${year}-${m}` > max)}>
            Tháng {Number(m)}
          </option>
        ))}
      </select>
      <select value={year} onChange={(e) => set(e.target.value, month)} className={className} aria-label="Năm">
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
