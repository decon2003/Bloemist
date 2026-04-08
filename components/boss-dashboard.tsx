'use client'

import { useMemo } from 'react'
import {
  DollarSign,
  Clock,
  TrendingUp,
  Package,
  ArrowRight
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Link from 'next/link'
import { useLocale } from '@/components/providers/locale-provider'
import { fetchDashboardStats } from '@/lib/api'
import { useQuery } from '@/lib/query-client'
import { parseCurrencyToNumber, formatCurrencyFromNumber, formatDateTime } from '@/lib/utils'

export default function BossDashboard() {
  const { t, lang, getOrderStatusLabel } = useLocale()
  const dashboardQuery = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchDashboardStats })
  const stats = dashboardQuery.data

  // Time calculations
  const today = useMemo(() => {
    const now = new Date()
    return now
  }, [])

  // KPIs
  const kpis = useMemo(() => {
    return {
      revenue: stats?.monthlyRevenue ?? 0,
      orders: stats?.monthlyOrders ?? 0,
      active: stats?.activeOrders ?? 0,
      tasks: stats?.monthlyTasks ?? 0
    }
  }, [stats])

  // Chart Data (Last 7 Days)
  const chartData = useMemo(() => {
    return (stats?.weeklyRevenue ?? []).map((entry) => {
      const date = new Date(`${entry.date}T00:00:00`)
      return {
        name: date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'short', day: 'numeric', month: 'numeric' }),
        revenue: entry.revenue,
      }
    })
  }, [stats, lang])

  // Recent 5 Orders
  const recentOrders = useMemo(() => {
    return stats?.recentOrders ?? []
  }, [stats])

  return (
    <div className="space-y-8 p-4 md:p-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title', 'Overview')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle', `Business summary for ${today.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' })}`)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase">{t('dashboard.kpis.revenue', 'Monthly Revenue')}</span>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrencyFromNumber(kpis.revenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.orders} {t('dashboard.orders', 'orders this month')}
          </p>
        </div>

        {/* Active Orders */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase">{t('dashboard.kpis.active', 'Active Orders')}</span>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {kpis.active}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('dashboard.processing', 'Need attention')}
          </p>
        </div>

        {/* Total Products/Tasks */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase">{t('dashboard.kpis.products', 'Total Products')}</span>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {kpis.tasks}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('dashboard.createdThisMonth', 'Created this month')}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('dashboard.charts.weeklyRevenue', 'Revenue (Last 7 Days)')}
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [formatCurrencyFromNumber(Number(value || 0)), t('dashboard.revenue', 'Revenue')]}
                />
                <Bar
                  dataKey="revenue"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-foreground mb-4">{t('dashboard.recentOrders', 'Recent Orders')}</h3>
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2">
            {recentOrders.map(order => (
              <Link href={`/${lang}/orders/${order.id}`} key={order.id} className="block group">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 group-hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 text-xs rounded-lg bg-white border border-border flex items-center justify-center font-bold text-muted-foreground">
                      {order.code.slice(-3)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.bouquetName}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.receiveTime, lang)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatCurrencyFromNumber(parseCurrencyToNumber(order.total))}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${order.status === 'READY' || order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                      order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {getOrderStatusLabel ? getOrderStatusLabel(order.status) : order.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard.noOrders', 'No orders found')}</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link href={`/${lang}/orders`} className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
              {t('dashboard.viewAll', 'View all orders')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}



