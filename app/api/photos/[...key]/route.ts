import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { PHOTO_FOLDERS, signedPhotoUrl } from '@/lib/server/storage'

// <img src="/api/photos/..."> sends the session cookie, so only signed-in staff
// get redirected to the (short-lived) signed R2 URL.
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
    try {
        await requireUser(request)
        const { key } = await params
        if (!key?.length || !PHOTO_FOLDERS.includes(key[0] as never) || key.some((part) => part === '..' || part === '')) {
            throw new ApiError(404, 'Photo not found')
        }

        const response = NextResponse.redirect(await signedPhotoUrl(key.join('/'), 300), 302)
        // Shorter than the signature lifetime so the browser never reuses an expired URL.
        response.headers.set('Cache-Control', 'private, max-age=240')
        return response
    } catch (error) {
        return handleRouteError(error)
    }
}
