import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { handleRouteError } from '@/lib/server/route-helpers'

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
export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { userId } = await context.params
        const body = await request.json()
        const { name, email, phone, role, status, avatar, baseSalary, commissionRate } = body

        const user = await db.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone && { phone }),
                ...(role && { role }),
                ...(status && { status }),
                ...(avatar && { avatar }),
                ...(baseSalary && { baseSalary }),
                ...(commissionRate !== undefined && { commissionRate }),
            }
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

        // Don't allow deleting the main admin
        const user = await db.user.findUnique({ where: { id: userId } })
        if (user?.email === 'admin@bloemist.com') {
            return NextResponse.json(
                { error: 'Cannot delete the main admin account' },
                { status: 403 }
            )
        }

        await db.user.delete({ where: { id: userId } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        return handleRouteError(error)
    }
}
