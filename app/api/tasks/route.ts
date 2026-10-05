import { NextResponse } from 'next/server'
import { createTask, listTasks } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const tasks = await listTasks()
    return NextResponse.json(tasks)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(request)
    const body = await readJsonBody(request)
    const created = await createTask(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
