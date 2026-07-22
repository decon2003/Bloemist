import { NextResponse } from 'next/server'
import { unassignTask } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await readJsonBody(request)
    const updated = await unassignTask(taskId, body)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
