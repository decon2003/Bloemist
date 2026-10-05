import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser, MANAGER_ROLES } from '@/lib/server/session'

export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const stats = await getDashboardStats()
        return NextResponse.json(stats)
    } catch (error) {
        return handleRouteError(error)
    }
}
