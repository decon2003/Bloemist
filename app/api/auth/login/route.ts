import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json()

        // In this demo, we accept any existing user and a simple password check
        // Real apps would use bcrypt/auth-js, but we'll stick to a simple DB check for "realism"
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any

        if (!user) {
            throw new ApiError(401, 'Invalid credentials')
        }

        // For the demo, let's assume 'admin', 'sales', 'florist' as passwords if not specified differently
        // Or just accept the email if it exists for simplicity in this dev environment
        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            avatar: user.avatar,
            createdAt: user.created_at
        })
    } catch (error) {
        return handleRouteError(error)
    }
}
