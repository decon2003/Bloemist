'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppData } from '@/components/providers/app-data-provider'
import type { Order, TaskType } from '@/lib/types'
import { useLocale } from '@/components/providers/locale-provider'
import { uploadPhoto } from '@/lib/api'
import { PhotoViewer } from '@/components/photo-viewer'
import { thumbUrl } from '@/lib/image-compress'
import { toDateTimeLocalValue } from '@/lib/utils'
import { DateTimeInput24 } from '@/components/time-input-24'

interface AddTaskDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: (message: string) => void
  initialOrderId?: string
  lockOrderSelection?: boolean
  /** The order itself, when opened from its page (not looked up in a list). */
  order?: Order
}

/** Products are due two hours before the customer receives the order. */
const dueBefore = (receiveTime: string) => toDateTimeLocalValue(new Date(new Date(receiveTime).getTime() - 2 * 60 * 60 * 1000))

export default function AddTaskDialog({
  open,
  onClose,
  onSuccess,
  initialOrderId,
  lockOrderSelection = false,
  order: givenOrder,
}: AddTaskDialogProps) {
  const { orders, florists, createTask } = useAppData()
  const router = useRouter()
  const { lang, t } = useLocale()
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedFloristId, setSelectedFloristId] = useState('')
  const [dueTime, setDueTime] = useState(toDateTimeLocalValue(new Date()))
  const [notes, setNotes] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('CAM_HOA')
  const [quantity, setQuantity] = useState(1)
  const [orderless, setOrderless] = useState(false)
  const [samplePhotoUrls, setSamplePhotoUrls] = useState<string[]>([])
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sampleFileInputRef = useRef<HTMLInputElement | null>(null)

  // From the Tasks page nothing is pre-selected: the order is picked on purpose.
  const defaultOrder = useMemo(() => (givenOrder && lockOrderSelection ? givenOrder : undefined), [givenOrder, lockOrderSelection])

  const filteredOrders = useMemo(() => {
    const base = orders.filter(
      (order) =>
        !orderQuery ||
        order.code.toLowerCase().includes(orderQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(orderQuery.toLowerCase()),
    )

    if (selectedOrderId && !base.some((order) => order.id === selectedOrderId)) {
      const current = orders.find((order) => order.id === selectedOrderId)
      if (current) base.unshift(current)
    }

    return base
  }, [orders, orderQuery, selectedOrderId])


  const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: 'CAM_HOA', label: t('addTask.taskType.camHoa', 'Flower arranging') },
    { value: 'BO_HOA', label: t('addTask.taskType.boHoa', 'Bouquet making') },
    { value: 'SO_CHE', label: t('addTask.taskType.soChe', 'Preparation') },
    { value: 'DON_DEP', label: t('addTask.taskType.donDep', 'Cleanup') },
    { value: 'IN_BIEN', label: t('addTask.taskType.inBien', 'Card printing') },
    { value: 'BOC_HOA', label: t('addTask.taskType.bocHoa', 'Wrapping') },
    { value: 'SHIP_DON', label: t('addTask.taskType.shipDon', 'Delivery') },
  ]

  const [uploadingSamples, setUploadingSamples] = useState(0)
  /** Upload sample photos (picked, taken or pasted) one after another. */
  const uploadSamples = useCallback(async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    setUploadingSamples((n) => n + images.length)
    for (const file of images) {
      try {
        const url = await uploadPhoto(file)
        setSamplePhotoUrls((prev) => [...prev, url])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được ảnh lên')
      } finally {
        setUploadingSamples((n) => n - 1)
      }
    }
  }, [])

  const removeSamplePhoto = useCallback((index: number) => {
    setSamplePhotoUrls((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const applyOrderDefaults = useCallback(
    (orderId?: string) => {
      if (!orderId) return
      const order = givenOrder?.id === orderId ? givenOrder : orders.find((o) => o.id === orderId)
      if (!order) return
      setSelectedOrderId(order.id)
      setOrderQuery(`${order.code} — ${order.customerName || 'Chưa có tên khách'}`)
      setDueTime(dueBefore(order.receiveTime))
    },
    [orders, givenOrder],
  )

  useEffect(() => {
    if (!open) return
    if (initialOrderId) {
      applyOrderDefaults(initialOrderId)
      return
    }
    if (!selectedOrderId && defaultOrder) {
      applyOrderDefaults(defaultOrder.id)
    }
  }, [open, initialOrderId, applyOrderDefaults, defaultOrder, selectedOrderId])

  useEffect(() => {
    if (!lockOrderSelection) return
    setOrderless(false)
    if (initialOrderId) {
      applyOrderDefaults(initialOrderId)
    }
  }, [lockOrderSelection, initialOrderId, applyOrderDefaults])

  const resetForm = useCallback(() => {
    if (initialOrderId) {
      applyOrderDefaults(initialOrderId)
    } else if (defaultOrder) {
      applyOrderDefaults(defaultOrder.id)
    } else {
      setSelectedOrderId('')
      setTaskTitle('')
      setOrderQuery('')
    }
    setSelectedFloristId('')
    setTaskTitle('')
    setError(null)
    if (!initialOrderId && !defaultOrder) setDueTime(toDateTimeLocalValue(new Date()))
    setNotes('')
    setTaskType('CAM_HOA')
    setQuantity(1)
    setOrderless(false)
    setSamplePhotoUrls([])
    setSamplePreviewUrl(null)
  }, [applyOrderDefaults, initialOrderId, defaultOrder])

  const handleOrderChange = (orderId: string) => {
    if (lockOrderSelection) return
    applyOrderDefaults(orderId)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!taskTitle.trim()) return setError('Vui lòng nhập tên việc')
    if (!dueTime) return setError('Vui lòng chọn hạn làm')
    if (uploadingSamples > 0) return setError('Ảnh mẫu đang tải lên, đợi xong rồi thêm việc')
    const resolvedOrderId = orderless ? undefined : selectedOrderId || undefined

    try {
      setIsSubmitting(true)
      // The server reads the maker's name from the account and sets the status.
      const createdTask = await createTask({
        orderId: resolvedOrderId,
        bouquetName: taskTitle.trim(),
        assigneeId: selectedFloristId || undefined,
        bouquetImage: samplePhotoUrls[0] || undefined,
        samplePhotoUrls: samplePhotoUrls.length ? samplePhotoUrls : undefined,
        dueTime: new Date(dueTime).toISOString(),
        notes,
        taskTitle: taskTitle.trim(),
        type: taskType,
        quantity,
      })

      resetForm()
      onClose()
      onSuccess?.('Đã thêm việc')
      // From an order's page the new item shows up there; elsewhere open it.
      if (!lockOrderSelection) router.push(`/${lang}/tasks/${createdTask.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được việc')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 md:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-white shadow-xl md:max-h-[90vh] md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{t('addTask.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('addTask.subtitle')}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Đóng">
            <Plus className="h-5 w-5 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">{t('addTask.fields.order')}</label>
              {lockOrderSelection ? (
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {t('addTask.fields.lockedOrder', 'Linked to this order')}
                </span>
              ) : (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={orderless}
                    onChange={(event) => {
                      setOrderless(event.target.checked)
                      if (event.target.checked) {
                        setSelectedOrderId('')
                        setOrderQuery('')
                      }
                    }}
                    className="h-4 w-4"
                  />
                  {t('addTask.fields.noOrder', 'No linked order')}
                </label>
              )}
            </div>
            {!orderless && (
              <>
                <input
                  list="order-options"
                  value={orderQuery}
                  onChange={(event) => {
                    if (lockOrderSelection) return
                    setOrderQuery(event.target.value)
                    const match = filteredOrders.find(
                      (order) => order.code.toLowerCase() === event.target.value.toLowerCase(),
                    )
                    if (match) handleOrderChange(match.id)
                  }}
                  placeholder={t('addTask.fields.orderSearch', 'Search order code or customer')}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/50"
                  disabled={lockOrderSelection}
                  readOnly={lockOrderSelection}
                />
                {!lockOrderSelection && (
                  <datalist id="order-options">
                    {filteredOrders.map((order) => (
                      <option key={order.id} value={`${order.code} — ${order.customerName}`}></option>
                    ))}
                  </datalist>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('addTask.fields.taskName')}</label>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Ví dụ: In thiệp, gói thêm 1 bó nhỏ"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{t('addTask.fields.samplePhoto', 'Sample photos')}</span>
              {samplePhotoUrls.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('addTask.fields.samplePhotoCount', '{{count}} photo(s)').replace(
                    '{{count}}',
                    String(samplePhotoUrls.length),
                  )}
                </span>
              )}
            </div>
            <div
              tabIndex={0}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files)
                if (!files.some((file) => file.type.startsWith('image/'))) return
                event.preventDefault()
                uploadSamples(files)
              }}
              className="space-y-2 rounded-xl border border-dashed border-border bg-white p-3 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex flex-wrap gap-2">
                {samplePhotoUrls.map((photoUrl, index) => (
                  <div key={`${photoUrl}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                    <img
                      src={thumbUrl(photoUrl)}
                      alt={`Ảnh mẫu ${index + 1}`}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setSamplePreviewUrl(photoUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => removeSamplePhoto(index)}
                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-white hover:bg-black/90"
                      aria-label="Bỏ ảnh"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted">
                  <input
                    ref={sampleFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      uploadSamples(Array.from(event.target.files ?? []))
                      event.target.value = ''
                    }}
                  />
                  <ImagePlus className="h-5 w-5" />
                  {uploadingSamples > 0 ? 'Đang tải…' : 'Thêm ảnh'}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Chụp, chọn từ máy hoặc dán ảnh (Ctrl+V). Thợ bấm vào ảnh để phóng to.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('addTask.fields.type', 'Task type')}</label>
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value as TaskType)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {taskTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('addTask.fields.quantity', 'Products to prepare')}</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('addTask.fields.assign')}</label>
            <select
              value={selectedFloristId}
              onChange={(event) => setSelectedFloristId(event.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Chưa phân công (thợ tự nhận)</option>
              {florists.map((florist) => (
                <option key={florist.id} value={florist.id}>{florist.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Việc thêm ở đây không cộng vào giá đơn và không tính hoa hồng làm đơn.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('addTask.fields.dueTime')}</label>
            <DateTimeInput24
              value={dueTime}
              onChange={setDueTime}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('addTask.fields.notes')}</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('addTask.fields.notesPlaceholder')}
            />
          </div>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                onClose()
              }}
              className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t('addTask.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t('addTask.actions.creating', 'Creating...') : t('addTask.actions.create')}
            </button>
          </div>
        </form>
      </div>
      {samplePreviewUrl && (
        <PhotoViewer
          photos={samplePhotoUrls.includes(samplePreviewUrl) ? samplePhotoUrls : [samplePreviewUrl]}
          startIndex={Math.max(0, samplePhotoUrls.indexOf(samplePreviewUrl))}
          onClose={() => setSamplePreviewUrl(null)}
        />
      )}
    </div>
  )
}
