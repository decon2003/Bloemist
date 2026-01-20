'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2, Clock, Pencil, Camera, X } from 'lucide-react'
import { useAppData } from '@/components/providers/app-data-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { Task, TaskStatus } from '@/lib/types'
import { fetchTask } from '@/lib/api'
import { fileToDataUrl, formatDateTime } from '@/lib/utils'

interface TaskDetailPageProps {
  taskId: string
}

const statusSteps: TaskStatus[] = ['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'READY', 'COMPLETED']

export default function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const { updateTaskStatus, assignTask, unassignTask, completeTask, updateTask } = useAppData()
  const { user } = useAuth()
  const { lang, t, getTaskStatusLabel, getDeliveryLabel } = useLocale()
  const [task, setTask] = useState<Task | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [notes, setNotes] = useState('')
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('ASSIGNED')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [completionFile, setCompletionFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueTime, setEditDueTime] = useState('')
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [samplePhotoUrls, setSamplePhotoUrls] = useState<string[]>([])
  const [samplePhotoInput, setSamplePhotoInput] = useState('')
  const sampleFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let active = true
    const loadTask = async () => {
      setIsFetching(true)
      setLoadError(null)
      try {
        const response = await fetchTask(taskId)
        if (!active) return
        setTask(response)
      } catch (error) {
        if (!active) return
        console.error('Failed to load task', error)
        setTask(null)
        setLoadError(t('taskDetail.loadError', 'Unable to load task.'))
      } finally {
        if (active) {
          setIsFetching(false)
        }
      }
    }

    loadTask()
    return () => {
      active = false
    }
  }, [taskId, t])

  useEffect(() => {
    if (task) {
      setNotes(task.notes)
      setActiveStatus(task.status)
      setEditTitle(task.taskTitle)
      setEditDueTime(new Date(task.dueTime).toISOString().slice(0, 16))
      setSamplePhotoUrls(task.samplePhotoUrls || [])
    }
  }, [task])

  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview)
      }
    }
  }, [proofPreview])

  if (isFetching) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <div className="rounded-2xl border border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {t('tasks.loading', 'Loading tasks...')}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/tasks`} className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> {t('taskDetail.back')}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {loadError}
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Link href={`/${lang}/tasks`} className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> {t('taskDetail.back')}
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-10 text-center text-muted-foreground">
          {t('taskDetail.notFound')}
        </div>
      </div>
    )
  }

  const isAssignedToCurrentUser = Boolean(task && task.assigneeId && user && task.assigneeId === user.id)
  const assignDisabled = Boolean(task?.assigneeId) && !isAssignedToCurrentUser
  const assignedToLabel = task?.assigneeName
    ? `${t('taskDetail.assignedTo', 'Assigned to')} ${task.assigneeName}`
    : t('taskDetail.assignToMe', 'Assign to me')

  const handleStartTask = async () => {
    if (!task || task.status === 'IN_PROGRESS') return
    try {
      setIsStarting(true)
      const updated = await updateTaskStatus(task.id, 'IN_PROGRESS')
      setTask(updated)
      setActiveStatus(updated.status)
    } finally {
      setIsStarting(false)
    }
  }

  const handleAssignToMe = async () => {
    if (!task || !user || assignDisabled) return
    try {
      setIsAssigning(true)
      const updated = await assignTask(task.id, { userId: user.id, userName: user.name })
      setTask(updated)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    if (!task || !user || !isAssignedToCurrentUser) return
    try {
      setIsUnassigning(true)
      const updated = await unassignTask(task.id, { userId: user.id, userName: user.name })
      setTask(updated)
    } finally {
      setIsUnassigning(false)
    }
  }

  const openCompletionDialog = () => {
    setCompletionDialogOpen(true)
  }

  const closeCompletionDialog = () => {
    setCompletionDialogOpen(false)
    if (proofPreview) {
      URL.revokeObjectURL(proofPreview)
    }
    setProofPreview(null)
    setCompletionFile(null)
  }

  const handleProofChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (proofPreview) {
      URL.revokeObjectURL(proofPreview)
    }
    setCompletionFile(file ?? null)
    setProofPreview(file ? URL.createObjectURL(file) : null)
  }

  const submitCompletion = async () => {
    if (!task || !completionFile) return
    try {
      setIsCompleting(true)
      const updated = await completeTask(task.id, completionFile)
      setTask(updated)
      closeCompletionDialog()
    } finally {
      setIsCompleting(false)
    }
  }

  const lastAssignmentDate = task?.lastAssignedAt ? new Date(task.lastAssignedAt) : null
  const lastAssignmentLabel = task && !task.assigneeId && task.lastAssigneeName && lastAssignmentDate
    ? `${t('taskDetail.lastAssigned', 'Last assigned to')} ${task.lastAssigneeName} · ${formatDateTime(lastAssignmentDate, lang)}`
    : null

  const saveDetails = async () => {
    if (!task) return
    try {
      setIsSavingDetails(true)
      const updated = await updateTask(task.id, {
        taskTitle: editTitle,
        dueTime: new Date(editDueTime).toISOString(),
        samplePhotoUrls: samplePhotoUrls.length ? samplePhotoUrls : undefined,
        bouquetImage: samplePhotoUrls[0] || task.bouquetImage,
        notes,
      })
      setTask(updated)
      setActiveStatus(updated.status)
      setSamplePhotoUrls(updated.samplePhotoUrls || [])
      setNotes(updated.notes)
      setIsEditing(false)
    } finally {
      setIsSavingDetails(false)
    }
  }

  const samplePhotos = isEditing ? samplePhotoUrls : task?.samplePhotoUrls || []
  const thumbnailUrl = samplePhotos[0] || task?.bouquetImage || '/placeholder.jpg'

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <Link href={`/${lang}/tasks`} className="inline-flex items-center gap-2 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('taskDetail.back')}
      </Link>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{task.orderCode}</p>
          <h1 className="text-3xl font-bold text-foreground">{task.taskTitle}</h1>
          <p className="text-muted-foreground">
            {t('taskDetail.assignedLabel')}: {task.assigneeName || t('tasks.unassigned', 'Unassigned')}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditTitle(task.taskTitle)
                  setEditDueTime(new Date(task.dueTime).toISOString().slice(0, 16))
                  setNotes(task.notes)
                  setSamplePhotoUrls(task.samplePhotoUrls || [])
                  setSamplePhotoInput('')
                }}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {t('taskDetail.cancelEdit', 'Cancel edit')}
              </button>
              <button
                onClick={saveDetails}
                disabled={isSavingDetails}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDetails ? t('taskDetail.saving', 'Saving...') : t('taskDetail.saveChanges', 'Save changes')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              {t('taskDetail.editAction', 'Edit task')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {isAssignedToCurrentUser ? (
            <>
              {task.status === 'ASSIGNED' ? (
                <button
                  onClick={handleStartTask}
                  disabled={isStarting}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStarting ? t('taskDetail.saving', 'Saving...') : t('taskDetail.startTask', 'Start Task')}
                </button>
              ) : (
                <button
                  onClick={openCompletionDialog}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                >
                  {t('taskDetail.completeCta', 'Complete')}
                </button>
              )}
              <button
                onClick={handleUnassign}
                disabled={isUnassigning}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUnassigning ? t('taskDetail.unassigning', 'Unassigning...') : t('taskDetail.unassign', 'Unassign')}
              </button>
            </>
          ) : (
            <button
              onClick={handleAssignToMe}
              disabled={!user || assignDisabled || isAssigning}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assignDisabled
                ? assignedToLabel
                : isAssigning
                  ? t('taskDetail.assigning', 'Assigning...')
                  : t('taskDetail.assignToMe', 'Assign to me')}
            </button>
          )}
        </div>
        {lastAssignmentLabel && <p className="text-xs text-muted-foreground">{lastAssignmentLabel}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6 rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-col items-start gap-3">
              <Image
                src={thumbnailUrl}
                alt={task.bouquetName}
                width={160}
                height={160}
                className="h-40 w-40 rounded-2xl object-cover"
              />
              <button
                type="button"
                onClick={() => setSamplePreviewUrl(thumbnailUrl)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {t('taskDetail.viewSample', 'View full screen')}
              </button>
              {samplePhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {samplePhotos.map((photoUrl, index) => (
                    <button
                      key={`${photoUrl}-${index}`}
                      type="button"
                      onClick={() => setSamplePreviewUrl(photoUrl)}
                      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Image
                        src={photoUrl}
                        alt={t('taskDetail.samplePhotoAlt', 'Arrangement sample')}
                        width={72}
                        height={72}
                        className="h-[72px] w-[72px] object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {isEditing && (
                <div className="w-full space-y-2 rounded-xl border border-border bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={samplePhotoInput}
                      onChange={(event) => setSamplePhotoInput(event.target.value)}
                      className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t('addTask.fields.samplePhotoPlaceholder', 'Paste one or more image links or upload a file')}
                    />
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (!samplePhotoInput.trim()) return
                          setSamplePhotoUrls((prev) => [...prev, samplePhotoInput.trim()])
                          setSamplePhotoInput('')
                        }}
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
                          setSamplePhotoUrls((prev) => [...prev, dataUrl])
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
                            onClick={() => setSamplePhotoUrls((prev) => prev.filter((_, i) => i !== index))}
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
              )}
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('taskDetail.sections.bouquet')}</dt>
                <dd className="text-lg font-semibold text-foreground">{task.bouquetName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('taskDetail.sections.deliveryType')}</dt>
                <dd className="text-lg font-semibold text-foreground">{getDeliveryLabel(task.deliveryType)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t(
                    `taskDetail.sections.deliveryInstruction.${
                      task.deliveryType === 'DELIVERY' ? 'delivery' : 'pickup'
                    }`,
                  )}
                </dt>
                <dd className="font-semibold text-foreground">{formatDateTime(task.deliveryTime, lang)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('taskDetail.sections.created')}</dt>
                <dd className="font-semibold text-foreground">{formatDateTime(task.createdAt, lang)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('taskDetail.priceLabel', 'Task price')}</dt>
                <dd className="font-semibold text-foreground">{task.price || '—'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('taskDetail.sections.orderInfo')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('taskDetail.sections.customer')}</p>
                <p className="text-sm font-semibold text-foreground">{task.customerName}</p>
                <p className="text-sm text-muted-foreground">{task.customerPhone}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('taskDetail.sections.receiver')}</p>
                <p className="text-sm font-semibold text-foreground">{task.receiverName}</p>
                <p className="text-sm text-muted-foreground">{task.receiverPhone}</p>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t('taskDetail.editTitle', 'Edit task')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('taskDetail.editSubtitle', 'Update task basics to keep everyone aligned.')}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-foreground">
                  <span>{t('addTask.fields.taskName')}</span>
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-foreground">
                  <span>{t('addTask.fields.dueTime')}</span>
                  <input
                    type="datetime-local"
                    value={editDueTime}
                    onChange={(event) => setEditDueTime(event.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6 rounded-2xl border border-border bg-white p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('taskDetail.sections.status')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeStatus === 'COMPLETED' ? t('taskDetail.taskIsCompleted') : t('taskDetail.nextStep')}
            </p>
            <div className="mt-4 space-y-2 text-sm text-foreground">
              {statusSteps.map((step) => (
                <div key={step} className="flex items-center gap-3">
                  {activeStatus === step ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span className={activeStatus === step ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {getTaskStatusLabel(step)}
                  </span>
                </div>
              ))}
            </div>
            {task.completionProofUrl && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('taskDetail.completionProof', 'Completion proof')}
                </p>
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <img src={task.completionProofUrl} alt="Completion proof" className="h-48 w-full object-cover" />
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('taskDetail.sections.notes')}
            </h2>
            <div className="mt-3 space-y-3">
              {isEditing ? (
                <>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-border bg-muted/30 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('taskDetail.notesPlaceholder')}
                  />
                  <button
                    onClick={saveDetails}
                    disabled={isSavingDetails}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Pencil className="h-4 w-4" />
                    {isSavingDetails ? t('taskDetail.saving', 'Saving...') : t('taskDetail.saveNotes', 'Save notes')}
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/30 p-3 text-sm text-foreground">
                  {notes?.trim() ? notes : t('taskDetail.notesPlaceholder')}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {samplePreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSamplePreviewUrl(null)}
        >
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSamplePreviewUrl(null)}
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label={t('taskDetail.closePreview', 'Close preview')}
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={samplePreviewUrl}
              alt={t('taskDetail.samplePhotoAlt', 'Arrangement sample')}
              className="max-h-[80vh] w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {completionDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('taskDetail.completeTitle', 'Add completion photo')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('taskDetail.completeSubtitle', 'Upload or take a photo to confirm completion.')}
                </p>
              </div>
              <button onClick={closeCompletionDialog} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
              {proofPreview ? (
                <img src={proofPreview} alt="Preview" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <span>{t('taskDetail.completeHint', 'Tap to upload or take a photo')}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofChange}
                className="sr-only"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                onClick={closeCompletionDialog}
                className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {t('taskDetail.cancelCompletion', 'Cancel')}
              </button>
              <button
                onClick={submitCompletion}
                disabled={!completionFile || isCompleting}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCompleting ? t('taskDetail.submitting', 'Submitting...') : t('taskDetail.confirmCompletion', 'Confirm completion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
