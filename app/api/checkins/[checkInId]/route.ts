
import { NextResponse } from 'next/server'
import { checkOutStaff } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function PATCH(_request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
    try {
        const { checkInId } = await params
        const result = await checkOutStaff(checkInId)
        return NextResponse.json(result)
    } catch (error) {
        // Use the shared handler. The previous inline version echoed raw error
        // messages - which carry Prisma model and column names - back to the
        // client as plain text, in a body shape no other route returns.
        return handleRouteError(error)
    }
}
