import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
    try {
        const stats = await getDashboardStats()
        return NextResponse.json(stats)
    } catch (error) {
        return handleRouteError(error)
    }
}
