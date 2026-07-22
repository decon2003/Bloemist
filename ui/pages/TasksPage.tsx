'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, MapPin } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import AddTaskDialog from '@/components/tasks/add-task-dialog'
import TaskCard from '@/components/tasks/task-card'
import { DateFilterSwitcher, DateRange } from '@/components/date-filter-switcher'
import { getDateKey } from '@/lib/date-utils'
import { TaskStatus, TaskType } from '@/lib/types'
import { useViewSettings } from '@/components/providers/view-settings-provider'

const statuses: ('ALL' | TaskStatus)[] = ['ALL', 'UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'READY', 'COMPLETED']

export default function TasksPage() {
  const { tasks, isLoading } = useAppData()
  const { lang, t, getTaskStatusLabel } = useLocale()
  const { user } = useAuth()
  const { dateFilterMode } = useViewSettings()
  const [filter, setFilter] = useState<(typeof statuses)[number]>('ALL')
  const [query, setQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [assignedOnly, setAssignedOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TaskType | 'ALL'>('ALL')
  const weekDayLabels = lang === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : undefined
  const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: 'CAM_HOA', label: t('addTask.taskType.camHoa', 'Flower arranging') },
    { value: 'BO_HOA', label: t('addTask.taskType.boHoa', 'Bouquet making') },
    { value: 'SO_CHE', label: t('addTask.taskType.soChe', 'Preparation') },
    { value: 'DON_DEP', label: t('addTask.taskType.donDep', 'Cleanup') },
    { value: 'IN_BIEN', label: t('addTask.taskType.inBien', 'Card printing') },
    { value: 'BOC_HOA', label: t('addTask.taskType.bocHoa', 'Wrapping') },
    { value: 'SHIP_DON', label: t('addTask.taskType.shipDon', 'Delivery') },
  ]

  useEffect(() => {
    if (dateFilterMode === 'range') {
      setSelectedDate('')
    } else {
      setDateRange({ from: '', to: '' })
    }
  }, [dateFilterMode])

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          const matchesStatus = filter === 'ALL' || task.status === filter
          const matchesQuery =
            !query ||
            task.taskTitle.toLowerCase().includes(query.toLowerCase()) ||
            task.customerName.toLowerCase().includes(query.toLowerCase())
          const dateKey = getDateKey(task.dueTime)
          const matchesDate =
            dateFilterMode === 'range'
              ? (!dateRange.from ||
                (dateKey !== null &&
                  dateKey >= dateRange.from &&
                  (!dateRange.to || dateKey <= dateRange.to)))
              : !selectedDate || dateKey === selectedDate
          const matchesAssignee = !assignedOnly || (user?.id ? task.assigneeId === user.id : true)
          const matchesType = typeFilter === 'ALL' || task.type === typeFilter
          return matchesStatus && matchesQuery && matchesDate && matchesAssignee && matchesType
        })
        .sort((taskA, taskB) => {
          const diff = new Date(taskA.dueTime).getTime() - new Date(taskB.dueTime).getTime()
          return sortOrder === 'asc' ? diff : -diff
        }),
    [
      tasks,
      filter,
      query,
      selectedDate,
      dateFilterMode,
      dateRange.from,
      dateRange.to,
      sortOrder,
      assignedOnly,
      user?.id,
      typeFilter,
    ],
  )

  const closeToast = () => setToastMessage(null)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('tasks.heroSubtitle')}</p>
          <h1 className="text-3xl font-bold text-foreground">{t('tasks.heroTitle')}</h1>
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground md:text-right">
          <Link
            href={`/${lang}/checkins`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <MapPin className="h-4 w-4" />
            {t('tasks.checkinCta', 'Open check-in view')}
          </Link>
          <span className="text-xs">{t('tasks.checkinDescription', 'Log attendance and GPS before starting a route.')}</span>
        </div>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white/80 p-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('tasks.searchPlaceholder')}
              className="w-full rounded-2xl border border-border bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-3">
            <DateFilterSwitcher
              label={t('tasks.dateFilter.label', 'Due date')}
              mode={dateFilterMode}
              onModeChange={() => {}}
              showModeToggle={false}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              range={dateRange}
              onRangeChange={setDateRange}
              modeLabels={{
                range: t('dateFilter.mode.range', 'Date range'),
                carousel: t('dateFilter.mode.carousel', 'Date carousel'),
              }}
              rangeLabels={{
                from: t('tasks.dateFilter.from', 'From date'),
                to: t('tasks.dateFilter.to', 'To date (optional)'),
              }}
              quickLabels={{
                today: t('tasks.dateLabels.today', 'Today'),
                tomorrow: t('tasks.dateLabels.tomorrow', 'Tomorrow'),
                dayAfter: t('tasks.dateLabels.dayAfter', 'Day after tomorrow'),
                threeDays: t('tasks.dateLabels.dayMoreAfter', 'In three days'),
                allDays: t('tasks.dateFilter.all', 'All dates'),
              }}
              calendarLabel={t('tasks.dateFilter.openCalendar', 'Pick a date from calendar')}
              clearLabel={t('tasks.dateFilter.all')}
              todayLabel={t('tasks.dateLabels.today', 'Today')}
              weekDayLabels={weekDayLabels}
              locale={lang === 'vi' ? 'vi-VN' : undefined}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === status ? 'bg-primary text-white shadow-sm' : 'border border-border bg-white hover:bg-muted'
                }`}
              >
                {status === 'ALL' ? t('tasks.filter.all') : getTaskStatusLabel(status)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="asc">{t('tasks.sort.soonest')}</option>
              <option value="desc">{t('tasks.sort.latest')}</option>
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TaskType | 'ALL')}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">{t('tasks.filter.all')}</option>
              {taskTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAssignedOnly((prev) => !prev)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                assignedOnly ? 'bg-primary text-white shadow-sm' : 'border border-border bg-white text-foreground hover:bg-muted'
              }`}
            >
              {t('tasks.assignedToMe', 'Assigned to me')}
            </button>
            {assignedOnly && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {user?.name || t('tasks.me', 'Me')}
              </span>
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <div className="flex items-center justify-between gap-2">
            <span>{toastMessage}</span>
            <button onClick={closeToast} className="text-green-700 underline">
              Close
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {t('tasks.loading', 'Loading tasks...')}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {t('tasks.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} href={`/${lang}/tasks/${task.id}`} />
          ))}
        </div>
      )}

      <AddTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={(message) => setToastMessage(message)}
      />

      <button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-primary/90 md:bottom-8 md:right-8"
      >
        <Plus className="h-4 w-4" /> {t('tasks.addTask')}
      </button>
    </div>
  )
}
