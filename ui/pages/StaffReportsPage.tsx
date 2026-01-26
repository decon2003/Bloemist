'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { Users, ShoppingBag, ClipboardList, Search, Filter, Calendar, Settings, X, Save } from 'lucide-react'
import { StaffCheckIn, StaffProfile, User } from '@/lib/types'
import { formatDateTime, parseCurrencyToNumber, formatCurrencyFromNumber, formatCurrencyInput } from '@/lib/utils'
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

interface StaffReportRow {
  profile: StaffProfile & { baseSalary?: string; commissionRate?: number }
  checkins: number
  orders: number
  tasks: number
  tasksInProgress: number
  tasksCompleted: number
  salary: number
  commissionAmount: number
  lastSeen: string | null
  lastLocation: string | null
}

function SalaryConfigModal({ user, onClose, onSave }: { user: User, onClose: () => void, onSave: (id: string, data: Partial<User>) => Promise<any> }) {
  const [base, setBase] = useState(user.baseSalary || '0')
  const [rate, setRate] = useState(user.commissionRate?.toString() || '0')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(user.id, {
        baseSalary: base.replace(/\D/g, ''), // Ensure clean number string
        commissionRate: parseFloat(rate)
      })
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Salary Configuration</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Staff Member</label>
            <p className="text-lg font-semibold">{user.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Base Salary (VND)</label>
            <input
              value={formatCurrencyInput(base)}
              onChange={(e) => setBase(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Commission Rate (%)</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              step="0.1"
            />
            <p className="text-xs text-gray-500 mt-1">Applied to sales orders or completed tasks.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StaffReportsPage() {
  const { lang, t } = useLocale()
  const { user } = useAuth()
  const { tasks, checkins, users, orders, updateUser } = useAppData()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [editingConfigUser, setEditingConfigUser] = useState<User | null>(null)

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
    const base = new Map<string, StaffReportRow>()

    // Initialize with all users
    users.forEach((profile: User) => {
      base.set(profile.id, {
        profile: {
          id: profile.id,
          name: profile.name,
          title: profile.role === 'florist' ? 'Florist' : profile.role === 'sales' ? 'Sales' : 'Admin',
          specialty: profile.role as any,
          baseSalary: profile.baseSalary,
          commissionRate: profile.commissionRate,
        },
        checkins: 0,
        orders: 0,
        tasks: 0,
        tasksInProgress: 0,
        tasksCompleted: 0,
        salary: 0,
        commissionAmount: 0,
        lastSeen: null,
        lastLocation: null,
      })
    })

    // Process check-ins
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
          orders: 0,
          tasks: 0,
          tasksInProgress: 0,
          tasksCompleted: 0,
          salary: 0,
          commissionAmount: 0,
          lastSeen: null,
          lastLocation: null,
        })
      }

      const record = base.get(entry.staffId)
      if (!record) return

      record.checkins += 1
      record.orders += entry.ordersTouched
      record.tasks += entry.completedTasks

      if (!record.lastSeen || new Date(entry.timestamp).getTime() > new Date(record.lastSeen).getTime()) {
        record.lastSeen = entry.timestamp
        record.lastLocation = entry.locationLabel
      }
    })

    // Calculate Salary & Commission
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59)

    const relevantOrders = orders.filter(o => {
      const d = new Date(o.createdAt)
      return d >= startOfMonth && d <= endOfMonth
    })

    // Process Sales Commission
    relevantOrders.forEach(order => {
      if (!order.createdById) return
      const record = base.get(order.createdById)
      if (record) {
        const userRev = parseCurrencyToNumber(order.sellingPrice || order.total)
        const rate = record.profile.commissionRate || 0
        record.commissionAmount += userRev * (rate / 100)
      }
    })

    // Process Florist Commission
    const relevantTasks = tasks.filter(t => {
      if (t.status !== 'COMPLETED' || !t.completedAt) return false
      const d = new Date(t.completedAt)
      return d >= startOfMonth && d <= endOfMonth
    })

    relevantTasks.forEach(task => {
      if (!task.assigneeId) return
      const record = base.get(task.assigneeId)
      if (record) {
        const price = parseCurrencyToNumber(task.price || '0')
        const rate = record.profile.commissionRate || 0
        record.commissionAmount += price * (rate / 100)
      }
    })

    return Array.from(base.values())
      .map((record) => {
        const activeAssignment = taskAssignments.get(record.profile.id) || {
          inProgress: record.tasksInProgress,
          completed: record.tasksCompleted,
        }

        const baseSal = parseCurrencyToNumber(record.profile.baseSalary || '0')
        const totalSalary = baseSal + record.commissionAmount

        return {
          ...record,
          tasksInProgress: activeAssignment.inProgress,
          tasksCompleted: activeAssignment.completed,
          salary: totalSalary
        }
      })
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name))
  }, [monthEntries, taskAssignments, users, orders, tasks, selectedDate])

  const totals = useMemo(
    () =>
      staffReports.reduce(
        (acc, row) => {
          acc.headcount += 1
          acc.orders += row.orders
          acc.tasks += row.tasks
          return acc
        },
        { headcount: 0, orders: 0, tasks: 0 },
      ),
    [staffReports],
  )

  const filteredStaffReports = useMemo(
    () =>
      staffReports.filter((row) => {
        return !searchTerm || row.profile.name.toLowerCase().includes(searchTerm.toLowerCase())
      }),
    [staffReports, searchTerm],
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

  const handleOpenConfig = (userId: string) => {
    const u = users.find(u => u.id === userId)
    if (u) setEditingConfigUser(u)
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      {editingConfigUser && (
        <SalaryConfigModal
          user={editingConfigUser}
          onClose={() => setEditingConfigUser(null)}
          onSave={updateUser}
        />
      )}

      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{t('staffReports.subtitle')}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{t('staffReports.title')}</h1>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      {/* Main Table Section */}
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
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground cursor-pointer">
              <Calendar className="h-4 w-4" />
              <input
                type="date"
                value={dateInputValue}
                onChange={(event) => handleDateChange(event.target.value)}
                className="bg-transparent text-sm text-foreground focus:outline-none"
              />
            </label>
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
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.checkins', 'Check-ins')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.orders')}</th>
                  <th className="px-4 py-3 font-medium">{t('staffReports.columns.tasksInCharge', 'Tasks in charge')}</th>
                  <th className="px-4 py-3 font-medium">Estimated Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaffReports.map((row) => (
                  <tr key={row.profile.id} className="text-foreground hover:bg-gray-50/50">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{roleLabel(row.profile.specialty)}</td>
                    <td className="px-4 py-4 align-top font-medium">
                      {row.checkins}
                    </td>
                    <td className="px-4 py-4 align-top">{row.orders}</td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold">
                        {row.tasksInProgress}/{row.tasksCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('staffReports.tasksBreakdown', 'In progress / Completed')}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-green-600">{formatCurrencyFromNumber(row.salary)}</p>
                          <p className="text-xs text-muted-foreground">
                            Base: {formatCurrencyFromNumber(parseCurrencyToNumber(row.profile.baseSalary || '0'))} • Comm: {row.profile.commissionRate || 0}%
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenConfig(row.profile.id)}
                          className="rounded-full p-1 hover:bg-gray-200 text-gray-500"
                          title="Configure Salary"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
