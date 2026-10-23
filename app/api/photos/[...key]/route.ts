import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/server/api-error'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { signedPhotoUrl } from '@/lib/server/storage'

// The only keys photos are stored under (lib/server/storage.ts and
// scripts/migrate-photos-to-r2.mjs). Anything else is refused: checking the
// folder and ".." segments was not enough, because an encoded slash
// ("samples/..%2Fbackups%2F...") arrives as one segment and the URL is then
// normalised to backups/ - which would have handed out the database backups.
const PHOTO_KEY =
  /^(proofs|samples)\/(\d{4}\/\d{2}\/[0-9a-f-]{36}(\.hd|\.thumb)?|legacy\/[0-9a-f]{64})\.(jpg|png|webp|heic|heif|gif|bin)$/

// <img src="/api/photos/..."> sends the session cookie, so only signed-in staff
// get redirected to the (short-lived) signed R2 URL.
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
    try {
        await requireUser(request)
        const { key } = await params
        const path = key?.join('/') ?? ''
        if (!PHOTO_KEY.test(path)) throw new ApiError(404, 'Photo not found')

        const response = NextResponse.redirect(await signedPhotoUrl(path, 300), 302)
        // Shorter than the signature lifetime so the browser never reuses an expired URL.
        response.headers.set('Cache-Control', 'private, max-age=240')
        return response
    } catch (error) {
        return handleRouteError(error)
    }
}
