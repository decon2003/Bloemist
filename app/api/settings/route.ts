import { NextResponse } from 'next/server'
import { listStoreLocations } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { getShopSettings, updateShopSettings } from '@/lib/server/attendance'

const toResponse = async (settings: { openTime: string; closeTime: string }) => ({
    storeLocations: await listStoreLocations(),
    workingHours: { start: settings.openTime, end: settings.closeTime },
})

export async function GET(request: Request) {
    try {
        await requireUser(request)
        return NextResponse.json(await toResponse(await getShopSettings()))
    } catch (error) {
        return handleRouteError(error)
    }
}

// { workingHours: { start: 'HH:mm', end: 'HH:mm' } } - managers only.
export async function PATCH(request: Request) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const body = await readJsonBody(request)
        const updated = await updateShopSettings(me, { openTime: body.workingHours?.start, closeTime: body.workingHours?.end })
        return NextResponse.json(await toResponse(updated))
    } catch (error) {
        return handleRouteError(error)
    }
}
