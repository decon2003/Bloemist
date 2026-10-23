import { NextResponse } from 'next/server'
import { getTask, redactTaskFor, updateTaskNotes } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request)
    const { taskId } = await params
    const body = await readJsonBody(request)
    const before = await getTask(taskId)
    const updated = await updateTaskNotes(taskId, body.notes)
    await audit(me, { action: 'task.notes', entity: 'task', entityId: taskId, summary: updated.taskTitle, changes: diff(before, updated, ['notes']) })
    return NextResponse.json(redactTaskFor(me, updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
