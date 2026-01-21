import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { handleRouteError } from '@/lib/server/route-helpers'

// GET: List all users
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
        const body = await request.json()
        const { name, email, phone, role, avatar } = body

        // Validate required fields
        if (!name || !email || !phone || !role) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, phone, role' },
                { status: 400 }
            )
        }

        // Check if email already exists
        const existing = await db.user.findUnique({ where: { email } })
        if (existing) {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 409 }
            )
        }

        // Create user
        const user = await db.user.create({
            data: {
                name,
                email,
                phone,
                role,
                status: 'active',
                avatar: avatar || '👤'
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
