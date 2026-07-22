import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { assertOneOf, parseNonNegativeInt, requireNonBlank } from '@/lib/server/validation'

const INVENTORY_TYPES = ['BOUQUET', 'MATERIAL'] as const
const LOW_STOCK_THRESHOLD = 5

const deriveStatus = (onHand: number, reserved: number) => {
    const available = onHand - reserved
    if (available <= 0) return 'out'
    return available < LOW_STOCK_THRESHOLD ? 'low' : 'ok'
}

export async function GET() {
    try {
        const items = await db.inventoryItem.findMany({
            orderBy: { lastUpdated: 'desc' }
        })
        return NextResponse.json(items)
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function POST(request: Request) {
    try {
        const body = await readJsonBody(request)
        const { id } = body

        if (id) {
            // UPDATE path. Only fields actually present in the request are
            // written. The previous `onHand: onHand || 0` form zeroed the stock
            // (and flipped status to 'out') whenever a caller updated just the
            // name or the image.
            const existing = await db.inventoryItem.findUnique({ where: { id } })
            if (!existing) {
                throw new ApiError(404, 'Inventory item not found')
            }

            const data: Record<string, unknown> = {}
            if (body.name !== undefined) data.name = requireNonBlank(body.name, 'name', 200)
            if (body.type !== undefined) data.type = assertOneOf(body.type, INVENTORY_TYPES, 'type')
            if (body.unit !== undefined) data.unit = requireNonBlank(body.unit, 'unit', 32)
            if (body.image !== undefined) data.image = body.image === null ? null : String(body.image)
            if (body.onHand !== undefined) data.onHand = parseNonNegativeInt(body.onHand, 'onHand')
            if (body.reserved !== undefined) data.reserved = parseNonNegativeInt(body.reserved, 'reserved')

            if (Object.keys(data).length === 0) {
                throw new ApiError(400, 'No updatable fields supplied')
            }

            data.status = deriveStatus(
                (data.onHand as number | undefined) ?? existing.onHand,
                (data.reserved as number | undefined) ?? existing.reserved,
            )

            const item = await db.inventoryItem.update({ where: { id }, data })
            return NextResponse.json(item)
        }

        // CREATE path. All non-nullable columns are required up front so a
        // missing name surfaces as a 400 rather than a raw Prisma 500.
        const name = requireNonBlank(body.name, 'name', 200)
        const type = assertOneOf(body.type, INVENTORY_TYPES, 'type')
        const unit = requireNonBlank(body.unit, 'unit', 32)
        const onHand = parseNonNegativeInt(body.onHand, 'onHand', 0)
        const reserved = parseNonNegativeInt(body.reserved, 'reserved', 0)

        // There is no unique constraint on (name, type), so an upsert keyed on a
        // blank id always inserted and produced duplicate rows. Match explicitly
        // on name AND type - matching on name alone collided a bouquet with a
        // material of the same name.
        const duplicate = await db.inventoryItem.findFirst({ where: { name, type } })
        if (duplicate) {
            throw new ApiError(409, `An inventory item named "${name}" already exists for this type`)
        }

        const item = await db.inventoryItem.create({
            data: {
                name,
                type,
                unit,
                image: body.image === undefined || body.image === null ? null : String(body.image),
                onHand,
                reserved,
                status: deriveStatus(onHand, reserved),
            }
        })

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
