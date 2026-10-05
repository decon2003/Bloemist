import { NextResponse } from 'next/server'
import { getOrder, updateOrder, deleteOrder, redactOrderFor } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireUser(request)
    const { orderId } = await params
    const order = await getOrder(orderId)
    return NextResponse.json(redactOrderFor(me, order))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    const json = await readJsonBody(request)
    const updated = await updateOrder(orderId, json)
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    await deleteOrder(orderId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
