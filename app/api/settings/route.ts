import { NextResponse } from 'next/server'
import { listStoreLocations } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
    try {
        const locations = await listStoreLocations()
        return NextResponse.json({
            storeLocations: locations,
            workingHours: { start: '08:00', end: '19:00' } // Hardcoded for now
        })
    } catch (error) {
        return handleRouteError(error)
    }
}
