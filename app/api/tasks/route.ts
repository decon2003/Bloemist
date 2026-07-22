import { NextResponse } from 'next/server'
import { createTask, listTasks } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'

export async function GET() {
  try {
    const tasks = await listTasks()
    return NextResponse.json(tasks)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request)
    const created = await createTask(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
