import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { verifyPassword } from '@/lib/server/password'
import { setSessionCookie } from '@/lib/server/session'
import { toSessionResponse } from '@/lib/server/auth-response'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const INVALID = 'Email hoặc mật khẩu không đúng'

export async function POST(request: Request) {
    try {
        const body = await readJsonBody(request)

        if (typeof body.email !== 'string' || !body.email.trim() || typeof body.password !== 'string' || !body.password) {
            throw new ApiError(400, 'Vui lòng nhập email và mật khẩu')
        }

        // Emails are stored lower-cased; look up the same way so that a
        // differently-cased address does not fail to match.
        const email = body.email.trim().toLowerCase()
        const user = await db.user.findUnique({ where: { email } })

        if (!user) {
            throw new ApiError(401, INVALID)
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new ApiError(429, `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${LOCK_MINUTES} phút.`)
        }

        if (!user.passwordHash) {
            throw new ApiError(401, 'Tài khoản chưa có mật khẩu. Vui lòng liên hệ quản lý để được cấp mật khẩu.')
        }

        if (!(await verifyPassword(body.password, user.passwordHash))) {
            const failed = user.failedLoginCount + 1
            await db.user.update({
                where: { id: user.id },
                data: failed >= MAX_FAILED_ATTEMPTS
                    ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
                    : { failedLoginCount: failed },
            })
            throw new ApiError(401, INVALID)
        }

        if (user.status === 'inactive' || user.status === 'disabled') {
            throw new ApiError(403, 'Tài khoản đã bị vô hiệu hoá')
        }

        if (user.failedLoginCount || user.lockedUntil) {
            await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
        }

        const response = NextResponse.json(toSessionResponse(user))
        setSessionCookie(response, user)
        return response
    } catch (error) {
        return handleRouteError(error)
    }
}
