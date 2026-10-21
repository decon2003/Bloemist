import { NextResponse } from 'next/server'
import { completeTask } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    await requireUser(request)
    const { taskId } = await params
    const formData = await request.formData()
    const photo = formData.get('photo')
    const updated = await completeTask(taskId, { photo: photo as File | Blob, thumb: formData.get('thumb') })
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
