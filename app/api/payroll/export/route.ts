import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { ApiError } from '@/lib/server/api-error'
import { exportPayrollCsv } from '@/lib/server/payroll'
import { parseVnMonth } from '@/lib/server/vn-time'

// GET ?month=YYYY-MM -> CSV for Excel.
export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const month = parseVnMonth(new URL(request.url).searchParams.get('month'))
        if (!month) throw new ApiError(400, 'Tháng không hợp lệ')
        const csv = await exportPayrollCsv(month.key)
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="bang-luong-${month.key}.csv"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        return handleRouteError(error)
    }
}
