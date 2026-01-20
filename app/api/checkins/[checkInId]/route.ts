
import { NextResponse } from 'next/server'
import { checkOutStaff } from '@/lib/server/data-store'

export async function PATCH(_request: Request, { params }: { params: Promise<{ checkInId: string }> }) {
    try {
        const { checkInId } = await params
        const result = await checkOutStaff(checkInId)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Check-out failed:', error)
        return new NextResponse(error.message || 'Internal Server Error', { status: error.status || 500 })
    }
}
