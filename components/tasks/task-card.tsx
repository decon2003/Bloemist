'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Task } from '@/lib/types'
import { useLocale } from '@/components/providers/locale-provider'
import { formatDateTime } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  href: string
}

export default function TaskCard({ task, href }: TaskCardProps) {
  const { lang, t, getTaskStatusLabel } = useLocale()

  const thumbnail = task.samplePhotoUrls?.[0] || task.bouquetImage || '/placeholder.jpg'

  return (
    <Link
      href={href}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-white/90 p-5 transition hover:border-primary/60 hover:shadow-md lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex flex-1 items-center gap-4">
        <Image
          src={thumbnail}
          alt={task.bouquetName}
          width={64}
          height={64}
          className="h-16 w-16 rounded-xl object-cover"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{task.orderCode || t('tasks.unlinked', 'Unlinked')}</p>
          <h2 className="text-lg font-semibold text-foreground">{task.taskTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {t('tasks.assignedLabel')}: {task.assigneeName || t('tasks.unassigned', 'Unassigned')}
          </p>
        </div>
      </div>
      <div className="grid gap-4 text-sm lg:grid-cols-2 lg:[&>div]:min-w-[140px]">
        <div>
          <p className="text-muted-foreground">{t('tasks.card.dueDate', 'Due Date')}</p>
          <p className="font-semibold text-foreground">{formatDateTime(task.dueTime, lang)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('tasks.card.status', 'Status')}</p>
          <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {getTaskStatusLabel(task.status)}
          </span>
        </div>
      </div>
    </Link>
  )
}
