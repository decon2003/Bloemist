import { NextResponse } from 'next/server'
import { mapCheckIn } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { isManager, requireUser } from '@/lib/server/session'
import { correctShift } from '@/lib/server/attendance'

// Enter or fix a shift: { workDate: 'YYYY-MM-DD', workMode?: 'SHOP' | 'ONLINE', checkIn: 'HH:mm', checkOut?: 'HH:mm', reason, staffId? }.
// Staff: own shifts, last few days. Managers: anyone (staffId), longer window.
export async function POST(request: Request) {
    try {
        const me = await requireUser(request)
        const body = await readJsonBody(request)
        const saved = await correctShift(me, isManager(me), body)
        return NextResponse.json(mapCheckIn(saved))
    } catch (error) {
        return handleRouteError(error)
    }
}
