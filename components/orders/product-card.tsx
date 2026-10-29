'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, CheckCircle2, Hand, RotateCcw } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import type { Florist, Task, User } from '@/lib/types'
import { cn, formatCurrencyDisplay, formatDateTime } from '@/lib/utils'
import { thumbUrl } from '@/lib/image-compress'

const STATUS_LABEL: Record<string, string> = {
  UNASSIGNED: 'Chưa có người làm',
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang làm',
  READY: 'Đang làm',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã huỷ',
}
const STATUS_STYLE: Record<string, string> = {
  UNASSIGNED: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  READY: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
}

type Props = {
  task: Task
  user: Pick<User, 'id' | 'role'> | null
  florists: Florist[]
  lang: string
  onViewPhotos: (photos: string[], index: number) => void
  /** After a change that may move the order's status (completing, reopening). */
  onOrderChanged: () => void
}

/** One product of an order, where its work happens: who makes it and
 *  "Hoàn tất". Sales (and managers) add the finished-product photo. */
export function ProductCard({ task, user, florists, lang, onViewPhotos, onOrderChanged }: Props) {
  const { assignTask, unassignTask, completeTask, addTaskProof, updateTaskStatus } = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const role = user?.role ?? ''
  const isManager = role === 'boss' || role === 'admin'
  const canManage = isManager || role === 'sales'
  const mine = !!user && task.assigneeId === user.id
  const done = task.status === 'COMPLETED'
  const cancelled = task.status === 'CANCELLED'
  const overdue = !done && !cancelled && new Date(task.dueTime).getTime() < Date.now()
  // A florist finishes their own product, or an unassigned one (which makes it
  // theirs); sales and managers may mark a florist's product done for them.
  const canComplete = !done && !cancelled && (mine || (!task.assigneeId && !canManage) || (canManage && !!task.assigneeId))
  const canClaim = !done && !cancelled && !task.assigneeId && !canManage
  const samples = task.samplePhotoUrls?.length ? task.samplePhotoUrls : task.bouquetImage ? [task.bouquetImage] : []
  const makers = task.assigneeId && !florists.some((f) => f.id === task.assigneeId)
    ? [{ id: task.assigneeId, name: task.assigneeName ?? '—' }, ...florists]
    : florists

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      after?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thực hiện được'
      // A retry after a lost reply: the first attempt already went through.
      if (message === 'Sản phẩm này đã hoàn tất') {
        clearPhoto()
        onOrderChanged()
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const pickPhoto = (file: File | undefined) => {
    setPhoto(file ?? null)
    setPreview(file ? URL.createObjectURL(file) : null)
  }
  const clearPhoto = () => pickPhoto(undefined)

  const changeMaker = (userId: string) => {
    if (!userId) return run(() => unassignTask(task.id, { userId: '', userName: '' }))
    if (done && !window.confirm('Sản phẩm đã hoàn tất. Đổi người làm sẽ chuyển hoa hồng làm đơn sang người mới. Tiếp tục?')) return
    const name = makers.find((f) => f.id === userId)?.name ?? ''
    return run(() => assignTask(task.id, { userId, userName: name }))
  }

  return (
    <div className={cn('rounded-xl border p-4', mine ? 'border-blue-200 bg-blue-50/40' : 'border-border', cancelled && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={cn('text-lg font-bold text-foreground', cancelled && 'line-through')}>{task.taskTitle}</h3>
          <p className={cn('text-sm', overdue ? 'font-semibold text-red-700' : 'text-muted-foreground')}>
            Hạn làm {formatDateTime(task.dueTime, lang)}
            {overdue ? ' · Quá hạn' : ''}
          </p>
          {task.price != null && (
            <p className="text-sm text-muted-foreground">Giá hoa {formatCurrencyDisplay(task.price, '—')}</p>
          )}
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', STATUS_STYLE[task.status] ?? 'bg-muted text-foreground')}>
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Người làm:</span>
        {canManage && !cancelled && (!done || isManager) ? (
          <select
            value={task.assigneeId ?? ''}
            disabled={busy}
            onChange={(e) => changeMaker(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm font-medium focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled={done}>Chưa có người làm</option>
            {makers.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-foreground">
            {task.assigneeName ?? 'Chưa có người làm'}
            {mine ? ' (bạn)' : ''}
          </span>
        )}
      </div>

      {samples.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Ảnh mẫu</p>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {samples.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => onViewPhotos(samples, index)}
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                <Image src={thumbUrl(url)} alt={`Ảnh mẫu ${index + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {task.notes && (
        <div className="mt-3 rounded-xl border border-yellow-100 bg-yellow-50/60 p-3 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground">{task.notes}</p>
        </div>
      )}

      {done ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
          {task.completionProofUrl && (
            <button
              type="button"
              onClick={() => onViewPhotos([task.completionProofUrl!], 0)}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-green-200"
            >
              <Image src={thumbUrl(task.completionProofUrl)} alt="Ảnh thành phẩm" fill className="object-cover" />
            </button>
          )}
          <div className="text-sm text-green-900">
            <p className="flex items-center gap-1 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Đã hoàn tất{task.completedAt ? ` lúc ${formatDateTime(task.completedAt, lang)}` : ''}
            </p>
            <p>Người làm: {task.assigneeName ?? '—'}</p>
            {!task.completionProofUrl && !canManage && <p className="text-xs text-green-800/80">Sale sẽ chụp ảnh thành phẩm.</p>}
            {canManage && !preview && (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary underline"
              >
                <Camera className="h-4 w-4" /> {task.completionProofUrl ? 'Đổi ảnh thành phẩm' : 'Thêm ảnh thành phẩm'}
              </button>
            )}
          </div>
          {isManager && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Mở lại sản phẩm này? Ảnh thành phẩm sẽ bị xoá và cần hoàn tất lại.')) {
                  run(() => updateTaskStatus(task.id, 'ASSIGNED'), onOrderChanged)
                }
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline"
            >
              <RotateCcw className="h-3 w-3" /> Mở lại
            </button>
          )}
        </div>
      ) : cancelled ? (
        <p className="mt-3 text-sm text-red-700">Sản phẩm đã huỷ, không cần làm.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canClaim && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => assignTask(task.id, { userId: user!.id, userName: '' }))}
              className="inline-flex items-center gap-2 rounded-xl border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              <Hand className="h-4 w-4" /> Nhận làm
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Đánh dấu "${task.taskTitle}" đã làm xong?`)) run(() => completeTask(task.id), onOrderChanged)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {busy ? 'Đang lưu…' : 'Hoàn tất'}
            </button>
          )}
          {!canComplete && !canClaim && task.assigneeId && !mine && (
            <p className="text-sm text-muted-foreground">Đang do {task.assigneeName} làm.</p>
          )}
        </div>
      )}

      {done && preview && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">Ảnh thành phẩm</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Ảnh thành phẩm" className="max-h-64 rounded-lg object-contain" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => photo && run(() => addTaskProof(task.id, photo), clearPhoto)}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {busy ? 'Đang gửi…' : 'Lưu ảnh'}
            </button>
            <button type="button" disabled={busy} onClick={clearPhoto} className="px-2 text-sm text-muted-foreground underline">
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* No `capture`: sales may take a photo or pick one already taken. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
