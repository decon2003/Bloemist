'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppData } from '@/components/providers/app-data-provider'
import { TaskType } from '@/lib/types'
import { useLocale } from '@/components/providers/locale-provider'
import { fileToDataUrl } from '@/lib/utils'

interface AddTaskDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: (message: string) => void
  initialOrderId?: string
  lockOrderSelection?: boolean
}

export default function AddTaskDialog({
  open,
  onClose,
  onSuccess,
  initialOrderId,
  lockOrderSelection = false,
}: AddTaskDialogProps) {
  const { orders, florists, createTask } = useAppData()
  const router = useRouter()
  const { lang, t } = useLocale()
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedFloristId, setSelectedFloristId] = useState('')
  const [dueTime, setDueTime] = useState(new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderQuery, setOrderQuery] = useState('')
  const [floristQuery, setFloristQuery] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('CAM_HOA')
  const [quantity, setQuantity] = useState(1)
  const [orderless, setOrderless] = useState(false)
  const [samplePhotoUrls, setSamplePhotoUrls] = useState<string[]>([])
  const [samplePhotoInput, setSamplePhotoInput] = useState('')
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null)
  const sampleFileInputRef = useRef<HTMLInputElement | null>(null)

  const defaultOrder = useMemo(() => orders[0], [orders])
  const defaultFlorist = useMemo(() => florists[0], [florists])

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

  const filteredFlorists = useMemo(() => {
    const base = florists.filter(
      (florist) => !floristQuery || florist.name.toLowerCase().includes(floristQuery.toLowerCase()),
    )

    if (selectedFloristId && !base.some((florist) => florist.id === selectedFloristId)) {
      const current = florists.find((florist) => florist.id === selectedFloristId)
      if (current) base.unshift(current)
    }

    return base
  }, [florists, floristQuery, selectedFloristId])

  const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
    { value: 'CAM_HOA', label: t('addTask.taskType.camHoa', 'Flower arranging') },
    { value: 'BO_HOA', label: t('addTask.taskType.boHoa', 'Bouquet making') },
    { value: 'SO_CHE', label: t('addTask.taskType.soChe', 'Preparation') },
    { value: 'DON_DEP', label: t('addTask.taskType.donDep', 'Cleanup') },
    { value: 'IN_BIEN', label: t('addTask.taskType.inBien', 'Card printing') },
    { value: 'BOC_HOA', label: t('addTask.taskType.bocHoa', 'Wrapping') },
    { value: 'SHIP_DON', label: t('addTask.taskType.shipDon', 'Delivery') },
  ]

  const addSamplePhoto = useCallback((url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setSamplePhotoUrls((prev) => [...prev, trimmed])
    setSamplePhotoInput('')
    setSamplePreviewUrl(trimmed)
  }, [])

  const removeSamplePhoto = useCallback((index: number) => {
    setSamplePhotoUrls((prev) => prev.filter((_, idx) => idx !== index))
  }, [])

  const applyOrderDefaults = useCallback(
    (orderId?: string) => {
      if (!orderId) return
      const order = orders.find((o) => o.id === orderId)
      if (!order) return
      setSelectedOrderId(order.id)
      setTaskTitle(`Build ${order.bouquetName} for ${order.customerName}`)
      setOrderQuery(`${order.code} — ${order.customerName}`)
    },
    [orders],
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
    if (!selectedFloristId && defaultFlorist) {
      setSelectedFloristId(defaultFlorist.id)
    }
  }, [defaultFlorist, selectedFloristId])

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
    setSelectedFloristId(defaultFlorist?.id ?? '')
    setDueTime(new Date().toISOString().slice(0, 16))
    setNotes('')
    setTaskType('CAM_HOA')
    setQuantity(1)
    setOrderless(false)
    setSamplePhotoUrls([])
    setSamplePhotoInput('')
    setSamplePreviewUrl(null)
  }, [applyOrderDefaults, initialOrderId, defaultOrder, defaultFlorist])

  const handleOrderChange = (orderId: string) => {
    if (lockOrderSelection) return
    applyOrderDefaults(orderId)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dueTime) return
    const florist = florists.find((entry) => entry.id === selectedFloristId)

    const resolvedOrderId = orderless ? undefined : selectedOrderId || undefined
    const bouquetName = taskTitle || 'Task'

    try {
      setIsSubmitting(true)
      const createdTask = await createTask({
        orderId: resolvedOrderId,
        bouquetName,
        assigneeId: florist?.id,
        assigneeName: florist?.name,
        bouquetImage: samplePhotoUrls[0] || undefined,
        samplePhotoUrls: samplePhotoUrls.length ? samplePhotoUrls : undefined,
        dueTime: new Date(dueTime).toISOString(),
        status: florist ? 'ASSIGNED' : 'UNASSIGNED',
        notes,
        taskTitle,
        type: taskType,
        quantity,
      })

      resetForm()
      onClose()
      onSuccess?.(t('tasks.toast.success'))
      router.push(`/${lang}/tasks/${createdTask.id}`)
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
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Close">
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
              placeholder={t('addTask.fields.taskNamePlaceholder')}
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
            <div className="space-y-2 rounded-xl border border-border bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={samplePhotoInput}
                  onChange={(event) => setSamplePhotoInput(event.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('addTask.fields.samplePhotoPlaceholder', 'Paste one or more image links or upload files')}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addSamplePhoto(samplePhotoInput)}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    {t('addTask.fields.addSamplePhoto', 'Add photo')}
                  </button>
                  <button
                    type="button"
                    onClick={() => sampleFileInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    {t('addTask.fields.uploadSample', 'Upload')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSamplePreviewUrl(samplePhotoUrls[0] || null)}
                    disabled={samplePhotoUrls.length === 0}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('addTask.fields.previewSample', 'Preview')}
                  </button>
                  <input
                    ref={sampleFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const dataUrl = await fileToDataUrl(file)
                      addSamplePhoto(dataUrl)
                      event.target.value = ''
                    }}
                  />
                </div>
              </div>
              {samplePhotoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {samplePhotoUrls.map((photoUrl, index) => (
                    <div key={`${photoUrl}-${index}`} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                      <img
                        src={photoUrl}
                        alt={t('addTask.fields.samplePhotoAlt', 'Arrangement sample')}
                        className="h-full w-full object-cover"
                        onClick={() => setSamplePreviewUrl(photoUrl)}
                      />
                      <button
                        type="button"
                        onClick={() => removeSamplePhoto(index)}
                        className="absolute right-1 top-1 hidden h-6 w-6 rounded-full bg-black/70 text-white hover:bg-black/90 group-hover:block"
                        aria-label={t('addTask.fields.removeSamplePhoto', 'Remove photo')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t('addTask.fields.samplePhotoHint', 'Florists can open these photos full-screen inside the task.')}</p>
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
            <input
              list="florist-options"
              value={floristQuery}
              onChange={(event) => {
                setFloristQuery(event.target.value)
                const match = filteredFlorists.find(
                  (florist) => florist.name.toLowerCase() === event.target.value.toLowerCase(),
                )
                setSelectedFloristId(match?.id || '')
              }}
              placeholder={t('addTask.fields.floristSearch', 'Search florist name')}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="florist-options">
              {filteredFlorists.map((florist) => (
                <option key={florist.id} value={florist.name}></option>
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('addTask.fields.dueTime')}</label>
            <input
              type="datetime-local"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSamplePreviewUrl(null)}>
          <div className="max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <img src={samplePreviewUrl} alt={t('addTask.fields.samplePhotoAlt', 'Arrangement sample')} className="h-full w-full object-contain" />
            <div className="p-3 text-right">
              <button
                type="button"
                onClick={() => setSamplePreviewUrl(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {t('addTask.fields.closePreview', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
