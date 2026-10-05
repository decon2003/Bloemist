import { NextResponse } from 'next/server'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { updateCustomer } from '@/lib/server/customers'

export async function PATCH(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const { customerId } = await params
        const body = await readJsonBody(request)
        return NextResponse.json(await updateCustomer(customerId, body))
    } catch (error) {
        return handleRouteError(error)
    }
}
