import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/server/route-helpers'
import { ORDER_WRITE_ROLES, requireUser } from '@/lib/server/session'
import { lookupCustomer } from '@/lib/server/customers'

// Sales look up one customer by exact phone while taking an order; they cannot
// browse or search the whole list.
export async function GET(request: Request) {
    try {
        await requireUser(request, ORDER_WRITE_ROLES)
        const phone = new URL(request.url).searchParams.get('phone') ?? ''
        return NextResponse.json(await lookupCustomer(phone))
    } catch (error) {
        return handleRouteError(error)
    }
}
