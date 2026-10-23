import { NextResponse } from 'next/server'
import { completeTask, redactTaskFor, syncOrderStatusWithTasks } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { audit } from '@/lib/server/audit'
import { auditOrderStatus } from '../../order-status'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request)
    const { taskId } = await params
    const formData = await request.formData()
    const photo = formData.get('photo')
    const updated = await completeTask(taskId, { photo: photo as File | Blob, thumb: formData.get('thumb') }, me)
    await audit(me, { action: 'task.complete', entity: 'task', entityId: taskId, summary: `${updated.taskTitle} · ${updated.assigneeName ?? ''}` })
    // Every product made: the order becomes "Sẵn sàng".
    await auditOrderStatus(me, await syncOrderStatusWithTasks(updated.orderId ?? null), updated.orderId)
    return NextResponse.json(redactTaskFor(me, updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
