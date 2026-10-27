import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { ApiError } from '@/lib/server/api-error'
import { generatePayroll, getPayroll } from '@/lib/server/payroll'
import { parseVnMonth } from '@/lib/server/vn-time'

// GET ?month=YYYY-MM -> the payroll (null if not created yet). Managers only.
export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const month = parseVnMonth(new URL(request.url).searchParams.get('month'))
        if (!month) throw new ApiError(400, 'Tháng không hợp lệ')
        return NextResponse.json(await getPayroll(month.key))
    } catch (error) {
        return handleRouteError(error)
    }
}

// POST { month } -> create the draft, or refresh it keeping manual changes.
export async function POST(request: Request) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const body = await readJsonBody(request)
        return NextResponse.json(await generatePayroll(String(body.month ?? ''), me))
    } catch (error) {
        return handleRouteError(error)
    }
}
