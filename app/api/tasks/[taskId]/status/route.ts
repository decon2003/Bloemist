import { NextResponse } from 'next/server'
import { updateTaskStatus } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await request.json()
    const updated = await updateTaskStatus(taskId, body.status)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
