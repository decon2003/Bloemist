import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { ApiError } from '@/lib/server/api-error'
import { mergeCustomers } from '@/lib/server/customers'
import { audit } from '@/lib/server/audit'

// POST { targetId } -> merge this (duplicate) customer into the target (managers).
export async function POST(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const me = await requireUser(request, MANAGER_ROLES)
    const { customerId } = await params
    const body = await readJsonBody(request)
    if (typeof body.targetId !== 'string' || !body.targetId) throw new ApiError(400, 'targetId is required')
    const { source, target, moved } = await mergeCustomers(customerId, body.targetId)
    await audit(me, {
      action: 'customer.merge',
      entity: 'customer',
      entityId: target.id,
      summary: `Gộp ${source.name} · ${source.phone} vào ${target.name} · ${target.phone} (${moved} đơn)`,
    })
    return NextResponse.json({ targetId: target.id, moved })
  } catch (error) {
    return handleRouteError(error)
  }
}
