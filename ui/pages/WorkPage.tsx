'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, Search } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useViewSettings } from '@/components/providers/view-settings-provider'
import { DateFilterSwitcher, DateRange } from '@/components/date-filter-switcher'
import { ProductCard } from '@/components/orders/product-card'
import { PhotoViewer } from '@/components/photo-viewer'
import { getDateKey } from '@/lib/date-utils'
import { useListParams } from '@/lib/use-list-params'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Florists see this many days back (the server enforces it). */
const STAFF_HISTORY_DAYS = 30
const VN_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const daysAgoKey = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return getDateKey(d)
}
// Vietnam wall clock, whatever the device's time zone.
const vn = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000)
const two = (n: number) => String(n).padStart(2, '0')
const vnDayKey = (iso: string) => vn(iso).toISOString().slice(0, 10)
const vnTime = (iso: string) => {
  const d = vn(iso)
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`
}
const dayHeading = (key: string, todayKey: string) => {
  const d = new Date(`${key}T00:00:00Z`)
  const label = `${VN_WEEKDAYS[d.getUTCDay()]} ${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}`
  const diff = Math.round((d.getTime() - new Date(`${todayKey}T00:00:00Z`).getTime()) / 86_400_000)
  return diff === 0 ? `Hôm nay · ${label}` : diff === 1 ? `Ngày mai · ${label}` : label
}

/** Overdue rows shown before "Xem thêm", so today's work stays near the top. */
const OVERDUE_PREVIEW = 5

const isOpen = (task: Task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED'

/** Work list: one list of products by due time. Florists see the products
 *  assigned to them; managers see everyone's and can narrow to one maker.
 *  Tapping a row opens the product card (samples, note, "Hoàn tất" + photo). */
export default function WorkPage() {
  const { tasks, florists, setTaskScope } = useAppData()
  const { lang, t } = useLocale()
  const { user } = useAuth()
  const { dateFilterMode } = useViewSettings()
  const isManager = user?.role === 'boss' || user?.role === 'admin'

  const [query, setQuery] = useState('')
  const [makerFilter, setMakerFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => getDateKey(new Date()) ?? '')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = getDateKey(new Date()) ?? ''
    return { from: today, to: today }
  })
  useEffect(() => {
    const today = getDateKey(new Date()) ?? ''
    if (dateFilterMode === 'range') {
      setSelectedDate('')
      setDateRange((current) => (current.from ? current : { from: today, to: today }))
    } else {
      setDateRange({ from: '', to: '' })
      setSelectedDate((current) => current || today)
    }
  }, [dateFilterMode])

  const listParams = useListParams({ mode: dateFilterMode, selectedDate, range: dateRange, query })
  const scope = useMemo(
    () => ({
      ...listParams,
      overdue: 1 as const,
      ...(isManager ? (makerFilter ? { assigneeId: makerFilter } : {}) : { mine: 1 as const }),
    }),
    [listParams, isManager, makerFilter],
  )
  useEffect(() => setTaskScope(scope), [scope, setTaskScope])

  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAllOverdue, setShowAllOverdue] = useState(false)
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)

  const todayKey = vnDayKey(new Date().toISOString())
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.dueTime).getTime() - new Date(b.dueTime).getTime()),
    [tasks],
  )
  // Unfinished work from earlier days first, then one group per day.
  const groups = useMemo(() => {
    const out: { key: string; title: string; overdue: boolean; tasks: Task[] }[] = []
    const overdue = sorted.filter((task) => isOpen(task) && vnDayKey(task.dueTime) < todayKey)
    if (overdue.length) out.push({ key: 'overdue', title: 'Quá hạn, chưa xong', overdue: true, tasks: overdue })
    for (const task of sorted) {
      if (overdue.includes(task)) continue
      const key = vnDayKey(task.dueTime)
      const group = out.find((g) => g.key === key)
      if (group) group.tasks.push(task)
      else out.push({ key, title: dayHeading(key, todayKey), overdue: false, tasks: [task] })
    }
    return out
  }, [sorted, todayKey])

  const todo = tasks.filter(isOpen).length
  const doneCount = tasks.filter((task) => task.status === 'COMPLETED').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Công việc</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isManager ? 'Sản phẩm cần làm của cả tiệm, theo giờ giao.' : 'Sản phẩm được giao cho bạn, theo giờ giao.'}
          {' '}Bấm vào một dòng để xem ảnh mẫu, ghi chú và hoàn tất.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo sản phẩm, mã đơn, tên khách"
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <DateFilterSwitcher
        label="Ngày giao"
        mode={dateFilterMode}
        onModeChange={() => { }}
        showModeToggle={false}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        range={dateRange}
        onRangeChange={setDateRange}
        modeLabels={{ range: t('dateFilter.mode.range', 'Khoảng ngày'), carousel: t('dateFilter.mode.carousel', 'Theo ngày') }}
        rangeLabels={{ from: t('tasks.dateFilter.from', 'Từ ngày'), to: t('tasks.dateFilter.to', 'Đến ngày') }}
        quickLabels={{
          today: t('tasks.dateLabels.today', 'Hôm nay'),
          tomorrow: t('tasks.dateLabels.tomorrow', 'Ngày mai'),
          dayAfter: t('tasks.dateLabels.dayAfter', 'Ngày kia'),
          threeDays: t('tasks.dateLabels.dayMoreAfter', '3 ngày nữa'),
          allDays: t('tasks.dateFilter.all', 'Tất cả'),
        }}
        calendarLabel="Chọn ngày giao"
        clearLabel={t('tasks.dateFilter.all', 'Tất cả')}
        todayLabel={t('tasks.dateLabels.today', 'Hôm nay')}
        weekDayLabels={['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']}
        locale="vi-VN"
        minDate={isManager ? undefined : daysAgoKey(STAFF_HISTORY_DAYS)}
        extraFields={
          isManager ? (
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Thợ làm</span>
              <select
                value={makerFilter}
                onChange={(e) => setMakerFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tất cả</option>
                <option value="none">Chưa giao</option>
                {florists.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{todo}</span> cần làm · <span className="font-semibold text-foreground">{doneCount}</span> đã xong
      </p>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
          {isManager ? 'Không có sản phẩm nào trong khoảng này.' : 'Bạn chưa được giao sản phẩm nào trong khoảng này.'}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className={cn('text-sm font-semibold uppercase tracking-wide', group.overdue ? 'text-red-700' : 'text-muted-foreground')}>
              {group.title} <span className="font-normal">({group.tasks.length})</span>
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
              {(group.overdue && !showAllOverdue ? group.tasks.slice(0, OVERDUE_PREVIEW) : group.tasks).map((task) => {
                const open = expanded === task.id
                const done = task.status === 'COMPLETED'
                const cancelled = task.status === 'CANCELLED'
                const late = isOpen(task) && new Date(task.dueTime).getTime() < Date.now()
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : task.id)}
                      aria-expanded={open}
                      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40', (done || cancelled) && 'opacity-60')}
                    >
                      <div className="w-14 shrink-0">
                        <p className={cn('text-lg font-bold tabular-nums', late ? 'text-red-700' : 'text-foreground')}>{vnTime(task.dueTime)}</p>
                        {group.overdue && <p className="text-xs text-red-700">{dayHeading(vnDayKey(task.dueTime), todayKey)}</p>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('font-semibold text-foreground', cancelled && 'line-through')}>
                          {task.taskTitle}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.orderCode ?? '—'} · {task.deliveryType === 'DELIVERY' ? 'Giao hàng' : 'Khách đến lấy'}
                          {isManager ? ` · ${task.assigneeName ?? 'Chưa giao'}` : ''}
                        </p>
                        {task.cardMessage && (
                          <p className="mt-0.5 truncate text-sm text-foreground">Thiệp: <span className="italic">{task.cardMessage}</span></p>
                        )}
                        {task.orderNotes && (
                          <p className="mt-0.5 truncate text-sm text-amber-800">Ghi chú: {task.orderNotes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Đã xong
                          </span>
                        ) : cancelled ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Đã huỷ</span>
                        ) : (
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', late ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800')}>
                            {late ? 'Trễ' : 'Cần làm'}
                          </span>
                        )}
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                      </div>
                    </button>
                    {open && (
                      <div className="space-y-2 border-t border-border bg-muted/20 p-3">
                        <ProductCard
                          task={task}
                          user={user}
                          florists={florists}
                          lang={lang}
                          onViewPhotos={(photos, index) => setViewer({ photos, index })}
                          onOrderChanged={() => { }}
                        />
                        {task.orderId && (
                          <Link href={`/${lang}/orders/${task.orderId}`} className="inline-block px-1 text-sm font-medium text-primary underline">
                            Mở đơn {task.orderCode}
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {group.overdue && !showAllOverdue && group.tasks.length > OVERDUE_PREVIEW && (
              <button type="button" onClick={() => setShowAllOverdue(true)} className="px-1 text-sm font-medium text-primary underline">
                Xem thêm {group.tasks.length - OVERDUE_PREVIEW} việc quá hạn
              </button>
            )}
          </section>
        ))
      )}

      {viewer && <PhotoViewer photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </div>
  )
}
