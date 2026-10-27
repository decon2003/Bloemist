import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { toSessionResponse } from '@/lib/server/auth-response'

export async function GET(request: Request) {
    try {
        const session = await requireUser(request, undefined, { allowPendingPasswordChange: true })
        const user = await db.user.findUnique({ where: { id: session.id } })
        if (!user) throw new ApiError(401, 'Không tìm thấy nhân viên')
        return NextResponse.json(toSessionResponse(user))
    } catch (error) {
        return handleRouteError(error)
    }
}
