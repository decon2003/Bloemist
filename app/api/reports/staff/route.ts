import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { getStaffReport } from '@/lib/server/staff-report'
import { parseVnMonth } from '@/lib/server/vn-time'

// ?month=YYYY-MM (Vietnam time), default this month. Salary data: managers only.
export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const month = parseVnMonth(new URL(request.url).searchParams.get('month'))
        if (!month) throw new ApiError(400, 'month must be YYYY-MM')
        return NextResponse.json({ month: month.key, rows: await getStaffReport(month) })
    } catch (error) {
        return handleRouteError(error)
    }
}
