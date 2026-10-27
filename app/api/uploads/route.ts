import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { storePhoto } from '@/lib/server/storage'

// Sample/reference photos for orders and tasks. The returned url is what the
// client then puts into samplePhotoUrls / bouquetImage.
export async function POST(request: Request) {
    try {
        await requireUser(request)
        const formData = await request.formData().catch(() => {
            throw new ApiError(400, 'Vui lòng chọn một file ảnh')
        })
        const url = await storePhoto(formData.get('photo'), 'samples', formData.get('thumb'))
        return NextResponse.json({ url }, { status: 201 })
    } catch (error) {
        return handleRouteError(error)
    }
}
