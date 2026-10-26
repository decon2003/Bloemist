'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DateInputVN } from '@/components/date-input-vn'

// The browser's own <input type="time"> / "datetime-local" follow the device
// language, so a phone or PC set to English (US) shows 03:00 PM. These inputs
// are always 24-hour (HH:mm).

/** "1530", "15:30", "15h30", "9" -> "15:30" / "09:00"; null when not a valid time. */
export function normalizeTime24(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  if (!digits || digits.length > 4) return null
  const [h, m] =
    digits.length <= 2 ? [digits, '0'] : digits.length === 3 ? [digits.slice(0, 1), digits.slice(1)] : [digits.slice(0, 2), digits.slice(2)]
  const hours = Number(h)
  const minutes = Number(m)
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** A 24-hour time field: value and onChange use "HH:mm" ('' when empty). */
export function TimeInput24({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'HH:mm',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        let next = e.target.value.replace(/[^\d:]/g, '')
        // Typing "1530" shows "15:30" as soon as the minutes start.
        if (/^\d{3,4}$/.test(next)) next = `${next.slice(0, 2)}:${next.slice(2)}`
        setText(next)
        if (/^\d{2}:\d{2}$/.test(next)) {
          const time = normalizeTime24(next)
          if (time) onChange(time)
        }
      }}
      onBlur={() => {
        if (!text.trim()) {
          if (value) onChange('')
          return
        }
        const time = normalizeTime24(text)
        if (time) {
          setText(time)
          if (time !== value) onChange(time)
        } else {
          setText(value)
        }
      }}
      className={cn('tabular-nums', className)}
    />
  )
}

/** Date + 24-hour time. value/onChange use the "YYYY-MM-DDTHH:mm" form of
 *  <input type="datetime-local"> ('' when either part is missing), so it can
 *  replace one without other changes. */
export function DateTimeInput24({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const [date, setDate] = useState(value.slice(0, 10))
  const [time, setTime] = useState(value.slice(11, 16))
  useEffect(() => {
    setDate(value.slice(0, 10))
    setTime(value.slice(11, 16))
  }, [value])

  const emit = (nextDate: string, nextTime: string) => onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : '')

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <DateInputVN
          value={date}
          disabled={disabled}
          onChange={(next) => {
            setDate(next)
            emit(next, time)
          }}
          className={cn(className, 'w-full')}
        />
      </div>
      <TimeInput24
        value={time}
        disabled={disabled}
        onChange={(next) => {
          setTime(next)
          emit(date, next)
        }}
        className={cn(className, 'w-20 shrink-0 text-center')}
      />
    </div>
  )
}
