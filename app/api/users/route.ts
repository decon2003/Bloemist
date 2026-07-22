import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import {
    USER_ROLES,
    assertOneOf,
    normalizeEmail,
    parseCommissionRate,
    parseMoneyString,
    requireNonBlank,
} from '@/lib/server/validation'

// GET: List all users
//
// SECURITY DEBT: this response includes baseSalary and commissionRate, the most
// sensitive columns in the schema, and the route has no authentication in front
// of it. Narrowing the select here was considered and rejected: it would break
// the staff salary report without actually protecting anything, because any
// replacement endpoint would be equally unauthenticated. The real fix is
// server-side auth + a role gate on this route; salary must move behind it at
// the same time. Do not ship this to a wider audience until that lands.
export async function GET() {
    try {
        const users = await db.user.findMany({
            orderBy: { createdAt: 'desc' }
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
        const body = await readJsonBody(request)

        const name = requireNonBlank(body.name, 'name', 120)
        const email = normalizeEmail(body.email)
        const phone = requireNonBlank(body.phone, 'phone', 32)
        // role is a bare String in the schema; without this allow-list any
        // caller could mint themselves an arbitrary (or misspelled) role.
        const role = assertOneOf(body.role, USER_ROLES, 'role')

        const baseSalary = body.baseSalary === undefined || body.baseSalary === null
            ? '0'
            : parseMoneyString(body.baseSalary, 'baseSalary')
        const commissionRate = body.commissionRate === undefined || body.commissionRate === null
            ? 0
            : parseCommissionRate(body.commissionRate)

        // Emails are normalised to lower case so that this check and the unique
        // index agree; previously Admin@x and admin@x created shadow accounts.
        const existing = await db.user.findUnique({ where: { email } })
        if (existing) {
            throw new ApiError(409, 'Email already exists')
        }

        const user = await db.user.create({
            data: {
                name,
                email,
                phone,
                role,
                status: 'active',
                avatar: typeof body.avatar === 'string' && body.avatar.trim() ? body.avatar.trim() : '👤',
                baseSalary,
                commissionRate,
            }
        })

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        }, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
