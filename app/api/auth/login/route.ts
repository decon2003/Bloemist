import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'

export async function POST(request: Request) {
    try {
        const body = await readJsonBody(request)

        if (typeof body.email !== 'string' || !body.email.trim()) {
            throw new ApiError(400, 'Email is required')
        }

        // Emails are stored lower-cased; look up the same way so that a
        // differently-cased address does not fail to match.
        const email = body.email.trim().toLowerCase()

        const user = await db.user.findUnique({ where: { email } })

        if (!user) {
            throw new ApiError(401, 'Invalid credentials')
        }

        // ============================================================
        // SECURITY: THIS ROUTE DOES NOT AUTHENTICATE ANYONE.
        //
        // The password is accepted and discarded - there is no passwordHash
        // column in the schema to verify it against - and no session token or
        // cookie is issued. Knowing any registered email is enough to become
        // that user, including boss and admin accounts, and the app is
        // reachable at a public URL.
        //
        // Fixing this needs a schema migration (add passwordHash), a hashing
        // library, a signed session cookie and a middleware, plus a decision on
        // how existing users set their first password. That is deliberately not
        // done here because the mechanism is the owner's call - but it must be
        // done before this app carries real payroll and customer data.
        // ============================================================
        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            avatar: user.avatar,
            createdAt: user.createdAt
        })
    } catch (error) {
        return handleRouteError(error)
    }
}
