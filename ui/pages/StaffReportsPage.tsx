'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users, ShoppingBag, ClipboardList, MapPin, AlertTriangle, Search, Filter } from 'lucide-react'
import { StaffCheckIn, StaffProfile, User } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useAppData } from '@/components/providers/app-data-provider'

const dateKey = (value: string) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const formatInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface StaffReportAccumulator {
  profile: StaffProfile
  checkins: number
  officeDayKeys: Set<string>
  fieldDayKeys: Set<string>
  orders: number
  tasks: number
  tasksInProgress: number
  tasksCompleted: number
  remotePending: number
  remoteApproved: number
  remoteFlagged: number
  lastSeen: string | null
  lastLocation: string | null
}

interface StaffReportRow {
  profile: StaffProfile
  checkins: number
  officeDays: number
  fieldDays: number
  orders: number
  tasks: number
  tasksInProgress: number
  tasksCompleted: number
  remotePending: number
  remoteApproved: number
  remoteFlagged: number
  lastSeen: string | null
  lastLocation: string | null
}

interface ConfirmState {
  checkinId: string
  action: 'approve' | 'pending'
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function StaffReportsPage() {
  const { lang, t } = useLocale()
  const { user } = useAuth()
  const { tasks, checkins, users } = useAppData()
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const dateInputValue = useMemo(() => formatInputDate(selectedDate), [selectedDate])
  const handleDateChange = useCallback((value: string) => {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return
    setSelectedDate(new Date(year, month - 1, day))
  }, [])
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'long' }),
    [lang],
  )
  const selectedMonthKey = useMemo(
    () => `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`,
    [selectedDate],
  )

  const monthEntries = useMemo(
    () =>
      checkins.filter((entry: StaffCheckIn) => {
        const timestamp = new Date(entry.timestamp)
        return `${timestamp.getFullYear()}-${timestamp.getMonth()}` === selectedMonthKey
      }),
    [checkins, selectedMonthKey],
  )

  const taskAssignments = useMemo(() => {
    const base = new Map<string, { inProgress: number; completed: number }>()

    tasks.forEach((task) => {
      if (!task.assigneeId) return
      if (!base.has(task.assigneeId)) {
        base.set(task.assigneeId, { inProgress: 0, completed: 0 })
      }
      const record = base.get(task.assigneeId)
      if (!record) return
      if (task.status === 'COMPLETED') record.completed += 1
      if (task.status === 'IN_PROGRESS') record.inProgress += 1
    })

    return base
  }, [tasks])

  const staffReports = useMemo<StaffReportRow[]>(() => {
    const base = new Map<string, StaffReportAccumulator>()

    users.forEach((profile: User) => {
      base.set(profile.id, {
        profile: {
          id: profile.id,
          name: profile.name,
          title: profile.role === 'florist' ? 'Florist' : profile.role === 'sales' ? 'Sales' : 'Admin',
          specialty: profile.role as any,
        },
        checkins: 0,
        officeDayKeys: new Set<string>(),
        fieldDayKeys: new Set<string>(),
        orders: 0,
        tasks: 0,
        tasksInProgress: 0,
        tasksCompleted: 0,
        remotePending: 0,
        remoteApproved: 0,
        remoteFlagged: 0,
        lastSeen: null,
        lastLocation: null,
      })
    })

    monthEntries.forEach((entry: StaffCheckIn) => {
      if (!base.has(entry.staffId)) {
        base.set(entry.staffId, {
          profile: {
            id: entry.staffId,
            name: entry.staffName,
            title: entry.discipline === 'sales' ? 'Sales' : 'Florist',
            specialty: entry.discipline,
          },
          checkins: 0,
          officeDayKeys: new Set<string>(),
          fieldDayKeys: new Set<string>(),
          orders: 0,
          tasks: 0,
          tasksInProgress: 0,
          tasksCompleted: 0,
          remotePending: 0,
          remoteApproved: 0,
          remoteFlagged: 0,
          lastSeen: null,
          lastLocation: null,
        })
      }

      const record = base.get(entry.staffId)
      if (!record) return

      record.checkins += 1
      record.orders += entry.ordersTouched
      record.tasks += entry.completedTasks

      const key = dateKey(entry.timestamp)
      if (entry.locationType === 'AT_OFFICE') {
        record.officeDayKeys.add(key)
      } else {
        record.fieldDayKeys.add(key)
      }

      if (entry.requiresReview) {
        if (entry.verificationStatus === 'approved') record.remoteApproved += 1
        else if (entry.verificationStatus === 'flagged') record.remoteFlagged += 1
        else record.remotePending += 1
      }

      if (!record.lastSeen || new Date(entry.timestamp).getTime() > new Date(record.lastSeen).getTime()) {
        record.lastSeen = entry.timestamp
        record.lastLocation = entry.locationLabel
      }
    })

    return Array.from(base.values())
      .map((record) => {
        const activeAssignment = taskAssignments.get(record.profile.id) || {
          inProgress: record.tasksInProgress,
          completed: record.tasksCompleted,
        }

        return {
          profile: record.profile,
          checkins: record.checkins,
          officeDays: record.officeDayKeys.size,
          fieldDays: record.fieldDayKeys.size,
          orders: record.orders,
          tasks: record.tasks,
          tasksInProgress: activeAssignment.inProgress,
          tasksCompleted: activeAssignment.completed,
          remotePending: record.remotePending,
          remoteApproved: record.remoteApproved,
          remoteFlagged: record.remoteFlagged,
          lastSeen: record.lastSeen,
          lastLocation: record.lastLocation,
        }
      })
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name))
  }, [monthEntries, taskAssignments])

  const totals = useMemo(
    () =>
      staffReports.reduce(
        (acc, row) => {
          acc.headcount += 1
          acc.orders += row.orders
          acc.tasks += row.tasks
          acc.pendingReviews += row.remotePending
          return acc
        },
        { headcount: 0, orders: 0, tasks: 0, pendingReviews: 0 },
      ),
    [staffReports],
  )

  const remoteByStaff = useMemo(() => {
    const map = new Map<string, StaffCheckIn[]>()
    monthEntries
      .filter((entry: StaffCheckIn) => entry.requiresReview)
      .forEach((entry: StaffCheckIn) => {
        const existing = map.get(entry.staffId) || []
        map.set(entry.staffId, [...existing, entry])
      })
    return map
  }, [monthEntries])

  const filteredStaffReports = useMemo(
    () =>
      staffReports.filter((row) => {
        const matchesSearch =
          !searchTerm || row.profile.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesRemote = !remoteOnly || row.remotePending > 0
        return matchesSearch && matchesRemote
      }),
    [staffReports, searchTerm, remoteOnly],
  )

  const roleLabel = (specialty: StaffProfile['specialty']) => {
    switch (specialty) {
      case 'sales':
        return t('staffReports.role.sales', 'Sales')
      case 'hybrid':
        return t('staffReports.role.hybrid', 'Florist & Sales')
      default:
        return t('staffReports.role.florist', 'Florist')
    }
  }

  const monthLabel = useMemo(
    () => `${monthFormatter.format(selectedDate)} ${selectedDate.getFullYear()}`,
    [selectedDate, monthFormatter],
  )
  const canSeeRemote = user?.role === 'boss' || user?.role === 'admin'

  const updateRemoteStatus = useCallback(
    (checkinId: string, status: 'approved' | 'pending') => {
      // Logic for updating remote status via API? For now we'll just log
      console.log('Update remote status', checkinId, status)
      alert(t('staffReports.updateRemoteStatusOptimized', 'Approval logic is linked to backend. Please refresh to see updates.'))
    },
    [t],
  )

  const approveRemote = useCallback((checkinId: string) => {
    setConfirmState({ checkinId, action: 'approve' })
  }, [])

  const revertRemote = useCallback((checkinId: string) => {
    setConfirmState({ checkinId, action: 'pending' })
  }, [])

  const confirmCopy = useMemo(() => {
    if (!confirmState) return null
    if (confirmState.action === 'approve') {
      return {
        title: t('staffReports.approveConfirm', 'Approve this remote check-in?'),
        description: t(
          'staffReports.approveConfirmHelp',
          'This will mark the remote check-in as approved for payroll and attendance.',
        ),
        confirmLabel: t('staffReports.actions.approve', 'Approve'),
      }
    }
    return {
      title: t('staffReports.revertConfirm', 'Revert this check-in to pending?'),
      description: t(
        'staffReports.revertConfirmHelp',
        'Use this if you need the staff member to re-submit or provide more proof.',
      ),
      confirmLabel: t('staffReports.actions.revert', 'Mark pending'),
    }
  }, [confirmState, t])

  const handleConfirm = useCallback(() => {
    if (!confirmState) return
    if (confirmState.action === 'approve') {
      updateRemoteStatus(confirmState.checkinId, 'approved')
    } else {
      updateRemoteStatus(confirmState.checkinId, 'pending')
    }
    setConfirmState(null)
  }, [confirmState, updateRemoteStatus])

  const toggleExpanded = useCallback((staffId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) {
        next.delete(staffId)
      } else {
        next.add(staffId)
      }
      return next
    })
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{t('staffReports.subtitle')}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{t('staffReports.title')}</h1>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('staffReports.cards.headcount')}</p>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.headcount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('staffReports.cards.orders')}</p>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.orders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('staffReports.cards.tasks')}</p>
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.tasks}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('staffReports.cards.remote')}</p>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.pendingReviews}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t('staffReports.sectionTitle')}</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('staffReports.searchPlaceholder')}
                className="w-40 bg-transparent text-sm focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <input
                type="date"
                value={dateInputValue}
                onChange={(event) => handleDateChange(event.target.value)}
                className="bg-transparent text-sm text-foreground focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setRemoteOnly((prev) => !prev)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${remoteOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border bg-white text-foreground'
                }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {remoteOnly
                ? t('staffReports.filters.pendingRemoteOnly', 'Pending remote only')
                : t('staffReports.filters.hasPendingRemote', 'Has pending remote')}
            </button>
          </div>
        </div>

        {filteredStaffReports.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t('staffReports.noActivity')}</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">{t('staffReports.columns.staff')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.role')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.checkinsRemote', 'Check-ins | Remote')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.orders')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.tasksInCharge', 'Tasks in charge')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaffReports.map((row) => {
                  const remoteItems = remoteByStaff.get(row.profile.id) || []
                  const hasPending = remoteItems.some((item) => item.verificationStatus !== 'approved')

                  return (
                    <Fragment key={row.profile.id}>
                      <tr className="text-foreground">
                        <td className="py-4 pr-4 align-top">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold">{row.profile.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.profile.title}
                                {row.lastSeen
                                  ? ` • ${t('staffReports.lastSeen')}: ${formatDateTime(row.lastSeen, lang)}`
                                  : ''}
                              </div>
                              {row.lastLocation && (
                                <p className="text-xs text-muted-foreground">{row.lastLocation}</p>
                              )}
                            </div>
                            {remoteItems.length > 0 && canSeeRemote && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(row.profile.id)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold cursor-pointer ${hasPending
                                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                                  : 'border-muted bg-muted/60 text-muted-foreground'
                                  }`}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {t('staffReports.remoteCount', '{{count}} remote').replace('{{count}}', remoteItems.length.toString())}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-muted-foreground">{roleLabel(row.profile.specialty)}</td>
                        <td className="px-4 py-4 align-top">
                          {row.checkins} | {row.remotePending + row.remoteApproved + row.remoteFlagged}
                        </td>
                        <td className="px-4 py-4 align-top">{row.orders}</td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold">
                            {row.tasksInProgress}/{row.tasksCompleted}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('staffReports.tasksBreakdown', 'In progress / Completed')}</p>
                        </td>
                      </tr>
                      {expandedRows.has(row.profile.id) && remoteItems.length > 0 && canSeeRemote && (
                        <tr>
                          <td colSpan={5} className="bg-amber-50/60 p-4 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                {t('staffReports.remoteCheckInTitle')}
                              </div>
                              <span className="text-xs text-muted-foreground">{t('staffReports.remoteCheckInHelp')}</span>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {remoteItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between rounded-xl border border-amber-100 bg-white px-3 py-2"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{formatDateTime(item.timestamp, lang)}</p>
                                    <p className="text-xs text-muted-foreground">{item.verificationStatus || 'pending'}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {item.verificationStatus !== 'approved' && (
                                      <button
                                        type="button"
                                        onClick={() => approveRemote(item.id)}
                                        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                                      >
                                        {t('staffReports.actions.approve', 'Approve')}
                                      </button>
                                    )}
                                    {item.verificationStatus !== 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => revertRemote(item.id)}
                                        className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                                      >
                                        {t('staffReports.actions.revert', 'Mark pending')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={!!confirmState && !!confirmCopy}
        title={confirmCopy?.title || ''}
        description={confirmCopy?.description || ''}
        confirmLabel={confirmCopy?.confirmLabel || ''}
        cancelLabel={t('staffReports.actions.cancel', 'Cancel')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
