'use client'

import { useMemo } from 'react'
import { ClipboardList, ShoppingBag, DollarSign, CalendarClock } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocale } from '@/components/providers/locale-provider'
import { useAppData } from '@/components/providers/app-data-provider'

export default function BossDashboard() {
  const { t } = useLocale()
  const { orders, tasks, checkins } = useAppData()
  const today = useMemo(() => new Date(), [])
  const weekAgo = useMemo(() => {
    const next = new Date(today)
    next.setDate(today.getDate() - 7)
    return next
  }, [today])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setHours(0, 0, 0, 0)
      day.setDate(today.getDate() - (6 - index))
      return day
    })
  }, [today])

  const monthEntries = useMemo(
    () =>
      checkins.filter((entry) => {
        const stamp = new Date(entry.timestamp)
        return stamp.getFullYear() === today.getFullYear() && stamp.getMonth() === today.getMonth()
      }),
    [today, checkins],
  )

  const totals = useMemo(
    () => ({
      orders: monthEntries.reduce((acc, entry) => acc + entry.ordersTouched, 0),
      tasks: monthEntries.reduce((acc, entry) => acc + entry.completedTasks, 0),
      readyOrders: orders.filter((order) => order.status === 'READY').length,
      weeklyOrders: orders.filter((order) => {
        const receive = new Date(order.receiveTime)
        return receive >= weekAgo && receive <= today
      }).length,
      weeklyRevenue: orders
        .filter((order) => {
          const receive = new Date(order.receiveTime)
          return receive >= weekAgo && receive <= today
        })
        .reduce((acc, order) => acc + parseCurrency(order.total), 0),
    }),
    [monthEntries, orders, today, weekAgo],
  )

  const weeklyData = useMemo(
    () =>
      weekDays.map((day) => {
        const start = new Date(day)
        const end = new Date(day)
        end.setHours(23, 59, 59, 999)

        const dailyOrders = orders.filter((order) => {
          const receive = new Date(order.receiveTime)
          return receive >= start && receive <= end
        })
        const dailyTasks = tasks.filter((task) => {
          const created = new Date(task.createdAt)
          return created >= start && created <= end
        })

        return {
          label: day.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: dailyOrders.reduce((acc, order) => acc + parseCurrency(order.total), 0),
          tasks: dailyTasks.length,
        }
      }),
    [orders, tasks, weekDays],
  )

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{t('dashboard.subtitle')}</p>
        <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.salesWorkload', 'Sales and workload KPIs for this month')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label={t('dashboard.kpis.monthlyOrders', 'Orders touched')}
          value={totals.orders.toString()}
        />
        <KpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label={t('dashboard.kpis.monthlyTasks', 'Tasks completed')}
          value={totals.tasks.toString()}
        />
        <KpiCard
          icon={<CalendarClock className="h-5 w-5" />}
          label={t('dashboard.kpis.weeklyOrders', 'Orders this week')}
          value={totals.weeklyOrders.toString()}
          helper={t('dashboard.kpis.weeklyOrdersHelper', 'Based on receive dates from the last 7 days')}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label={t('dashboard.kpis.weeklyRevenue', 'Weekly sales income')}
          value={`₫${totals.weeklyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          helper={t('dashboard.kpis.revenueHelper', 'Sum of order totals for the current week')}
        />
        <KpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label={t('dashboard.kpis.readyOrders', 'Orders marked ready')}
          value={totals.readyOrders.toString()}
          helper={t('dashboard.kpis.readyOrdersHelper', 'Auto-updates when all linked tasks are ready')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('dashboard.charts.weeklySales', 'Weekly sales')}
          description={t('dashboard.charts.weeklySalesDescription', 'Revenue by receive date in the last 7 days')}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₫${value}`} />
              <Tooltip
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                formatter={(value: any) => `₫${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="sales" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('dashboard.charts.weeklyTasks', 'Weekly tasks')}
          description={t('dashboard.charts.weeklyTasksDescription', 'Tasks created over the last 7 days')}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ stroke: '#2563eb', strokeWidth: 1 }} labelFormatter={(label) => `${label}`} />
              <Line type="monotone" dataKey="tasks" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  helper?: string
}

function KpiCard({ icon, label, value, helper }: KpiCardProps) {
  return (
    <div className="rounded-3xl border border-border bg-white/90 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-primary">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
}

function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-border bg-white/90 p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function parseCurrency(value: string) {
  const numeric = parseFloat(value.replace(/[^0-9.]+/g, ''))
  return Number.isNaN(numeric) ? 0 : numeric
}
