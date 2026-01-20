'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { DAY_IN_MS, getDateKey, getStartOfDay } from '@/lib/date-utils'

interface DateCarouselProps {
  label: string
  selectedDate: string
  onSelectDate: (value: string) => void
  onClear: () => void
  calendarLabel?: string
  clearLabel?: string
  todayLabel?: string
  weekDayLabels?: string[]
  locale?: string
}

const formatDayName = (date: Date, locale?: string, weekDayLabels?: string[]) => {
  if (weekDayLabels?.length === 7) {
    const day = date.getDay()
    const mondayFirstIndex = day === 0 ? 6 : day - 1
    return weekDayLabels[mondayFirstIndex]
  }

  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}

const formatDayNumber = (date: Date, locale?: string) =>
  new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)

const getInitialStart = () => {
  const today = getStartOfDay(new Date())
  const day = today.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return new Date(today.getTime() + offset * DAY_IN_MS)
}

const getDateFromKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null
  return getStartOfDay(new Date(year, month - 1, day))
}

export default function DateCarousel({
  label,
  selectedDate,
  onSelectDate,
  onClear,
  calendarLabel = 'Open calendar',
  clearLabel = 'All dates',
  todayLabel = 'Today',
  weekDayLabels,
  locale,
}: DateCarouselProps) {
  const [startDate, setStartDate] = useState<Date>(getInitialStart)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const todayKey = useMemo(() => getDateKey(new Date()), [])

  const visibleDays = useMemo(() => {
    return Array.from({ length: 14 }).map((_, index) =>
      getStartOfDay(new Date(startDate.getTime() + index * DAY_IN_MS)),
    )
  }, [startDate])

  const handleDatePickerClick = () => {
    const input = dateInputRef.current
    if (!input) return
    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.click()
  }

  const handleDateChange = (value: string) => {
    if (!value) return
    onSelectDate(getDateKey(value))
  }

  const handleJumpToToday = () => {
    setStartDate(getInitialStart())
    onSelectDate(todayKey)
  }

  useEffect(() => {
    if (!selectedDate) return
    const selected = getDateFromKey(selectedDate)
    if (!selected) return
    const desiredStart = getStartOfDay(new Date(selected.getTime() - DAY_IN_MS))
    if (desiredStart.getTime() === startDate.getTime()) return
    setStartDate(desiredStart)
  }, [selectedDate, startDate])
  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const active = container.querySelector<HTMLButtonElement>(`[data-date-key="${selectedDate}"]`)
    if (!active) {
      container.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    const target = active.offsetLeft - container.clientWidth / 2 + active.offsetWidth / 2
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [startDate, selectedDate])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <button
            type="button"
            onClick={handleDatePickerClick}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-border bg-white text-foreground transition hover:border-primary"
            aria-label={calendarLabel}
          >
            <Calendar className="h-4 w-4" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(event) => handleDateChange(event.target.value)}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-primary">
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer underline"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={handleJumpToToday}
            className="cursor-pointer underline"
          >
            {todayLabel}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStartDate((prev) => new Date(prev.getTime() - DAY_IN_MS * visibleDays.length))
            onSelectDate('')
          }}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:border-primary"
          aria-label="Previous dates"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={listRef} className="flex flex-1 items-stretch gap-1 overflow-x-auto px-1 py-2 lg:gap-2">
          {visibleDays.map((date) => {
            const dateKey = getDateKey(date)
            const isSelected = selectedDate === dateKey
            const isToday = dateKey === todayKey
            return (
              <button
                key={dateKey}
                data-date-key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={`flex min-w-[78px] cursor-pointer flex-col items-center rounded-2xl border px-2 py-1.5 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-primary lg:min-w-[92px] lg:px-3 lg:py-2 lg:text-sm ${
                  isSelected
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-border bg-white text-foreground hover:border-primary/60'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide lg:text-xs">
                  {isToday ? todayLabel : formatDayName(date, locale, weekDayLabels)}
                </span>
                <span className="text-sm font-bold lg:text-base">
                  {formatDayNumber(date, locale)}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setStartDate((prev) => new Date(prev.getTime() + DAY_IN_MS * visibleDays.length))
            onSelectDate('')
          }}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:border-primary"
          aria-label="Next dates"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
