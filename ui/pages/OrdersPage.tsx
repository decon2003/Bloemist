'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Filter, Trash2 } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { DateFilterSwitcher, DateRange } from '@/components/date-filter-switcher'
import { getDateKey } from '@/lib/date-utils'
import type { Order } from '@/lib/types'
import { formatCurrencyDisplay } from '@/lib/utils'
import { useViewSettings } from '@/components/providers/view-settings-provider'

const baseStatuses: Order['status'][] = ['NEW', 'IN_PROGRESS', 'READY', 'DELIVERED']
const orderStatuses: Array<'ALL' | Order['status']> = ['ALL', ...baseStatuses]

type OrderFilter = (typeof orderStatuses)[number]

export default function OrdersPage() {
  const router = useRouter()
  const { orders, florists, assignOrder, deleteOrder, updateOrder } = useAppData()
  const { lang, t, getDeliveryLabel, getOrderStatusLabel } = useLocale()
  const { user } = useAuth()
  const { dateFilterMode } = useViewSettings()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<OrderFilter>('ALL')
  const [selectedDate, setSelectedDate] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const weekDayLabels = lang === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : undefined

  useEffect(() => {
    if (dateFilterMode === 'range') {
      setSelectedDate('')
    } else {
      setDateRange({ from: '', to: '' })
    }
  }, [dateFilterMode])

  const ordersWithDerivedStatus = useMemo(() => {
    if (user?.role === 'florist') {
      return orders.filter((order) => order.assigneeId === user.id)
    }
    return orders
  }, [orders, user])

  const filteredOrders = useMemo(
    () =>
      ordersWithDerivedStatus.filter((order) => {
        const matchesStatus = status === 'ALL' || order.status === status
        const matchesQuery =
          !query ||
          order.code.toLowerCase().includes(query.toLowerCase()) ||
          order.customerName.toLowerCase().includes(query.toLowerCase())
        const receiveDate = getDateKey(order.receiveTime)
        const matchesDate =
          dateFilterMode === 'range'
            ? (!dateRange.from ||
              (receiveDate >= dateRange.from && (!dateRange.to || receiveDate <= dateRange.to)))
            : !selectedDate || receiveDate === selectedDate
        return matchesStatus && matchesQuery && matchesDate
      }),
    [
      ordersWithDerivedStatus,
      query,
      selectedDate,
      dateFilterMode,
      dateRange.from,
      dateRange.to,
      status,
    ],
  )

  const formatMoney = (value?: string | number | null) => formatCurrencyDisplay(value, '₫0')

  const handleDeleteOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (confirm(t('orders.detail.deleteConfirmation', 'Are you sure you want to delete this order?'))) {
      try {
        await deleteOrder(orderId)
      } catch (error) {
        console.error('Failed to delete order', error)
        alert(t('orders.detail.deleteError', 'Failed to delete order'))
      }
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('orders.heroSubtitle')}</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{t('orders.heroTitle')}</h1>
            {user?.role !== 'florist' && (
              <Link
                href={`/${lang}/orders/new`}
                className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 md:inline-flex"
              >
                {t('orders.addNew', 'Add new order')}
              </Link>
            )}
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <div className="relative flex-1 md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('orders.searchPlaceholder')}
                className="w-full rounded-2xl border border-border bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              {filteredOrders.length} active
            </div>
          </div>
        </div>
      </header>

      {user?.role !== 'florist' && (
        <Link
          href={`/${lang}/orders/new`}
          className="md:hidden inline-flex items-center justify-center rounded-2xl border border-primary bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm"
        >
          {t('orders.addNew', 'Add new order')}
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        {orderStatuses.map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${status === value ? 'bg-primary text-white shadow-sm' : 'border border-border bg-white hover:bg-muted'
              }`}
          >
            {value === 'ALL' ? t('tasks.filter.all') : getOrderStatusLabel(value)}
          </button>
        ))}
      </div>

      <DateFilterSwitcher
        label={t('orders.dateFilter.label', 'Receive day')}
        mode={dateFilterMode}
        onModeChange={() => { }}
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
        calendarLabel={t('orders.dateFilter.openCalendar', 'Pick receive day from calendar')}
        clearLabel={t('tasks.dateFilter.all')}
        todayLabel={t('tasks.dateLabels.today', 'Today')}
        weekDayLabels={weekDayLabels}
        locale={lang === 'vi' ? 'vi-VN' : undefined}
      />

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {t('orders.empty')}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const orderThumbnail =
              order.bouquetImage ||
              '/placeholder.jpg'
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/${lang}/orders/${order.id}`)}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 transition hover:border-primary/50 hover:shadow-md cursor-pointer"
              >
                <div className="flex flex-1 flex-col justify-center gap-4 md:flex-row md:items-center md:justify-start">
                  <div className="flex items-center gap-4">
                    <Image
                      src={orderThumbnail}
                      alt={order.bouquetName}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.code}</p>
                      <h2 className="text-lg font-semibold text-foreground">{order.bouquetName}</h2>
                      <p className="text-sm text-muted-foreground">{order.customerName}</p>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-4 text-sm md:grid-cols-4 md:text-right">
                    <div className="text-left md:text-right">
                      <p className="text-muted-foreground">{t('orders.detail.total')}</p>
                      <p className="text-lg font-semibold text-foreground">{formatMoney(order.total)}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-muted-foreground">{t('orders.detail.delivery')}</p>
                      <p className="font-semibold text-foreground">{getDeliveryLabel(order.deliveryType)}</p>
                    </div>

                    <div className="text-left md:text-right" onClick={(e) => e.stopPropagation()}>
                      <p className="text-muted-foreground">Status</p>
                      <div className="flex md:justify-end">
                        <select
                          value={order.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            updateOrder(order.id, { status: e.target.value as Order['status'] })
                          }}
                          className={`h-8 rounded-md border px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-primary ${order.status === 'READY' ? 'bg-green-100 text-green-800 border-green-200' :
                            order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-muted text-foreground border-transparent'
                            }`}
                        >
                          {baseStatuses.map((s) => (
                            <option key={s} value={s}>
                              {getOrderStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-left md:text-right" onClick={(e) => e.stopPropagation()}>
                      <p className="text-muted-foreground">{t('orders.assignee', 'Florist')}</p>
                      <div className="flex md:justify-end">
                        <select
                          value={order.assigneeId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const selectedId = e.target.value
                            const florist = florists.find((f) => f.id === selectedId)
                            if (florist) {
                              assignOrder(order.id, { userId: florist.id, userName: florist.name })
                            }
                          }}
                          className="h-8 max-w-[140px] rounded-md border border-input bg-background px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-primary"
                        >
                          <option value="" disabled>
                            {t('common.select', 'Select')}
                          </option>
                          {florists.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {user?.role !== 'florist' && (
                    <div className="flex shrink-0 items-center justify-end md:pl-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeleteOrder(e, order.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-100 hover:border-red-200"
                        title={t('orders.detail.delete', 'Delete order')}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
