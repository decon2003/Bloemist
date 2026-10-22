import { NextResponse } from 'next/server'
import { summarizeOrders } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { parseListScope } from '@/lib/server/list-scope'
import { orderFiltersFrom } from '../filters'

// Same parameters as GET /api/orders -> totals for the whole period (managers).
export async function GET(request: Request) {
  try {
    const me = await requireUser(request, MANAGER_ROLES)
    const params = new URL(request.url).searchParams
    return NextResponse.json(await summarizeOrders(parseListScope(params, me), me, orderFiltersFrom(params)))
  } catch (error) {
    return handleRouteError(error)
  }
}
