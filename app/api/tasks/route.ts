import { NextResponse } from 'next/server'
import { createTask, listTasks } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { parseListScope } from '@/lib/server/list-scope'
import { audit } from '@/lib/server/audit'

// ?orderId=<id> for one order's tasks; otherwise ?from&to (due date, Vietnam
// days) or ?q=search. &mine=1 limits to tasks assigned to the caller.
export async function GET(request: Request) {
  try {
    const me = await requireUser(request)
    const params = new URL(request.url).searchParams
    const orderId = params.get('orderId')
    const scope = orderId ? { kind: 'order' as const, orderId } : parseListScope(params, me)
    const tasks = await listTasks(scope, { assigneeId: params.get('mine') === '1' ? me.id : undefined })
    return NextResponse.json(tasks)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const me = await requireUser(request)
    const body = await readJsonBody(request)
    const created = await createTask(body)
    await audit(me, { action: 'task.create', entity: 'task', entityId: created.id, summary: created.taskTitle })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
