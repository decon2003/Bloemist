import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import {
    USER_ROLES,
    USER_STATUSES,
    assertOneOf,
    normalizeEmail,
    parseCommissionRate,
    parseMoneyString,
    requireNonBlank,
} from '@/lib/server/validation'

const PROTECTED_ADMIN_EMAIL = 'admin@bloemist.com'

interface RouteContext {
    params: Promise<{ userId: string }>
}

// GET: Get single user
export async function GET(request: Request, context: RouteContext) {
    try {
        const { userId } = await context.params
        const user = await db.user.findUnique({ where: { id: userId } })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        })
    } catch (error) {
        return handleRouteError(error)
    }
}

// PATCH: Update user
//
// Every field is validated rather than spread straight into Prisma. The previous
// `...(field && { field })` form silently dropped legitimate falsy values -
// baseSalary: 0 or avatar: "" returned 200 with nothing changed - and accepted
// arbitrary role strings, negative commission rates and NaN.
export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { userId } = await context.params
        const body = await readJsonBody(request)

        const data: Record<string, unknown> = {}

        if (body.name !== undefined) data.name = requireNonBlank(body.name, 'name', 120)
        if (body.email !== undefined) data.email = normalizeEmail(body.email)
        if (body.phone !== undefined) data.phone = requireNonBlank(body.phone, 'phone', 32)
        if (body.role !== undefined) data.role = assertOneOf(body.role, USER_ROLES, 'role')
        if (body.status !== undefined) data.status = assertOneOf(body.status, USER_STATUSES, 'status')
        if (body.avatar !== undefined) data.avatar = requireNonBlank(body.avatar, 'avatar', 64)
        if (body.baseSalary !== undefined) data.baseSalary = parseMoneyString(body.baseSalary, 'baseSalary')
        if (body.commissionRate !== undefined) data.commissionRate = parseCommissionRate(body.commissionRate)

        if (Object.keys(data).length === 0) {
            throw new ApiError(400, 'No updatable fields supplied')
        }

        const existing = await db.user.findUnique({ where: { id: userId } })
        if (!existing) {
            throw new ApiError(404, 'User not found')
        }

        // The main admin's role and status are what keep the account usable;
        // allowing them to be changed re-opens the deletion hole below.
        if (existing.email === PROTECTED_ADMIN_EMAIL && (data.role !== undefined || data.status !== undefined || data.email !== undefined)) {
            throw new ApiError(403, 'Cannot change the role, status or email of the main admin account')
        }

        const user = await db.user.update({
            where: { id: userId },
            data
        })

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        })
    } catch (error) {
        return handleRouteError(error)
    }
}

// DELETE: Delete user
export async function DELETE(request: Request, context: RouteContext) {
    try {
        const { userId } = await context.params

        const user = await db.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new ApiError(404, 'User not found')
        }

        // Don't allow deleting the main admin
        if (user.email === PROTECTED_ADMIN_EMAIL) {
            throw new ApiError(403, 'Cannot delete the main admin account')
        }

        // Deleting a user who still owns tasks, orders or check-ins raises an FK
        // violation; report it as a conflict the caller can act on rather than
        // letting it surface as an opaque 500.
        const [assignedTasks, createdOrders, assignedOrders, checkIns] = await Promise.all([
            db.task.count({ where: { assigneeId: userId } }),
            db.order.count({ where: { createdById: userId } }),
            db.order.count({ where: { assigneeId: userId } }),
            db.staffCheckIn.count({ where: { staffId: userId } }),
        ])

        if (assignedTasks || createdOrders || assignedOrders || checkIns) {
            throw new ApiError(
                409,
                'This user still has assigned work or check-in history. Deactivate the account instead of deleting it.',
            )
        }

        await db.user.delete({ where: { id: userId } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        return handleRouteError(error)
    }
}
