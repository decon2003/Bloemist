import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { updatePayrollLine } from '@/lib/server/payroll'

// PATCH one person's line: rates for this month, OT decisions, commission
// items, adjustments, note.
export async function PATCH(request: Request, { params }: { params: Promise<{ lineId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { lineId } = await params
        return NextResponse.json(await updatePayrollLine(lineId, await readJsonBody(request), me))
    } catch (error) {
        return handleRouteError(error)
    }
}
