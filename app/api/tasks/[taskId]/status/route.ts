import { NextResponse } from 'next/server'
import { updateTaskStatus } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    await requireUser(request)
    const { taskId } = await params
    const body = await readJsonBody(request)
    const updated = await updateTaskStatus(taskId, body.status)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
