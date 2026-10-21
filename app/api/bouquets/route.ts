import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { handleRouteError } from '@/lib/server/route-helpers'
import { ORDER_WRITE_ROLES, requireUser } from '@/lib/server/session'

// Bouquet names used on recent orders, with the latest photo for each, for the
// new-order form's suggestions. Replaces downloading every order to build them.
export async function GET(request: Request) {
    try {
        await requireUser(request, ORDER_WRITE_ROLES)
        const recent = await db.order.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
            select: { bouquetName: true, bouquetImage: true },
        })
        const seen = new Map<string, string | null>()
        for (const { bouquetName, bouquetImage } of recent) {
            const name = bouquetName.trim()
            if (!name) continue
            // Inline (base64) images are not worth sending as a suggestion.
            const image = bouquetImage && !bouquetImage.startsWith('data:') ? bouquetImage : null
            if (!seen.has(name)) seen.set(name, image)
            else if (!seen.get(name) && image) seen.set(name, image)
        }
        return NextResponse.json([...seen].slice(0, 200).map(([name, image]) => ({ name, image })))
    } catch (error) {
        return handleRouteError(error)
    }
}
