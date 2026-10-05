import { NextResponse } from 'next/server'
import { unassignTask } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    await requireUser(request)
    const { taskId } = await params
    const body = await readJsonBody(request)
    const updated = await unassignTask(taskId, body)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
