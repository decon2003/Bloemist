import { NextResponse } from 'next/server'
import { completeTask } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const formData = await request.formData()
    const photo = formData.get('photo')
    const updated = await completeTask(taskId, { photo: photo as File | Blob })
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
