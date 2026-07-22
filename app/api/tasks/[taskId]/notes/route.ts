import { NextResponse } from 'next/server'
import { updateTaskNotes } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await readJsonBody(request)
    const updated = await updateTaskNotes(taskId, body.notes)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
