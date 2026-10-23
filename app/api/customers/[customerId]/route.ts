import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { getCustomer, updateCustomer } from '@/lib/server/customers'
import { audit, diff } from '@/lib/server/audit'
import db from '@/lib/server/db'

// The customer page: totals, receivers and full order history (managers).
export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const { customerId } = await params
        return NextResponse.json(await getCustomer(customerId))
    } catch (error) {
        return handleRouteError(error)
    }
}

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
