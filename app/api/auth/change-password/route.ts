import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { hashPassword, validateNewPassword, verifyPassword } from '@/lib/server/password'
import { requireUser, setSessionCookie } from '@/lib/server/session'
import { toSessionResponse } from '@/lib/server/auth-response'
import { audit } from '@/lib/server/audit'

export async function POST(request: Request) {
    try {
        const session = await requireUser(request, undefined, { allowPendingPasswordChange: true })
        const body = await readJsonBody(request)

        const user = await db.user.findUnique({ where: { id: session.id } })
        if (!user) throw new ApiError(401, 'Không tìm thấy nhân viên')

        if (typeof body.currentPassword !== 'string' || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
            throw new ApiError(400, 'Mật khẩu hiện tại không đúng')
        }

        const newPassword = validateNewPassword(body.newPassword, 'newPassword')
        if (newPassword === body.currentPassword) {
            throw new ApiError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại')
        }

        // Bumping sessionVersion logs out every other device; this one gets a
        // fresh cookie below.
        const updated = await db.user.update({
            where: { id: user.id },
            data: {
                passwordHash: await hashPassword(newPassword),
                mustChangePassword: false,
                sessionVersion: { increment: 1 },
            },
        })

        await audit(session, { action: 'auth.password_changed', entity: 'auth', entityId: session.id, summary: updated.email })

        const response = NextResponse.json(toSessionResponse(updated))
        setSessionCookie(response, updated)
        return response
    } catch (error) {
        return handleRouteError(error)
    }
}
