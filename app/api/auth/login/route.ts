import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json()

        // In this demo, we accept any existing user and a simple password check
        const user = await db.user.findUnique({
            where: { email: email }
        })

        if (!user) {
            throw new ApiError(401, 'Invalid credentials')
        }

        // For the demo, we are skipping real password hashing check
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
