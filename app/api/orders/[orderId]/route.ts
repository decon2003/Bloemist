import { NextResponse } from 'next/server'
import { getOrder, updateOrder, deleteOrder, redactOrderFor, syncTasksWithOrderStatus } from '@/lib/server/data-store'
import { payrollMonthsForOrder, refreshPayrollsFor } from '@/lib/server/payroll'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, MANAGER_ROLES, ORDER_WRITE_ROLES } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

const ORDER_AUDIT_FIELDS = ['customerName', 'customerPhone', 'receiverName', 'receiverPhone', 'deliveryAddress', 'bouquetName', 'deliveryType', 'status', 'receiveTime', 'listedPrice', 'deliveryFee', 'deliveryCoveredByShop', 'vatPercent', 'deposit', 'sellingPrice', 'total', 'remainingBalance', 'notes', 'cardMessage', 'assigneeName']

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

    // Cancelling (refund) or restoring: products and commissions follow.
    // Revenue figures already leave cancelled orders out.
    let lockedMonths: string[] = []
    if ((before.status === 'CANCELLED') !== (updated.status === 'CANCELLED')) {
      await syncTasksWithOrderStatus(orderId, before.status, updated.status)
      lockedMonths = (await refreshPayrollsFor(await payrollMonthsForOrder(orderId), me)).lockedMonths
    }
    return NextResponse.json({ ...updated, lockedPayrollMonths: lockedMonths })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    // Sales may edit orders but only managers delete them.
    const me = await requireUser(request, MANAGER_ROLES)
    const { orderId } = await params
    const before = await getOrder(orderId)
    const months = await payrollMonthsForOrder(orderId)
    await deleteOrder(orderId)
    await audit(me, { action: 'order.delete', entity: 'order', entityId: orderId, summary: `${before.code} · ${before.customerName} · ${before.total.toLocaleString('vi-VN')} ₫` })
    // Its revenue goes with it; draft payrolls drop its commissions.
    const { lockedMonths } = await refreshPayrollsFor(months, me)
    return NextResponse.json({ lockedPayrollMonths: lockedMonths })
  } catch (error) {
    return handleRouteError(error)
  }
}
