'use client'

import DateCarousel from './date-carousel'
import { DAY_IN_MS, getDateKey, getStartOfDay } from '@/lib/date-utils'

export type DateFilterMode = 'range' | 'carousel'
export type DateRange = { from: string; to: string }

interface DateFilterSwitcherProps {
  label: string
  mode: DateFilterMode
  onModeChange: (mode: DateFilterMode) => void
  showModeToggle?: boolean
  selectedDate: string
  onSelectDate: (value: string) => void
  range: DateRange
  onRangeChange: (value: DateRange) => void
  modeLabels: { range: string; carousel: string }
  rangeLabels: { from: string; to: string }
  quickLabels: { today: string; tomorrow: string; dayAfter: string; threeDays: string; allDays: string }
  calendarLabel?: string
  clearLabel?: string
  todayLabel?: string
  weekDayLabels?: string[]
  locale?: string
}

const getOffsetDateKey = (daysFromToday: number) => {
  const base = getStartOfDay(new Date())
  return getDateKey(new Date(base.getTime() + daysFromToday * DAY_IN_MS))
}

export function DateFilterSwitcher({
  label,
  mode,
  onModeChange,
  selectedDate,
  onSelectDate,
  range,
  onRangeChange,
  modeLabels,
  rangeLabels,
  quickLabels,
  calendarLabel,
  clearLabel,
  todayLabel,
  weekDayLabels,
  locale,
  showModeToggle = true,
}: DateFilterSwitcherProps) {
  const quickOptions = [
    { key: 'today', from: getOffsetDateKey(0), to: getOffsetDateKey(0), label: quickLabels.today },
    { key: 'tomorrow', from: getOffsetDateKey(1), to: getOffsetDateKey(1), label: quickLabels.tomorrow },
    { key: 'dayAfter', from: getOffsetDateKey(2), to: getOffsetDateKey(2), label: quickLabels.dayAfter },
    { key: 'threeDays', from: getOffsetDateKey(3), to: getOffsetDateKey(3), label: quickLabels.threeDays },
    { key: 'allDays', from: '', to: '', label: quickLabels.allDays },
  ]

  const allowModeChange = showModeToggle

  const handleModeChange = (nextMode: DateFilterMode) => {
    if (!allowModeChange) return

    onModeChange(nextMode)
    if (nextMode === 'range') {
      onSelectDate('')
      return
    }
    onRangeChange({ from: '', to: '' })
  }

  const handleRangeChange = (value: Partial<DateRange>) => {
    onRangeChange({ ...range, ...value })
    onSelectDate('')
  }

  const isQuickActive = (from: string, to: string) => range.from === from && range.to === to

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white/80 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
        </div>
        {showModeToggle && (
          <div className="inline-flex items-center rounded-full border border-border bg-white p-1 text-xs font-semibold text-foreground">
            <button
              type="button"
              onClick={() => handleModeChange('range')}
              className={`rounded-full px-3 py-1.5 transition ${
                mode === 'range' ? 'bg-primary text-white shadow-sm' : 'hover:bg-muted'
              }`}
            >
              {modeLabels.range}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('carousel')}
              className={`rounded-full px-3 py-1.5 transition ${
                mode === 'carousel' ? 'bg-primary text-white shadow-sm' : 'hover:bg-muted'
              }`}
            >
              {modeLabels.carousel}
            </button>
          </div>
        )}
      </div>

      {mode === 'range' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  if (allowModeChange) {
                    onModeChange('range')
                  }
                  onSelectDate('')
                  onRangeChange({ from: option.from, to: option.to })
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isQuickActive(option.from, option.to)
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-border bg-white text-foreground hover:bg-muted'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{rangeLabels.from}</span>
              <input
                type="date"
                value={range.from}
                onChange={(event) => handleRangeChange({ from: event.target.value })}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{rangeLabels.to}</span>
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(event) => handleRangeChange({ to: event.target.value })}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        </div>
      ) : (
        <DateCarousel
          label={label}
          clearLabel={clearLabel}
          calendarLabel={calendarLabel}
          todayLabel={todayLabel}
          weekDayLabels={weekDayLabels}
          locale={locale}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onClear={() => onSelectDate('')}
        />
      )}
    </div>
  )
}
