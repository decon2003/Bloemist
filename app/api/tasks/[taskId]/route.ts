import { NextResponse } from 'next/server'
import { getTask, updateTask } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const task = await getTask(taskId)
    return NextResponse.json(task)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await readJsonBody(request)
    const updated = await updateTask(taskId, body)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
