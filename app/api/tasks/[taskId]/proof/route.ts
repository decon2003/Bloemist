import { NextResponse } from 'next/server'
import { setTaskProof } from '@/lib/server/data-store'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { ORDER_WRITE_ROLES, requireUser } from '@/lib/server/session'
import { audit } from '@/lib/server/audit'

// POST form data { photo, thumb? } - the finished-product photo, taken by sales
// (or a manager) once the product is made.
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const { taskId } = await params
    const formData = await request.formData().catch(() => null)
    const photo = formData?.get('photo')
    if (!(photo instanceof Blob) || photo.size === 0) throw new ApiError(400, 'Vui lòng chọn một file ảnh')
    const updated = await setTaskProof(taskId, { photo, thumb: formData?.get('thumb') })
    await audit(me, { action: 'task.proof', entity: 'task', entityId: taskId, summary: `Ảnh thành phẩm · ${updated.taskTitle}` })
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}
