import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { hashPassword, validateNewPassword } from '@/lib/server/password'
import { toVnd } from '@/lib/server/money'
import { MANAGER_ROLES, isManager, requireUser } from '@/lib/server/session'
import { audit } from '@/lib/server/audit'
import {
    PAY_TYPES,
    PRIVILEGED_USER_SELECT,
    STAFF_DIRECTORY_SELECT,
    USER_ROLES,
    assertOneOf,
    normalizeEmail,
    parseCommissionRate,
    requireNonBlank,
} from '@/lib/server/validation'

// GET: List all users. Salary and contact columns only go to admins;
// password and lockout columns never leave the server.
export async function GET(request: Request) {
    try {
        const me = await requireUser(request)
        const users = await db.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: isManager(me) ? PRIVILEGED_USER_SELECT : STAFF_DIRECTORY_SELECT,
        })
        return NextResponse.json(users.map(u => ({
            ...u,
            createdAt: u.createdAt.toISOString()
        })))
    } catch (error) {
        return handleRouteError(error)
    }
}

// POST: Create a new user
export async function POST(request: Request) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const body = await readJsonBody(request)

        const name = requireNonBlank(body.name, 'name', 120)
        const email = normalizeEmail(body.email)
        const phone = requireNonBlank(body.phone, 'phone', 32)
        // role is a bare String in the schema; without this allow-list any
        // caller could mint themselves an arbitrary (or misspelled) role.
        const role = assertOneOf(body.role, USER_ROLES, 'role')
        // The only admin account is the shop owner's.
        if (role === 'admin') throw new ApiError(403, 'Chỉ có một tài khoản chủ cửa hàng')

        // Pay profile can be set right away (otherwise MONTHLY with 0 everywhere).
        const payType = body.payType === undefined ? 'MONTHLY' : assertOneOf(body.payType, PAY_TYPES, 'payType')
        const baseSalary = toVnd(body.baseSalary, 'baseSalary') ?? 0
        const hourlyRate = toVnd(body.hourlyRate, 'hourlyRate') ?? 0
        const commissionRate = body.commissionRate === undefined || body.commissionRate === null
            ? 0
            : parseCommissionRate(body.commissionRate)
        const salesCommissionRate = body.salesCommissionRate === undefined || body.salesCommissionRate === null
            ? 0
            : parseCommissionRate(body.salesCommissionRate, 'salesCommissionRate')
        // The manager hands this temporary password over in person; the staff
        // member must replace it on first login.
        const password = validateNewPassword(body.password)

        // Emails are normalised to lower case so that this check and the unique
        // index agree; previously Admin@x and admin@x created shadow accounts.
        const existing = await db.user.findUnique({ where: { email } })
        if (existing) {
            throw new ApiError(409, 'Email này đã có tài khoản')
        }

        const user = await db.user.create({
            data: {
                name,
                email,
                phone,
                role,
                status: 'active',
                avatar: typeof body.avatar === 'string' && body.avatar.trim() ? body.avatar.trim() : '👤',
                payType,
                baseSalary,
                hourlyRate,
                commissionRate,
                salesCommissionRate,
                passwordHash: await hashPassword(password),
                mustChangePassword: true,
            },
            select: PRIVILEGED_USER_SELECT,
        })

        await audit(me, { action: 'user.create', entity: 'user', entityId: user.id, summary: `${user.name} (${user.role})` })

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        }, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
