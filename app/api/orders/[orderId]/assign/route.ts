import { NextResponse } from 'next/server'
import { assignOrder } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'
import { audit } from '@/lib/server/audit'

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        const me = await requireUser(request, ORDER_WRITE_ROLES)
        const { orderId } = await params
        const payload = await readJsonBody(request)
        const order = await assignOrder(orderId, payload)
        await audit(me, { action: 'order.assign', entity: 'order', entityId: orderId, summary: `${order.code} → ${payload.userName ?? payload.userId}` })
        return NextResponse.json(order)
    } catch (error) {
        return handleRouteError(error)
    }
}
