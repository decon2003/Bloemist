import { NextResponse } from 'next/server'
import { listStaffCheckIns, createStaffCheckIn } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { isManager, requireUser } from '@/lib/server/session'

export async function GET(request: Request) {
    try {
        const me = await requireUser(request)
        const checkins = await listStaffCheckIns()
        // Staff see only their own attendance; managers see everyone's.
        return NextResponse.json(isManager(me) ? checkins : checkins.filter((c) => c.staffId === me.id))
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function POST(request: Request) {
    try {
        const me = await requireUser(request)
        const body = await readJsonBody(request)
        // Nobody may check in on someone else's behalf.
        const created = await createStaffCheckIn({ ...body, staffId: me.id, staffName: me.name })
        return NextResponse.json(created, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
