"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, User, Truck, ClipboardList, Plus, Edit, Check, X, StickyNote, Trash2, Play, CheckCircle, Package } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAppData } from "@/components/providers/app-data-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import AddTaskDialog from "@/components/tasks/add-task-dialog"
import { fetchOrder, updateOrder, deleteOrder } from "@/lib/api"
import type { Order } from "@/lib/types"
import { formatCurrencyDisplay, formatDateTime } from "@/lib/utils"

interface OrderDetailPageProps {
  orderId: string
}

export default function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { tasks, florists, assignTask } = useAppData()
  const { lang, t, getDeliveryLabel, getOrderStatusLabel, getTaskStatusLabel } = useLocale()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Order>>({})

  useEffect(() => {
    let active = true
    const loadOrder = async () => {
      setIsFetching(true)
      setLoadError(null)
      try {
        const response = await fetchOrder(orderId)
        if (!active) return
        setOrder(response)
        setEditForm(response)
      } catch (error) {
        if (!active) return
        console.error("Failed to load order", error)
        setOrder(null)
        setLoadError(t("orders.detail.loadError", "Unable to load order."))
      } finally {
        if (active) {
          setIsFetching(false)
        }
      }
    }

    loadOrder()
    return () => {
      active = false
    }
  }, [orderId, t])

  const relatedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.orderId === orderId)
        .sort((taskA, taskB) => new Date(taskA.dueTime).getTime() - new Date(taskB.dueTime).getTime()),
    [tasks, orderId],
  )

  const derivedStatus = useMemo(() => {
    if (!order) return undefined
    const allTasksReady = relatedTasks.length > 0 && relatedTasks.every((task) => task.status === 'READY')
    // If explicit status set, prefer that, but logic can vary. For now rely on order.status primarily unless synced.
    // The previous logic overrode derivedStatus. Let's stick to order.status if it's set to something specific.
    return order.status
  }, [order, relatedTasks])

  const orderThumbnail = useMemo(() => {
    const firstSample = relatedTasks.find((task) => task.samplePhotoUrls?.length)?.samplePhotoUrls?.[0]
    return firstSample || order?.bouquetImage || '/placeholder.jpg'
  }, [order, relatedTasks])

  const canSeeContacts = user?.role !== 'florist'
  const canEdit = user?.role !== 'florist'

  const formatMoney = (value?: string | number | null, fallback?: string) =>
    formatCurrencyDisplay(value, fallback ?? '₫0')

  const closeToast = () => setToastMessage(null)
  const closeDialog = () => setDialogOpen(false)
  const handleDialogSuccess = (message: string) => {
    setToastMessage(message)
    closeDialog()
  }

  const handleEditStart = () => {
    setEditForm(order || {})
    setIsEditMode(true)
  }

  const handleEditCancel = () => {
    setIsEditMode(false)
    setEditForm({})
  }

  const handleEditSave = async () => {
    if (order && editForm) {
      try {
        const updated = await updateOrder(order.id, editForm)
        setOrder(updated)
        setIsEditMode(false)
        setToastMessage(t("orders.detail.updateSuccess", "Order updated successfully"))
      } catch (err) {
        console.error("Failed to update order", err)
        setToastMessage(t("orders.detail.updateError", "Failed to update order"))
      }
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('orders.detail.deleteConfirmation'))) return

    try {
      await deleteOrder(order.id)
      router.push(`/${lang}/orders`)
    } catch (err) {
      console.error("Failed to delete order", err)
      setToastMessage(t("orders.detail.deleteError"))
    }
  }

  const handleEditChange = (field: keyof Order, value: any) => {
    setEditForm({ ...editForm, [field]: value })
  }

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    if (!order) return
    try {
      const updated = await updateOrder(order.id, { status: newStatus })
      setOrder(updated)
      setToastMessage(t("orders.detail.updateSuccess", "Status updated"))
    } catch (err) {
      console.error("Failed to update status", err)
      setToastMessage(t("orders.detail.updateError", "Failed to update status"))
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <div className="rounded-2xl border border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {t("orders.loading", "Loading order...")}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> {t("orders.detail.back")}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {loadError}
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> {t("orders.detail.back")}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {t("orders.detail.notFound")}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <Link href={`/${lang}/orders`} className="inline-flex items-center gap-2 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> {t("orders.detail.back")}
      </Link>

      {toastMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <div className="flex items-center justify-between gap-2">
            <span>{toastMessage}</span>
            <button onClick={closeToast} className="text-green-700 underline">
              {t("tasks.toast.close", "Close")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.code}</p>
            <span className="text-xs text-muted-foreground">•</span>
            <p className="text-xs text-muted-foreground">
              {t('orders.detail.createdBy', 'Created by')}: {order.createdByName || '—'}
            </p>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{order.bouquetName}</h1>
          <p className="text-muted-foreground">{order.customerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-3">
            <select
              value={order.status}
              onChange={(e) => handleUpdateStatus(e.target.value as Order['status'])}
              className={`h-9 rounded-full border px-4 py-2 text-sm font-medium focus:ring-1 focus:ring-primary ${order.status === 'SHIPPED' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  order.status === 'READY' ? 'bg-green-100 text-green-800 border-green-200' :
                    order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      'bg-muted text-foreground border-transparent'
                }`}
            >
              <option value="NEW">{getOrderStatusLabel('NEW')}</option>
              <option value="IN_PROGRESS">{getOrderStatusLabel('IN_PROGRESS')}</option>
              <option value="READY">{getOrderStatusLabel('READY')}</option>
              <option value="SHIPPED">{getOrderStatusLabel('SHIPPED')}</option>
              <option value="DELIVERED">{getOrderStatusLabel('DELIVERED')}</option>
            </select>

            <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {getDeliveryLabel(order.deliveryType)}
            </span>
          </div>

          {canEdit &&
            (!isEditMode ? (
              <div className="flex gap-2">
                <button
                  onClick={handleEditStart}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Edit className="h-4 w-4" /> {t("common.edit", "Edit")}
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Check className="h-4 w-4" /> {t("common.save", "Save")}
                </button>
                <button
                  onClick={handleEditCancel}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <X className="h-4 w-4" /> {t("common.cancel", "Cancel")}
                </button>
              </div>
            ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Image
              src={orderThumbnail}
              alt={order.bouquetName}
              width={160}
              height={160}
              className="h-40 w-40 rounded-2xl object-cover"
            />
            <dl className="grid flex-1 grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 md:col-span-1">
                <dt className="text-muted-foreground">{t("orders.detail.assignedTo", "Assigned to")}</dt>
                <dd className="font-semibold text-foreground">{order.assigneeName || t('tasks.unassigned', 'Unassigned')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("orders.detail.total")}</dt>
                <dd className="text-2xl font-bold text-foreground">{formatMoney(order.total)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("orders.detail.delivery")}</dt>
                <dd className="text-lg font-semibold text-foreground">{getDeliveryLabel(order.deliveryType)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Receive time</dt>
                <dd className="font-semibold text-foreground">{formatDateTime(order.receiveTime, lang)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-semibold text-foreground">{getOrderStatusLabel(order.status)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">{t('orders.detail.paymentSummary', 'Payment summary')}</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.listedPrice', 'Listed price')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.listedPrice, '—')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.discount', 'Discount')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.discount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.vatPercent', 'VAT')}</dt>
              <dd className="text-lg font-semibold text-foreground">{order.vatPercent ?? 0}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.deliveryFee', 'Delivery fee')}</dt>
              <dd className="text-lg font-semibold text-foreground">
                {formatMoney(order.deliveryFee)}
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  {order.deliveryCoveredByShop
                    ? t('orders.detail.deliveryCovered', 'Covered by shop')
                    : t('orders.detail.deliveryCharged', 'Charged to customer')}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.deposit', 'Deposit')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.deposit)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.sellingPrice', 'Selling price')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.sellingPrice || order.total)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.remainingBalance', 'Remaining to pay')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.remainingBalance)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('orders.detail.total', 'Order total value')}</dt>
              <dd className="text-lg font-semibold text-foreground">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="col-span-1 md:col-span-2 rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
            <StickyNote className="h-4 w-4" /> {t("orders.detail.notes", "Order Notes")}
          </div>
          <div className="rounded-xl bg-muted/30 p-4 text-sm text-foreground">
            {order.notes ? (
              <p className="whitespace-pre-wrap">{order.notes}</p>
            ) : (
              <p className="text-muted-foreground italic">{t("orders.detail.noNotes", "No notes")}</p>
            )}
          </div>
        </section>

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
                  placeholder="Customer name"
                  className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={editForm.customerPhone || ""}
                  onChange={(e) => handleEditChange("customerPhone", e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  {order.new_customer && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                      {t('orders.detail.newCustomer', 'New')}
                    </span>
                  )}
                </div>
                {canSeeContacts ? (
                  <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("orders.detail.contactHidden", "Contact details hidden")}</p>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Truck className="h-4 w-4" /> {t("orders.detail.receiver")}
            </div>
            {canSeeContacts ? (
              isEditMode && canEdit ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={editForm.receiverName || ""}
                    onChange={(e) => handleEditChange("receiverName", e.target.value)}
                    placeholder="Receiver name"
                    className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    value={editForm.receiverPhone || ""}
                    onChange={(e) => handleEditChange("receiverPhone", e.target.value)}
                    placeholder="Phone number"
                    className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {(editForm.deliveryType === 'DELIVERY' || (!editForm.deliveryType && order.deliveryType === 'DELIVERY')) && (
                    <input
                      type="text"
                      value={editForm.deliveryAddress || ""}
                      onChange={(e) => handleEditChange("deliveryAddress", e.target.value)}
                      placeholder={t('orders.new.deliveryAddressPlaceholder')}
                      className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">{order.receiverName}</p>
                  <p className="text-sm text-muted-foreground">{order.receiverPhone}</p>
                  {order.deliveryType === 'DELIVERY' && order.deliveryAddress && (
                    <div className="mt-2 border-t border-dashed border-border pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t('orders.detail.deliveryAddress', 'Delivery Address')}:</p>
                      <p className="text-sm text-foreground">{order.deliveryAddress}</p>
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("orders.detail.receiverHidden", "Receiver details hidden")}</p>
            )}
          </div>
        </section>
      </div>

      {
        isEditMode && (
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {t("orders.detail.deliveryInfo", "Delivery Information")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Receive Time</label>
                <input
                  type="datetime-local"
                  value={editForm.receiveTime ? editForm.receiveTime.slice(0, 16) : ""}
                  onChange={(e) => handleEditChange("receiveTime", new Date(e.target.value).toISOString())}
                  className="w-full rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </section>
        )
      }

      <section className="rounded-2xl border border-border bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4" /> {t("orders.new.taskListTitle", "Products")}
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-primary/60"
          >
            <Plus className="h-4 w-4" /> {t("orders.detail.addTask", "Add task")}
          </button>
        </div>
        {relatedTasks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("orders.detail.relatedEmpty")} {t("orders.detail.relatedCta")}
          </p>
        ) : (
          <div className="space-y-8">
            {relatedTasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-6 md:gap-8 border-b border-border pb-8 last:border-0 last:pb-0">
                {/* Task Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary uppercase">
                        {task.type || 'BO_HOA'}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {getTaskStatusLabel ? getTaskStatusLabel(task.status) : task.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-1">{task.taskTitle}</h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className="text-muted-foreground">{t("orders.detail.assignedTo", "Assigned to")}:</span>
                      <select
                        value={task.assigneeId || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value
                          const florist = florists.find((f) => f.id === selectedId)
                          if (florist) {
                            assignTask(task.id, { userId: florist.id, userName: florist.name })
                          }
                        }}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-primary w-fit"
                        disabled={!canEdit}
                      >
                        <option value="" disabled>
                          {t('tasks.unassigned', 'Unassigned')}
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

                {/* Task Images */}
                {(task.samplePhotoUrls && task.samplePhotoUrls.length > 0) ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">{t("addTask.fields.samplePhoto", "Sample Photos")}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {task.samplePhotoUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                          <Image
                            src={url}
                            alt={`Sample ${idx + 1}`}
                            fill
                            className="object-cover transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : task.bouquetImage ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">{t("addTask.fields.samplePhoto", "Sample Photos")}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                        <Image
                          src={task.bouquetImage}
                          alt="Bouquet"
                          fill
                          className="object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Task Notes */}
                {task.notes && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{t('addTask.fields.notes', 'Notes')}</p>
                    <div className="rounded-xl bg-yellow-50/50 border border-yellow-100 p-4 text-sm text-foreground">
                      <p className="whitespace-pre-wrap leading-relaxed">{task.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <AddTaskDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSuccess={handleDialogSuccess}
        initialOrderId={order.id}
        lockOrderSelection
      />
    </div >
  )
}
