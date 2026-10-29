import { NextResponse } from 'next/server'
import { getOrder } from '@/lib/server/data-store'
import { deletePayment, listPayments } from '@/lib/server/payments'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'

// DELETE: remove a payment recorded by mistake - managers only, since
// payments decide the sales KPI.
export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string; paymentId: string }> }) {
  try {
    const me = await requireUser(request, MANAGER_ROLES)
    const { orderId, paymentId } = await params
    await deletePayment(orderId, paymentId, me)
    return NextResponse.json({ order: await getOrder(orderId), payments: await listPayments(orderId) })
  } catch (error) {
    return handleRouteError(error)
  }
}
