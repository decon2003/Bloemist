import { NextResponse } from 'next/server'
import { listUsers } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
    try {
        const users = await listUsers()
        return NextResponse.json(users)
    } catch (error) {
        return handleRouteError(error)
    }
}
