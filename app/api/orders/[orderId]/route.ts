import { NextResponse } from 'next/server'
import { getOrder, updateOrder, deleteOrder, redactOrderFor } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

const ORDER_AUDIT_FIELDS = ['customerName', 'customerPhone', 'receiverName', 'receiverPhone', 'deliveryAddress', 'bouquetName', 'deliveryType', 'status', 'receiveTime', 'listedPrice', 'discount', 'deliveryFee', 'deliveryCoveredByShop', 'vatPercent', 'deposit', 'sellingPrice', 'total', 'remainingBalance', 'notes', 'assigneeName']

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
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    const json = await readJsonBody(request)
    const before = await getOrder(orderId)
    const updated = await updateOrder(orderId, json)
    const changes = diff(before, updated, ORDER_AUDIT_FIELDS)
    if (changes) await audit(me, { action: 'order.update', entity: 'order', entityId: orderId, summary: updated.code, changes })
    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    const before = await getOrder(orderId)
    await deleteOrder(orderId)
    await audit(me, { action: 'order.delete', entity: 'order', entityId: orderId, summary: `${before.code} · ${before.customerName} · ${before.total.toLocaleString('vi-VN')} ₫` })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
