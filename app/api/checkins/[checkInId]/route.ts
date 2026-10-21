import { NextResponse } from 'next/server'
import { mapCheckIn } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { checkOut } from '@/lib/server/attendance'

// Check out now, from your own shift of today. Earlier days and other people's
// shifts are fixed through /api/checkins/correct.
export async function PATCH(request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
    try {
        const me = await requireUser(request)
        const { checkInId } = await params
        const updated = await checkOut(me.id, checkInId)
        return NextResponse.json(mapCheckIn(updated))
    } catch (error) {
        return handleRouteError(error)
    }
}
