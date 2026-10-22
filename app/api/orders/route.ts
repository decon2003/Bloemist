import { NextResponse } from 'next/server'
import { createOrder, listOrders, redactOrderFor } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { requireUser, ORDER_WRITE_ROLES } from '@/lib/server/session'
import { parseListScope } from '@/lib/server/list-scope'
import { audit } from '@/lib/server/audit'
import { orderFiltersFrom } from './filters'

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (receive date, Vietnam days) or ?q=search,
// plus optional &assigneeId= / &salespersonId= (a user id, or 'none'), &status=
// and &limit= (rows, for "Xem thêm"). Sales and florists see 30 days of history.
export async function GET(request: Request) {
  try {
    const me = await requireUser(request)
    const params = new URL(request.url).searchParams
    const orders = await listOrders(parseListScope(params, me), me, orderFiltersFrom(params))
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
    await audit(me, { action: 'order.create', entity: 'order', entityId: created.id, summary: `${created.code} · ${created.customerName} · ${created.total.toLocaleString('vi-VN')} ₫` })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
