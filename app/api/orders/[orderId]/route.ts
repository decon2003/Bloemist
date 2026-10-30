import { NextResponse } from 'next/server'
import { assertFloristOrderChange, getOrder, updateOrder, deleteOrder, redactOrderFor, syncTasksWithOrderStatus } from '@/lib/server/data-store'
import { ApiError } from '@/lib/server/api-error'
import { payrollMonthsForOrder, refreshPayrollsFor } from '@/lib/server/payroll'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, MANAGER_ROLES, ORDER_WRITE_ROLES } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'

const ORDER_AUDIT_FIELDS = ['customerName', 'customerPhone', 'receiverName', 'receiverPhone', 'deliveryAddress', 'bouquetName', 'deliveryType', 'status', 'receiveTime', 'listedPrice', 'deliveryFee', 'deliveryCoveredByShop', 'deposit', 'sellingPrice', 'total', 'remainingBalance', 'notes', 'cardMessage', 'assigneeName']

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
    // Florists may move an open order up to "Sẵn sàng" and change its person
    // in charge; everything else needs sales or a manager.
    const me = await requireUser(request)
    const { orderId } = await params
    const json = await readJsonBody(request)
    const before = await getOrder(orderId)
    if (me.role === 'florist') assertFloristOrderChange(before, json ?? {})
    else if (!ORDER_WRITE_ROLES.includes(me.role)) throw new ApiError(403, 'Bạn không có quyền sửa đơn')
    const updated = await updateOrder(orderId, json, me)
    const changes = diff(before, updated, ORDER_AUDIT_FIELDS)
    if (changes) await audit(me, { action: 'order.update', entity: 'order', entityId: orderId, summary: updated.code, changes })

    // Cancelling (refund) or restoring: products and commissions follow.
    // Revenue figures already leave cancelled orders out.
    let lockedMonths: string[] = []
    if ((before.status === 'CANCELLED') !== (updated.status === 'CANCELLED')) {
      await syncTasksWithOrderStatus(orderId, before.status, updated.status)
      lockedMonths = (await refreshPayrollsFor(await payrollMonthsForOrder(orderId), me)).lockedMonths
    }
    return NextResponse.json({ ...redactOrderFor(me, updated), lockedPayrollMonths: lockedMonths })
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
