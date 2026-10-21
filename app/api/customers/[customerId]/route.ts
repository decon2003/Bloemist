import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { updateCustomer } from '@/lib/server/customers'
import { audit, diff } from '@/lib/server/audit'
import db from '@/lib/server/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { customerId } = await params
        const body = await readJsonBody(request)
        const before = await db.customer.findUnique({ where: { id: customerId } })
        const updated = await updateCustomer(customerId, body)
        if (before) {
            const changes = diff(before, updated, ['name', 'notes', 'source', 'marketingConsent'])
            if (changes) await audit(me, { action: 'customer.update', entity: 'customer', entityId: customerId, summary: updated.phone, changes })
        }
        return NextResponse.json(updated)
    } catch (error) {
        return handleRouteError(error)
    }
}
