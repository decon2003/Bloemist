import { NextResponse } from 'next/server'
import { listStaffCheckIns, mapCheckIn } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { isManager, requireUser } from '@/lib/server/session'
import { ApiError } from '@/lib/server/api-error'
import { addVnDays, parseVnMonth } from '@/lib/server/vn-time'
import { checkIn, closeOpenShifts } from '@/lib/server/attendance'

export async function GET(request: Request) {
    try {
        const me = await requireUser(request)
        const params = new URL(request.url).searchParams
        // ?days=N: today and the N-1 days before (crosses month boundaries; used
        // for the "fix a recent shift" view). Otherwise ?month=YYYY-MM, default this month.
        const days = Number(params.get('days'))
        const month = days > 0 && days <= 31
            ? { start: addVnDays(new Date(), -(days - 1)), end: addVnDays(new Date(), 1) }
            : parseVnMonth(params.get('month'))
        if (!month) throw new ApiError(400, 'month must be YYYY-MM')
        // Close forgotten shifts even if the nightly job did not run.
        await closeOpenShifts()
        // Staff see only their own attendance; managers see everyone's.
        const checkins = await listStaffCheckIns(month, isManager(me) ? undefined : me.id)
        return NextResponse.json(checkins)
    } catch (error) {
        return handleRouteError(error)
    }
}

// Check in now. Always for the signed-in person; one shift per day.
export async function POST(request: Request) {
    try {
        const me = await requireUser(request)
        const created = await checkIn(me)
        return NextResponse.json(mapCheckIn(created), { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
