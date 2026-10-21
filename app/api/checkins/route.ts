import { NextResponse } from 'next/server'
import { listStaffCheckIns, createStaffCheckIn } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { isManager, requireUser } from '@/lib/server/session'
import { ApiError } from '@/lib/server/api-error'
import { parseVnMonth } from '@/lib/server/vn-time'

export async function GET(request: Request) {
    try {
        const me = await requireUser(request)
        // ?month=YYYY-MM (Vietnam time), default this month.
        const month = parseVnMonth(new URL(request.url).searchParams.get('month'))
        if (!month) throw new ApiError(400, 'month must be YYYY-MM')
        // Staff see only their own attendance; managers see everyone's.
        const checkins = await listStaffCheckIns(month, isManager(me) ? undefined : me.id)
        return NextResponse.json(checkins)
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function POST(request: Request) {
    try {
        const me = await requireUser(request)
        const body = await readJsonBody(request)
        // Nobody may check in on someone else's behalf.
        const created = await createStaffCheckIn({ ...body, staffId: me.id, staffName: me.name })
        return NextResponse.json(created, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
