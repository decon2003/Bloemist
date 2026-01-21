import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { handleRouteError } from '@/lib/server/route-helpers'

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
        const body = await request.json()
        const { id, name, type, image, unit, onHand, reserved } = body

        // Calculate status based on stock level
        const available = (onHand || 0) - (reserved || 0)
        const status = available <= 0 ? 'out' : available < 5 ? 'low' : 'ok'

        const item = await db.inventoryItem.upsert({
            where: { id: id || '' },
            update: {
                name,
                type,
                image,
                unit,
                onHand: onHand || 0,
                reserved: reserved || 0,
                status,
            },
            create: {
                name,
                type,
                image,
                unit,
                onHand: onHand || 0,
                reserved: reserved || 0,
                status,
            }
        })

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
