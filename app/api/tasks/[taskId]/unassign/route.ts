import { NextResponse } from 'next/server'
import { getTask, redactTaskFor, unassignTask } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request)
    const { taskId } = await params
    const before = await getTask(taskId)
    const updated = await unassignTask(taskId, me)
    await audit(me, { action: 'task.unassign', entity: 'task', entityId: taskId, summary: updated.taskTitle, changes: diff(before, updated, ['assigneeName', 'status']) })
    return NextResponse.json(redactTaskFor(me, updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
