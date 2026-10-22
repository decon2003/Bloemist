import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { updatePayrollSettings } from '@/lib/server/payroll'

// PATCH { otMultiplier } - formula settings for this month.
export async function PATCH(request: Request, { params }: { params: Promise<{ payrollId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { payrollId } = await params
        return NextResponse.json(await updatePayrollSettings(payrollId, await readJsonBody(request), me))
    } catch (error) {
        return handleRouteError(error)
    }
}
