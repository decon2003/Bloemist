import { NextResponse } from 'next/server'
import { getTask, updateTask } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    await requireUser(request)
    const { taskId } = await params
    const task = await getTask(taskId)
    return NextResponse.json(task)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request)
    const { taskId } = await params
    const body = await readJsonBody(request)
    const before = await getTask(taskId)
    const updated = await updateTask(taskId, body)
    const changes = diff(before, updated, ['taskTitle', 'bouquetName', 'dueTime', 'notes', 'price', 'quantity', 'type', 'samplePhotoUrls', 'status'])
    if (changes) await audit(me, { action: 'task.update', entity: 'task', entityId: taskId, summary: updated.taskTitle, changes })
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
