import { NextResponse } from 'next/server'
import { createTask, listTasks, redactTaskFor } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { ORDER_WRITE_ROLES, requireUser } from '@/lib/server/session'
import { parseListScope } from '@/lib/server/list-scope'
import { audit } from '@/lib/server/audit'

// ?orderId=<id> for one order's tasks; otherwise ?from&to (due date, Vietnam
// days) or ?q=search. &mine=1 limits to tasks assigned to the caller,
// &assigneeId=<id|none> to one maker (or nobody yet); &overdue=1 adds
// unfinished tasks due before a window that includes today.
export async function GET(request: Request) {
  try {
    const me = await requireUser(request)
    const params = new URL(request.url).searchParams
    const orderId = params.get('orderId')
    const scope = orderId ? { kind: 'order' as const, orderId } : parseListScope(params, me)
    const assigneeId = params.get('mine') === '1' ? me.id : params.get('assigneeId') || undefined
    const tasks = await listTasks(scope, { assigneeId, viewerRole: me.role, withOverdue: params.get('overdue') === '1' })
    return NextResponse.json(tasks.map((task) => redactTaskFor(me, task)))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const body = await readJsonBody(request)
    const created = await createTask(body)
    await audit(me, { action: 'task.create', entity: 'task', entityId: created.id, summary: created.taskTitle })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
