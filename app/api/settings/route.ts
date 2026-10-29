import { NextResponse } from 'next/server'
import { listStoreLocations } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { getShopSettings, parseHolidays, updateShopSettings } from '@/lib/server/attendance'
import { parseKpiShifts, parseKpiTiers } from '@/lib/server/kpi'

const toResponse = async (settings: { openTime: string; closeTime: string; holidays: string; kpiShifts: string; kpiTiers: string }) => ({
    storeLocations: await listStoreLocations(),
    workingHours: { start: settings.openTime, end: settings.closeTime },
    holidays: parseHolidays(settings.holidays),
    kpiShifts: parseKpiShifts(settings.kpiShifts),
    kpiTiers: parseKpiTiers(settings.kpiTiers),
})

export async function GET(request: Request) {
    try {
        await requireUser(request)
        return NextResponse.json(await toResponse(await getShopSettings()))
    } catch (error) {
        return handleRouteError(error)
    }
}

// { workingHours?: { start: 'HH:mm', end: 'HH:mm' }, holidays?: [{ date, name }],
//   kpiShifts?: [{ name, start, end }], kpiTiers?: [{ revenue, bonus }] } - managers only.
export async function PATCH(request: Request) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const body = await readJsonBody(request)
        const updated = await updateShopSettings(me, {
            openTime: body.workingHours?.start,
            closeTime: body.workingHours?.end,
            holidays: body.holidays,
            kpiShifts: body.kpiShifts,
            kpiTiers: body.kpiTiers,
        })
        return NextResponse.json(await toResponse(updated))
    } catch (error) {
        return handleRouteError(error)
    }
}
