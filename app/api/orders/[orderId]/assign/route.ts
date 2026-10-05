import { NextResponse } from 'next/server'
import { assignOrder } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
    try {
        await requireUser(request, ORDER_WRITE_ROLES)
        const { orderId } = await params
        const payload = await readJsonBody(request)
        const order = await assignOrder(orderId, payload)
        return NextResponse.json(order)
    } catch (error) {
        return handleRouteError(error)
    }
}
