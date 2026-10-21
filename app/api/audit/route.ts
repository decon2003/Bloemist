import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { listAudit } from '@/lib/server/audit'

// ?entity=order&entityId=<id> for one record's history; no params = latest activity.
export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const params = new URL(request.url).searchParams
        const rows = await listAudit({
            entity: params.get('entity') ?? undefined,
            entityId: params.get('entityId') ?? undefined,
            take: Number(params.get('limit')) || 100,
        })
        return NextResponse.json(rows)
    } catch (error) {
        return handleRouteError(error)
    }
}
