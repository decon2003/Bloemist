import { NextResponse } from 'next/server'
import { listStaffCheckIns, createStaffCheckIn } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
    try {
        const checkins = await listStaffCheckIns()
        return NextResponse.json(checkins)
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const created = await createStaffCheckIn(body)
        return NextResponse.json(created, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
