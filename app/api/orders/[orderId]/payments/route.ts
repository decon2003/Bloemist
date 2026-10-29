import { NextResponse } from 'next/server'
import { getOrder } from '@/lib/server/data-store'
import { addPayment, listPayments } from '@/lib/server/payments'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { ORDER_WRITE_ROLES, requireUser } from '@/lib/server/session'

type Context = { params: Promise<{ orderId: string }> }

// GET: the order's payments. Florists do not see payment details.
export async function GET(request: Request, { params }: Context) {
  try {
    await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    await getOrder(orderId)
    return NextResponse.json(await listPayments(orderId))
  } catch (error) {
    return handleRouteError(error)
  }
}

// POST { amount, note?, paidAt? }: money the customer just transferred. paidAt
// (ISO) is for managers only. Returns the updated order and its payments.
export async function POST(request: Request, { params }: Context) {
  try {
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const { orderId } = await params
    const body = await readJsonBody(request)
    await addPayment(orderId, body, me)
    return NextResponse.json({ order: await getOrder(orderId), payments: await listPayments(orderId) }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
