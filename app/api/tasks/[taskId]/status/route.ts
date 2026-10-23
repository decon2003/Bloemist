import { NextResponse } from 'next/server'
import { getTask, redactTaskFor, syncOrderStatusWithTasks, updateTaskStatus } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'
import { auditOrderStatus } from '../../order-status'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request)
    const { taskId } = await params
    const body = await readJsonBody(request)
    const before = await getTask(taskId)
    const updated = await updateTaskStatus(taskId, body.status, me)
    await audit(me, { action: 'task.status', entity: 'task', entityId: taskId, summary: updated.taskTitle, changes: diff(before, updated, ['status']) })
    await auditOrderStatus(me, await syncOrderStatusWithTasks(updated.orderId ?? null), updated.orderId)
    return NextResponse.json(redactTaskFor(me, updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
