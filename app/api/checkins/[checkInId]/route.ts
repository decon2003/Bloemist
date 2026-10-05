import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/api-error'
import { checkOutStaff } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { isManager, requireUser } from '@/lib/server/session'

export async function PATCH(request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
    try {
        const me = await requireUser(request)
        const { checkInId } = await params

        const checkIn = await db.staffCheckIn.findUnique({ where: { id: checkInId }, select: { staffId: true } })
        if (!checkIn) throw new ApiError(404, 'Check-in not found')
        if (checkIn.staffId !== me.id && !isManager(me)) {
            throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này')
        }

        const result = await checkOutStaff(checkInId)
        return NextResponse.json(result)
    } catch (error) {
        // Use the shared handler. The previous inline version echoed raw error
        // messages - which carry Prisma model and column names - back to the
        // client as plain text, in a body shape no other route returns.
        return handleRouteError(error)
    }
}
