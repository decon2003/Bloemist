import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

// Serves photos that were stored inline (base64 data URLs) before object
// storage existed. List endpoints point at this route instead of embedding the
// bytes, which kept pushing list responses past Vercel's 4.5 MB limit.
//
//   /api/legacy-photos?task=<id>&field=proof|bouquet|sample&i=<index>
//   /api/legacy-photos?order=<id>&field=bouquet
//
// If the value has since been migrated to R2 (or replaced by a link), redirect.
export async function GET(request: Request) {
    try {
        await requireUser(request)
        const params = new URL(request.url).searchParams
        const taskId = params.get('task')
        const orderId = params.get('order')
        const field = params.get('field')

        let value: string | null | undefined
        if (taskId) {
            const task = await db.task.findUnique({
                where: { id: taskId },
                select: { completionProofUrl: true, bouquetImage: true, samplePhotoUrls: true },
            })
            if (field === 'proof') value = task?.completionProofUrl
            else if (field === 'bouquet') value = task?.bouquetImage
            else if (field === 'sample' && task?.samplePhotoUrls) {
                const list = JSON.parse(task.samplePhotoUrls) as unknown[]
                const item = list[Number(params.get('i'))]
                value = typeof item === 'string' ? item : null
            }
        } else if (orderId && field === 'bouquet') {
            const order = await db.order.findUnique({ where: { id: orderId }, select: { bouquetImage: true } })
            value = order?.bouquetImage
        }

        if (!value) throw new ApiError(404, 'Không tìm thấy ảnh')

        // Only images: a stored "data:text/html" must never be served as a page
        // from this site, and links only lead to our photos or to https.
        const match = /^data:(image\/(?:png|jpe?g|webp|gif|heic|heif));base64,([A-Za-z0-9+/=\s]*)$/i.exec(value)
        if (match) {
            return new NextResponse(new Uint8Array(Buffer.from(match[2], 'base64')), {
                headers: {
                    'Content-Type': match[1],
                    'Cache-Control': 'private, max-age=3600',
                    'X-Content-Type-Options': 'nosniff',
                    'Content-Security-Policy': "default-src 'none'; sandbox",
                },
            })
        }
        if (value.startsWith('/api/photos/') || /^https:\/\//i.test(value)) {
            return NextResponse.redirect(new URL(value, request.url), 302)
        }
        throw new ApiError(404, 'Không tìm thấy ảnh')
    } catch (error) {
        return handleRouteError(error)
    }
}
