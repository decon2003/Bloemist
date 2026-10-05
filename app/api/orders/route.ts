import { NextResponse } from 'next/server'
import { createOrder, listOrders, redactOrderFor } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'

export async function GET(request: Request) {
  try {
    const me = await requireUser(request)
    const orders = await listOrders()
    return NextResponse.json(orders.map((order) => redactOrderFor(me, order)))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const me = await requireUser(request, ORDER_WRITE_ROLES)
    const body = await readJsonBody(request)
    // The creator is whoever is signed in, not whatever the body claims.
    const created = await createOrder({ ...body, createdById: me.id, createdByName: me.name })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
