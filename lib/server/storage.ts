import { randomUUID } from 'crypto'
import { request as httpsRequest } from 'https'
import { AwsClient } from 'aws4fetch'
import { ApiError } from './api-error'
import { vnDateKey } from './vn-time'

// Photos live in a private Cloudflare R2 bucket. The database stores only the
// app path "/api/photos/<key>"; that route checks the session and redirects to
// a short-lived signed URL, so a leaked link stops working within minutes.
//
// Until R2 is configured, uploads fall back to inline data URLs (the old
// behaviour) so the app keeps working; scripts/migrate-photos-to-r2.mjs moves
// them out later.

export const PHOTO_PATH_PREFIX = '/api/photos/'

// Vercel rejects request bodies over 4.5 MB. Clients compress to a few hundred
// KB first; this is the server-side ceiling.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

// Inline storage bloats the database ~1.37x, so keep the old, tighter cap there.
const MAX_INLINE_BYTES = 2 * 1024 * 1024

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const PHOTO_FOLDERS = ['proofs', 'samples'] as const
export type PhotoFolder = (typeof PHOTO_FOLDERS)[number]

type R2Config = { accountId: string; bucket: string; client: AwsClient }

let cached: R2Config | null | undefined

function getR2(): R2Config | null {
  if (cached !== undefined) return cached
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  cached =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
      ? {
          accountId: R2_ACCOUNT_ID,
          bucket: R2_BUCKET,
          client: new AwsClient({
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
            service: 's3',
            region: 'auto',
          }),
        }
      : null
  return cached
}

export const isR2Configured = () => getR2() !== null

const objectUrl = (r2: R2Config, key: string) =>
  `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`

const MAX_THUMB_BYTES = 300 * 1024

/** Validate an uploaded image and store it. Returns the value to save in the
 *  database: an /api/photos/ path, or a data URL when R2 is not configured.
 *
 *  With a valid JPEG `thumbnail` (made in the browser), the photo is stored as
 *  "<id>.hd.<ext>" and the thumbnail as "<id>.thumb.jpg"; list views derive the
 *  thumbnail URL from the ".hd." marker (thumbUrl in lib/image-compress.ts), so
 *  no lookup is needed to know whether one exists. */
export async function storePhoto(file: unknown, folder: PhotoFolder, thumbnail?: unknown): Promise<string> {
  // formData.get() returns a string for a plain text field; check the shape.
  if (!file || typeof file !== 'object' || typeof (file as Blob).arrayBuffer !== 'function') {
    throw new ApiError(400, 'Vui lòng chọn một file ảnh')
  }
  const blob = file as Blob
  const mime = blob.type || 'application/octet-stream'
  const ext = ALLOWED_MIME[mime]
  if (!ext) {
    throw new ApiError(400, `Định dạng ảnh không hỗ trợ (${mime}). Chỉ nhận JPEG, PNG, WebP, HEIC.`)
  }
  if (blob.size === 0) throw new ApiError(400, 'File ảnh rỗng')

  const r2 = getR2()
  const limit = r2 ? MAX_UPLOAD_BYTES : MAX_INLINE_BYTES
  if (blob.size > limit) {
    throw new ApiError(
      413,
      `Ảnh quá lớn (${(blob.size / 1024 / 1024).toFixed(1)} MB). Tối đa ${limit / 1024 / 1024} MB.`,
    )
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  if (!r2) {
    return `data:${mime};base64,${buffer.toString('base64')}`
  }

  const base = `${folder}/${vnDateKey(new Date()).slice(0, 7).replace('-', '/')}/${randomUUID()}`
  const thumb = await readThumbnail(thumbnail)
  if (thumb) {
    // Thumbnail first: an ".hd." photo must never exist without its thumbnail.
    await putObject(`${base}.thumb.jpg`, thumb, 'image/jpeg')
    await putObject(`${base}.hd.${ext}`, buffer, mime)
    return `${PHOTO_PATH_PREFIX}${base}.hd.${ext}`
  }
  await putObject(`${base}.${ext}`, buffer, mime)
  return `${PHOTO_PATH_PREFIX}${base}.${ext}`
}

/** A usable thumbnail upload, or null to store the photo without one. */
async function readThumbnail(value: unknown): Promise<Buffer | null> {
  if (!value || typeof value !== 'object' || typeof (value as Blob).arrayBuffer !== 'function') return null
  const blob = value as Blob
  if (blob.type !== 'image/jpeg' || blob.size === 0 || blob.size > MAX_THUMB_BYTES) return null
  return Buffer.from(await blob.arrayBuffer())
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const r2 = getR2()
  if (!r2) throw new Error('R2 is not configured')

  // Sign with aws4fetch but send with node:https. On Vercel, fetch() streams
  // the body chunked without a Content-Length, and R2 rejects that with
  // 411 MissingContentLength (it worked locally, which hid the problem).
  const signed = await r2.client.sign(objectUrl(r2, key), {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'content-type': contentType },
  })
  const headers: Record<string, string | number> = Object.fromEntries(signed.headers.entries())
  headers['content-length'] = body.length

  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = httpsRequest(signed.url, { method: 'PUT', headers }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => (text += chunk))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, text }))
    })
    request.on('error', reject)
    request.setTimeout(20_000, () => request.destroy(new Error('R2 upload timed out')))
    request.end(body)
  }).catch((error: Error) => ({ status: 0, text: error.message }))

  if (status < 200 || status >= 300) {
    console.error('R2 upload failed', status, text)
    throw new ApiError(502, 'Không tải được ảnh lên kho lưu trữ, vui lòng thử lại')
  }
}

/** A GET URL for a private object, valid for `expiresIn` seconds. */
export async function signedPhotoUrl(key: string, expiresIn = 300): Promise<string> {
  const r2 = getR2()
  if (!r2) throw new ApiError(404, 'Photo storage is not configured')
  const url = new URL(objectUrl(r2, key))
  url.searchParams.set('X-Amz-Expires', String(expiresIn))
  const signed = await r2.client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } })
  return signed.url
}
