import { NextResponse } from 'next/server'
import { mapCheckIn } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { checkOut, deleteShift } from '@/lib/server/attendance'

// Check out now, from your own open shift (it may have started yesterday
// evening). Other times and other people's shifts go through /api/checkins/correct.
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

// DELETE { reason } - a shift checked in by mistake (managers only).
export async function DELETE(request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { checkInId } = await params
        const body = await request.json().catch(() => ({}))
        await deleteShift(me, checkInId, body?.reason)
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        return handleRouteError(error)
    }
}
