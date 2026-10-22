import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { lockPayroll, unlockPayroll } from '@/lib/server/payroll'

// POST locks (all OT days must be reviewed); DELETE unlocks for corrections.
export async function POST(request: Request, { params }: { params: Promise<{ payrollId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { payrollId } = await params
        return NextResponse.json(await lockPayroll(payrollId, me))
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ payrollId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { payrollId } = await params
        return NextResponse.json(await unlockPayroll(payrollId, me))
    } catch (error) {
        return handleRouteError(error)
    }
}
