import { exportOrdersCsv } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { parseListScope } from '@/lib/server/list-scope'
import { audit } from '@/lib/server/audit'
import { orderFiltersFrom } from '../filters'

// Same parameters as GET /api/orders -> CSV for Excel (managers).
export async function GET(request: Request) {
  try {
    const me = await requireUser(request, MANAGER_ROLES)
    const params = new URL(request.url).searchParams
    const csv = await exportOrdersCsv(parseListScope(params, me), me, orderFiltersFrom(params))
    const label = [params.get('from'), params.get('to')].filter(Boolean).join('_') || 'don-hang'
    await audit(me, { action: 'order.export', entity: 'order', entityId: label, summary: `Xuất CSV đơn hàng ${label}` })
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="don-hang-${label}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
