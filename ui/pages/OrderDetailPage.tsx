"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, User, Truck, ClipboardList, Plus, Edit, Check, X, Trash2, Hand } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAppData } from "@/components/providers/app-data-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import AddTaskDialog from "@/components/tasks/add-task-dialog"
import { ProductCard } from "@/components/orders/product-card"
import { OrderPayments } from "@/components/orders/order-payments"
import { PhotoViewer } from "@/components/photo-viewer"
import { fetchOrder, updateOrder, deleteOrder } from "@/lib/api"
import type { CreateOrderInput, Order } from "@/lib/types"
import { cn, formatCurrencyDisplay, formatDeliveryTime, fromDateTimeLocalValue, lockedPayrollNotice, toDateTimeLocalValue } from "@/lib/utils"
import { AuditTrail } from "@/components/audit-trail"
import { DateTimeInput24 } from "@/components/time-input-24"

interface OrderDetailPageProps {
  orderId: string
}

/** Fields the edit form changes; only those that differ are sent on save, so
 *  a status changed meanwhile (e.g. "Đã huỷ") is never overwritten. */
const EDITABLE_FIELDS = ['customerName', 'customerPhone', 'receiverName', 'receiverPhone', 'deliveryAddress', 'receiveTime', 'cardMessage', 'notes'] as const

const CANCEL_CONFIRM =
  'Huỷ đơn này? Doanh thu, hoa hồng sale và hoa hồng làm đơn của đơn sẽ không được tính nữa; các sản phẩm chưa làm sẽ dừng lại.'

type Toast = { text: string; kind: 'success' | 'error' }

const FLORIST_STATUSES: Order['status'][] = ['NEW', 'IN_PROGRESS', 'READY']

export default function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { tasks, florists, setTaskScope, refreshTasks } = useAppData()
  const { lang, t, getDeliveryLabel, getOrderStatusLabel } = useLocale()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Order>>({})
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null)

  useEffect(() => {
    let active = true
    const loadOrder = async () => {
      setIsFetching(true)
      setLoadError(null)
      try {
        const response = await fetchOrder(orderId)
        if (!active) return
        setOrder(response)
      } catch (error) {
        if (!active) return
        console.error("Failed to load order", error)
        setOrder(null)
        setLoadError(error instanceof Error ? error.message : "Không tải được đơn hàng.")
      } finally {
        if (active) setIsFetching(false)
      }
    }

    loadOrder()
    return () => {
      active = false
    }
  }, [orderId])

  // Load just this order's tasks.
  useEffect(() => setTaskScope({ orderId }), [orderId, setTaskScope])

  /** After a product is completed or reopened the order's status may move. */
  const reloadOrder = useCallback(async () => {
    try {
      setOrder(await fetchOrder(orderId))
    } catch {
      // The products already show the change; the status catches up on the next visit.
    }
  }, [orderId])

  const relatedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.orderId === orderId)
        .sort((taskA, taskB) => new Date(taskA.dueTime).getTime() - new Date(taskB.dueTime).getTime()),
    [tasks, orderId],
  )

  const canSeeContacts = user?.role !== 'florist'
  const canEdit = user?.role !== 'florist'
  // Florists move an open order up to "Sẵn sàng" and change its person in
  // charge; delivering and cancelling stay with sales and managers.
  const isFlorist = user?.role === 'florist'
  const floristCanMove = isFlorist && !!order && FLORIST_STATUSES.includes(order.status)
  const canChangeInCharge = !!order && order.status !== 'CANCELLED' && (canEdit || floristCanMove)
  const inChargeOptions = useMemo(
    () => (order?.assigneeId && !florists.some((f) => f.id === order.assigneeId)
      ? [{ id: order.assigneeId, name: order.assigneeName ?? '—' }, ...florists]
      : florists),
    [florists, order?.assigneeId, order?.assigneeName],
  )
  // Sales edit orders; only managers delete them.
  const isManager = user?.role === 'admin'

  const formatMoney = (value?: string | number | null, fallback?: string) =>
    formatCurrencyDisplay(value, fallback ?? '₫0')

  const showError = (err: unknown, fallback: string) =>
    setToast({ text: err instanceof Error ? err.message : fallback, kind: 'error' })

  const handleEditStart = () => {
    if (!order) return
    setEditForm(Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, order[field] ?? ''])) as Partial<Order>)
    setIsEditMode(true)
  }

  const handleEditCancel = () => {
    setIsEditMode(false)
    setEditForm({})
  }

  const handleEditSave = async () => {
    if (!order) return
    const changes = Object.fromEntries(
      EDITABLE_FIELDS.filter((field) => (editForm[field] ?? '') !== (order[field] ?? '')).map((field) => [field, editForm[field] ?? '']),
    )
    if (Object.keys(changes).length === 0) {
      setIsEditMode(false)
      return
    }
    setIsSaving(true)
    try {
      const updated = await updateOrder(order.id, changes as Partial<CreateOrderInput>)
      setOrder(updated)
      setIsEditMode(false)
      // A new receive time moves the products' due times on the server.
      if ('receiveTime' in changes) refreshTasks()
      setToast({ text: 'Đã lưu thay đổi', kind: 'success' })
    } catch (err) {
      showError(err, 'Không lưu được đơn hàng')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!order) return
    if (!window.confirm(t('orders.detail.deleteConfirmation'))) return

    try {
      const notice = lockedPayrollNotice((await deleteOrder(order.id)).lockedPayrollMonths)
      if (notice) window.alert(notice)
      router.push(`/${lang}/orders`)
    } catch (err) {
      showError(err, 'Không xoá được đơn hàng')
    }
  }

  const handleEditChange = (field: keyof Order, value: string) => {
    setEditForm({ ...editForm, [field]: value })
  }

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    if (!order) return
    if (newStatus === 'CANCELLED' && !window.confirm(CANCEL_CONFIRM)) return
    if (order.status === 'CANCELLED' && !window.confirm('Khôi phục đơn đã huỷ? Doanh thu và hoa hồng của đơn sẽ được tính lại.')) return
    const openProducts = relatedTasks.some((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED')
    if (newStatus === 'DELIVERED' && openProducts) {
      if (!window.confirm('Đơn còn sản phẩm chưa hoàn tất. Vẫn đánh dấu "Đã giao"?')) return
    }
    if (newStatus === 'READY' && openProducts) {
      if (!window.confirm('Chuyển đơn sang "Sẵn sàng"? Các sản phẩm chưa bấm hoàn tất sẽ được tính là đã làm xong.')) return
    }
    try {
      const updated = await updateOrder(order.id, { status: newStatus })
      setOrder(updated)
      // Cancelling, restoring or "Sẵn sàng" changes the products too.
      if (newStatus === 'CANCELLED' || order.status === 'CANCELLED' || newStatus === 'READY') refreshTasks()
      const notice = lockedPayrollNotice(updated.lockedPayrollMonths)
      setToast(notice ? { text: notice, kind: 'error' } : { text: 'Đã cập nhật trạng thái', kind: 'success' })
    } catch (err) {
      showError(err, 'Không cập nhật được trạng thái')
    }
  }

  const handleChangeInCharge = async (userId: string) => {
    if (!order || userId === (order.assigneeId ?? '')) return
    const next = inChargeOptions.find((f) => f.id === userId)?.name
    if (order.assigneeId && !window.confirm(
      next
        ? `Chuyển nhân viên phụ trách từ ${order.assigneeName ?? 'người cũ'} sang ${next}? Các sản phẩm chưa làm của ${order.assigneeName ?? 'người cũ'} sẽ chuyển theo.`
        : `Bỏ nhân viên phụ trách ${order.assigneeName ?? ''}? Các sản phẩm chưa làm của người này sẽ thành chưa có người làm.`,
    )) return
    try {
      const updated = await updateOrder(order.id, { assigneeId: userId })
      setOrder(updated)
      refreshTasks()
      setToast({ text: next ? `${next} phụ trách đơn này` : 'Đã bỏ nhân viên phụ trách', kind: 'success' })
    } catch (err) {
      showError(err, 'Không đổi được nhân viên phụ trách')
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <div className="rounded-2xl border border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          Đang tải đơn hàng…
        </div>
      </div>
    )
  }

  if (loadError || !order) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> {t("orders.detail.back")}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {loadError ?? t("orders.detail.notFound")}
        </div>
      </div>
    )
  }

  const statusStyle =
    order.status === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-200'
      : order.status === 'READY' ? 'bg-green-100 text-green-800 border-green-200'
        : order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-muted text-foreground border-transparent'
  const inputClass = "w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  const whenLabel = order.deliveryType === 'DELIVERY' ? 'Giờ giao' : 'Giờ khách nhận'
  const shipLabel =
    order.deliveryType !== 'DELIVERY' ? 'Không (nhận tại shop)' : order.deliveryCoveredByShop ? 'Freeship' : formatMoney(order.deliveryFee)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> {t("orders.detail.back")}
      </Link>

      {toast && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-sm',
            toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="underline">Đóng</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.code}</p>
            <span className="text-xs text-muted-foreground">•</span>
            <p className="text-xs text-muted-foreground">Người tạo: {order.createdByName || '—'}</p>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{order.bouquetName}</h1>
          <p className="text-muted-foreground">
            {order.customerName || 'Chưa có tên khách'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit || floristCanMove ? (
            <select
              value={order.status}
              onChange={(e) => handleUpdateStatus(e.target.value as Order['status'])}
              aria-label="Trạng thái đơn"
              className={`h-9 rounded-full border px-4 py-2 text-sm font-medium focus:ring-1 focus:ring-primary ${statusStyle}`}
            >
              {(isFlorist ? FLORIST_STATUSES : (['NEW', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'] as Order['status'][])).map((value) => (
                <option key={value} value={value}>{getOrderStatusLabel(value)}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium ${statusStyle}`}>
              {getOrderStatusLabel(order.status)}
            </span>
          )}

          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            {getDeliveryLabel(order.deliveryType)}
          </span>

          {canEdit &&
            (!isEditMode ? (
              <>
                <button
                  onClick={handleEditStart}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Edit className="h-4 w-4" /> Sửa
                </button>
                {isManager && (
                  <button
                    onClick={handleDelete}
                    title="Xoá đơn (chỉ quản lý)"
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> {isSaving ? 'Đang lưu…' : 'Lưu'}
                </button>
                <button
                  onClick={handleEditCancel}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <X className="h-4 w-4" /> Huỷ
                </button>
              </>
            ))}
        </div>
      </div>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Thông tin làm hoa</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{whenLabel}</dt>
            <dd className="text-lg font-bold text-foreground">{formatDeliveryTime(order.receiveTime)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hình thức</dt>
            <dd className="font-semibold text-foreground">{getDeliveryLabel(order.deliveryType)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Giá hoa</dt>
            <dd className="text-lg font-semibold text-foreground">{formatMoney(order.listedPrice, '—')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phí ship</dt>
            <dd className="font-semibold text-foreground">{shipLabel}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Nhân viên phụ trách:</span>
          {canChangeInCharge ? (
            <select
              value={order.assigneeId ?? ''}
              onChange={(e) => handleChangeInCharge(e.target.value)}
              aria-label="Nhân viên phụ trách"
              className="h-9 rounded-lg border border-input bg-white px-2 text-sm font-semibold focus:ring-1 focus:ring-primary"
            >
              <option value="">Chưa có</option>
              {inChargeOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-foreground">{order.assigneeName || 'Chưa có'}</span>
          )}
          {canChangeInCharge && isFlorist && user && order.assigneeId !== user.id && (
            <button
              type="button"
              onClick={() => handleChangeInCharge(user.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-primary bg-white px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              <Hand className="h-4 w-4" /> Nhận phụ trách
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">Nội dung thiệp</p>
            {isEditMode ? (
              <textarea
                value={editForm.cardMessage || ''}
                onChange={(e) => handleEditChange('cardMessage', e.target.value)}
                rows={3}
                placeholder="Lời chúc trên thiệp"
                className={inputClass}
              />
            ) : (
              <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm italic text-foreground">
                {order.cardMessage || <span className="not-italic text-muted-foreground">Không có thiệp</span>}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">Ghi chú đặc biệt</p>
            {isEditMode ? (
              <textarea
                value={editForm.notes || ''}
                onChange={(e) => handleEditChange('notes', e.target.value)}
                rows={3}
                placeholder="Ví dụ: không dùng hoa ly, gói giấy trắng"
                className={inputClass}
              />
            ) : (
              <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-foreground">
                {order.notes || <span className="text-muted-foreground">Không có</span>}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Total and status are already at the top; photos are on each product. */}
      <div>
        {canSeeContacts && (
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">{t('orders.detail.paymentSummary', 'Thanh toán')}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.listedPrice', 'Giá niêm yết')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.listedPrice, '—')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="text-lg font-semibold text-foreground">{order.vatPercent ?? 0}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.deliveryFee', 'Phí giao hàng')}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {order.deliveryCoveredByShop ? 'Freeship' : order.deliveryType === 'DELIVERY' ? formatMoney(order.deliveryFee) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.deposit', 'Đã thu')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.deposit)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.remainingBalance', 'Còn phải thu')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.remainingBalance)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.total', 'Tổng tiền')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.total)}</dd>
            </div>
          </dl>
          <OrderPayments order={order} isManager={isManager} onOrderChange={setOrder} />
        </section>
        )}

        {/* Customer and receiver: everyone; phone numbers for sales and managers only. */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4" /> {t("orders.detail.customer")}
            </div>
            {isEditMode && canEdit ? (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={editForm.customerName || ""}
                  onChange={(e) => handleEditChange("customerName", e.target.value)}
                  placeholder="Tên người đặt"
                  className={inputClass}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={editForm.customerPhone || ""}
                  onChange={(e) => handleEditChange("customerPhone", e.target.value)}
                  placeholder="SĐT người đặt"
                  className={inputClass}
                />
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-2">
                  {order.customerId && isManager ? (
                    <Link href={`/${lang}/customers/${order.customerId}`} className="text-sm font-medium text-primary hover:underline">
                      {order.customerName || "Chưa có tên khách"}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">{order.customerName || "Chưa có tên khách"}</p>
                  )}
                  {order.new_customer && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                      Khách mới
                    </span>
                  )}
                </div>
                {canSeeContacts && <p className="text-sm text-muted-foreground">{order.customerPhone || 'Chưa có SĐT'}</p>}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Truck className="h-4 w-4" /> {t("orders.detail.receiver")}
            </div>
            {isEditMode && canEdit ? (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={editForm.receiverName || ""}
                  onChange={(e) => handleEditChange("receiverName", e.target.value)}
                  placeholder="Tên người nhận"
                  className={inputClass}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={editForm.receiverPhone || ""}
                  onChange={(e) => handleEditChange("receiverPhone", e.target.value)}
                  placeholder="SĐT người nhận"
                  className={inputClass}
                />
                {order.deliveryType === 'DELIVERY' && (
                  <input
                    type="text"
                    value={editForm.deliveryAddress || ""}
                    onChange={(e) => handleEditChange("deliveryAddress", e.target.value)}
                    placeholder={t('orders.new.deliveryAddressPlaceholder')}
                    className={inputClass}
                  />
                )}
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">{order.receiverName || 'Chưa có tên người nhận'}</p>
                {canSeeContacts && <p className="text-sm text-muted-foreground">{order.receiverPhone || 'Chưa có SĐT'}</p>}
                {order.deliveryType === 'DELIVERY' && (
                  <div className="mt-2 border-t border-dashed border-border pt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Địa chỉ giao:</p>
                    <p className="text-sm text-foreground">{order.deliveryAddress || 'Chưa có địa chỉ'}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {isEditMode && (
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Giờ nhận</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ngày giờ nhận</label>
              {/* A LOCAL wall-clock value: convert to and from it explicitly,
                  never by slicing an ISO (UTC) string. */}
              <DateTimeInput24
                value={toDateTimeLocalValue(editForm.receiveTime)}
                onChange={(value) => {
                  const iso = fromDateTimeLocalValue(value)
                  // A cleared or partially typed value yields null; ignore it.
                  if (iso) handleEditChange("receiveTime", iso)
                }}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">Hạn làm của các sản phẩm chưa xong sẽ dời theo.</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4" /> Sản phẩm của đơn
          </div>
          {canEdit && order.status !== 'CANCELLED' && (
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-primary/60"
            >
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </button>
          )}
        </div>
        {relatedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Đơn này chưa có sản phẩm.</p>
        ) : (
          <div className="space-y-4">
            {relatedTasks.map((task) => (
              <ProductCard
                key={task.id}
                task={task}
                user={user}
                florists={florists}
                lang={lang}
                onlyProduct={relatedTasks.length === 1}
                onViewPhotos={(photos, index) => setViewer({ photos, index })}
                onOrderChanged={() => {
                  reloadOrder()
                  refreshTasks()
                }}
              />
            ))}
          </div>
        )}
      </section>

      {isManager && <AuditTrail entity="order" entityId={orderId} lang={lang} />}

      {viewer && <PhotoViewer photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />}

      <AddTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={(message) => {
          setToast({ text: message, kind: 'success' })
          setDialogOpen(false)
        }}
        initialOrderId={order.id}
        order={order}
        lockOrderSelection
      />
    </div>
  )
}
