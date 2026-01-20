import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
    try {
        const rows = db.prepare('SELECT * FROM inventory').all()
        const inventory = rows.map((row: any) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            image: row.image,
            unit: row.unit,
            onHand: row.on_hand,
            reserved: row.reserved,
            status: row.status,
            lastUpdated: row.last_updated
        }))
        return NextResponse.json(inventory)
    } catch (error) {
        return handleRouteError(error)
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { id, type, name, onHand, reserved, unit, image } = body

        const status = (onHand - reserved) <= 0 ? 'out' : (onHand - reserved) < 5 ? 'low' : 'ok'

        db.prepare(`
            INSERT OR REPLACE INTO inventory (id, type, name, on_hand, reserved, unit, image, status, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(id || `item-${Date.now()}`, type, name, onHand, reserved, unit, image, status)

        const newItem = db.prepare('SELECT * FROM inventory WHERE name = ?').get(name) as any
        return NextResponse.json({
            id: newItem.id,
            name: newItem.name,
            type: newItem.type,
            image: newItem.image,
            unit: newItem.unit,
            onHand: newItem.on_hand,
            reserved: newItem.reserved,
            status: newItem.status,
            lastUpdated: newItem.last_updated
        })
    } catch (error) {
        return handleRouteError(error)
    }
}
