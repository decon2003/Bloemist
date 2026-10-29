'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Filter, Trash2, Hand } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { DateFilterSwitcher, DateRange } from '@/components/date-filter-switcher'
import { getDateKey } from '@/lib/date-utils'
import { useListParams } from '@/lib/use-list-params'
import type { Order } from '@/lib/types'
import { formatCurrencyDisplay, formatDateTime, formatDeliveryTime, lockedPayrollNotice } from '@/lib/utils'
import { useViewSettings } from '@/components/providers/view-settings-provider'
import { thumbUrl } from '@/lib/image-compress'

const baseStatuses: Order['status'][] = ['NEW', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED']

const statusStyle = (status: Order['status']) =>
  status === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-200'
    : status === 'READY' ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-muted text-foreground border-transparent'
const orderStatuses: Array<'ALL' | Order['status']> = ['ALL', ...baseStatuses]
/** Florists move an open order up to "Sẵn sàng"; the rest is for sales and managers. */
const floristStatuses: Order['status'][] = ['NEW', 'IN_PROGRESS', 'READY']
const READY_CONFIRM = 'Chuyển đơn sang "Sẵn sàng"? Các sản phẩm chưa bấm hoàn tất sẽ được tính là đã làm xong.'

type OrderFilter = (typeof orderStatuses)[number]

/** Orders loaded per "Xem thêm". */
const PAGE_SIZE = 50
/** Sales and florists see this many days of history (the server enforces it). */
const STAFF_HISTORY_DAYS = 30

const daysAgoKey = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return getDateKey(d)
}

export default function OrdersPage() {
  const router = useRouter()
  const { orders, users, deleteOrder, updateOrder, setOrderScope } = useAppData()
  const { lang, t, getDeliveryLabel, getOrderStatusLabel } = useLocale()
  const { user } = useAuth()
  const { dateFilterMode } = useViewSettings()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<OrderFilter>('ALL')
  // Open on today's orders; "All dates" shows the working window around today.
  const [selectedDate, setSelectedDate] = useState(() => getDateKey(new Date()) ?? '')
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = getDateKey(new Date()) ?? ''
    return { from: today, to: today }
  })
  const weekDayLabels = lang === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : undefined

  // Each mode starts on today when switched to; the other mode's value is cleared.
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

  // Dates, search, people and status are applied by the server.
  const listParams = useListParams({ mode: dateFilterMode, selectedDate, range: dateRange, query })
  // Person in charge / salesperson filters ('' = everyone, 'none' = not set),
  // applied by the server on top of the date or search.
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [salespersonFilter, setSalespersonFilter] = useState('')
  const baseScope = useMemo(
    () => ({
      ...listParams,
      ...(assigneeFilter ? { assigneeId: assigneeFilter } : {}),
      ...(salespersonFilter ? { salespersonId: salespersonFilter } : {}),
      ...(status !== 'ALL' ? { status } : {}),
    }),
    [listParams, assigneeFilter, salespersonFilter, status],
  )
  // Pages loaded with "Xem thêm"; back to one page whenever the filters change.
  const baseKey = JSON.stringify(baseScope)
  const [paging, setPaging] = useState({ key: baseKey, pages: 1 })
  const pages = paging.key === baseKey ? paging.pages : 1
  const limit = PAGE_SIZE * pages
  const scope = useMemo(() => ({ ...baseScope, limit }), [baseScope, limit])
  useEffect(() => setOrderScope(scope), [scope, setOrderScope])

  const isManager = user?.role === 'admin'
  const staff = useMemo(() => users.filter((u) => u.status === 'active'), [users])

  const filteredOrders = useMemo(
    () => orders.filter((order) => status === 'ALL' || order.status === status),
    [orders, status],
  )

  const formatMoney = (value?: string | number | null) => formatCurrencyDisplay(value, '₫0')
  // Unfinished orders whose receive day has passed (the server adds them to
  // any window that includes today).
  const todayKey = getDateKey(new Date()) ?? ''
  const isOverdue = (order: Order) =>
    (order.status === 'NEW' || order.status === 'IN_PROGRESS' || order.status === 'READY') &&
    (getDateKey(new Date(order.receiveTime)) ?? '') < todayKey

  const handleDeleteOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (confirm(t('orders.detail.deleteConfirmation', 'Are you sure you want to delete this order?'))) {
      try {
        const notice = lockedPayrollNotice((await deleteOrder(orderId)).lockedPayrollMonths)
        if (notice) alert(notice)
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
              {filteredOrders.length} đơn
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
        minDate={isManager ? undefined : daysAgoKey(STAFF_HISTORY_DAYS)}
        extraFields={
          user ? (
            <>
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Người phụ trách</span>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Tất cả</option>
                  <option value="none">Chưa phân công</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Người sale</span>
                <select
                  value={salespersonFilter}
                  onChange={(e) => setSalespersonFilter(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Tất cả</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            </>
          ) : undefined
        }
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
                  <div className="flex items-center gap-4 md:w-[320px] md:shrink-0">
                    <Image
                      src={thumbUrl(orderThumbnail)}
                      alt={order.bouquetName}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.code}</p>
                      <h2 className="text-lg font-semibold text-foreground">{order.bouquetName}</h2>
                      <p className="text-sm text-muted-foreground">{order.customerName || <span className="italic">Chưa có tên khách</span>}</p>
                      {user?.role === 'florist' && (
                        <p className="text-sm font-medium text-foreground">
                          {order.deliveryType === 'DELIVERY' ? 'Giao' : 'Khách nhận'} {formatDeliveryTime(order.receiveTime)}
                        </p>
                      )}
                      {isOverdue(order) && (
                        <p className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Quá hạn · nhận {formatDateTime(order.receiveTime, lang)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-4 text-sm md:grid-cols-5 md:text-right">
                    <div className="text-left md:text-right">
                      <p className="text-muted-foreground">Phụ trách</p>
                      <p className={`font-semibold ${order.assigneeName ? 'text-foreground' : 'text-amber-700'}`}>
                        {order.assigneeName || 'Chưa phân công'}
                      </p>
                      {user?.role === 'florist' && !order.assigneeId && floristStatuses.includes(order.status) && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await updateOrder(order.id, { assigneeId: user.id })
                            } catch (error) {
                              alert(error instanceof Error ? error.message : 'Không nhận được đơn')
                            }
                          }}
                          className="mt-1 inline-flex items-center gap-1 rounded-lg border border-primary bg-white px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                        >
                          <Hand className="h-3.5 w-3.5" /> Nhận đơn
                        </button>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-muted-foreground">Sale</p>
                      <p className="font-semibold text-foreground">{order.salespersonName || order.createdByName || '—'}</p>
                    </div>
                    <div className="text-left md:text-right">
                      {user?.role === 'florist' ? (
                        <>
                          <p className="text-muted-foreground">Giá hoa</p>
                          <p className="text-lg font-semibold text-foreground">{formatMoney(order.listedPrice)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-muted-foreground">{t('orders.detail.total')}</p>
                          <p className="text-lg font-semibold text-foreground">{formatMoney(order.total)}</p>
                        </>
                      )}
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-muted-foreground">{t('orders.detail.delivery')}</p>
                      <p className="font-semibold text-foreground">{getDeliveryLabel(order.deliveryType)}</p>
                      <p className="text-xs text-muted-foreground">{formatDeliveryTime(order.receiveTime)}</p>
                    </div>

                    <div className="text-left md:text-right" onClick={(e) => e.stopPropagation()}>
                      <p className="text-muted-foreground">Trạng thái</p>
                      <div className="flex md:justify-end">
                        {user?.role === 'florist' && !floristStatuses.includes(order.status) ? (
                          // Delivered and cancelled orders are for sales and managers.
                          <span className={`inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium ${statusStyle(order.status)}`}>
                            {getOrderStatusLabel(order.status)}
                          </span>
                        ) : (
                          <select
                            value={order.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const next = e.target.value as Order['status']
                              if (next === 'CANCELLED' && !confirm('Huỷ đơn này? Doanh thu, hoa hồng sale và hoa hồng làm đơn của đơn sẽ không được tính nữa; các sản phẩm chưa làm sẽ dừng lại.')) return
                              if (order.status === 'CANCELLED' && !confirm('Khôi phục đơn đã huỷ? Doanh thu và hoa hồng của đơn sẽ được tính lại.')) return
                              if (next === 'READY' && !confirm(READY_CONFIRM)) return
                              try {
                                const updated = await updateOrder(order.id, { status: next })
                                const notice = lockedPayrollNotice(updated.lockedPayrollMonths)
                                if (notice) alert(notice)
                              } catch (error) {
                                alert(error instanceof Error ? error.message : 'Không cập nhật được trạng thái')
                              }
                            }}
                            className={`h-8 rounded-md border px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-primary ${statusStyle(order.status)}`}
                          >
                            {(user?.role === 'florist' ? floristStatuses : baseStatuses).map((s) => (
                              <option key={s} value={s}>
                                {getOrderStatusLabel(s)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>


                  </div>
                  {isManager && (
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
          {orders.length >= limit && (
            <button
              type="button"
              onClick={() => setPaging({ key: baseKey, pages: pages + 1 })}
              className="mx-auto rounded-full border border-border bg-white px-6 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Xem thêm
            </button>
          )}
        </div>
      )}
    </div>
  )
}
