// One-off: move photos stored inline in the database (base64 data URLs) to R2
// and replace them with /api/photos/<key> paths.
//
//   node scripts/migrate-photos-to-r2.mjs            # dry run - counts only
//   node scripts/migrate-photos-to-r2.mjs --apply    # upload and rewrite rows
//
// Needs DATABASE_URL and R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
// / R2_BUCKET in .env (or the environment). Safe to re-run: rows already
// migrated are skipped, and keys are content hashes so the same photo used by
// an order and its tasks is stored once.
import { createHash } from 'node:crypto'
import { AwsClient } from 'aws4fetch'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile()
} catch {
  // no .env file - rely on the environment
}

const apply = process.argv.includes('--apply')
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
if (apply && !(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET)) {
  console.error('R2_* environment variables are missing')
  process.exit(1)
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' }
const r2 = apply
  ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' })
  : null
const prisma = new PrismaClient()
const uploaded = new Map()
const stats = { photos: 0, bytes: 0, rows: 0 }

async function toR2(value, folder) {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value ?? '')
  if (!match) return value
  const [, mime, base64] = match
  const body = Buffer.from(base64, 'base64')
  const key = `${folder}/legacy/${createHash('sha256').update(body).digest('hex')}.${EXT[mime] ?? 'bin'}`
  stats.photos += 1
  stats.bytes += body.length

  if (!apply) return `/api/photos/${key}`
  if (!uploaded.has(key)) {
    const response = await r2.fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`, {
      method: 'PUT',
      body,
      headers: { 'content-type': mime },
    })
    if (!response.ok) throw new Error(`Upload failed for ${key}: ${response.status} ${await response.text()}`)
    uploaded.set(key, true)
  }
  return `/api/photos/${key}`
}

const isInline = (value) => typeof value === 'string' && value.startsWith('data:')

try {
  const taskIds = await prisma.task.findMany({ select: { id: true } })
  for (const { id } of taskIds) {
    const task = await prisma.task.findUnique({
      where: { id },
      select: { completionProofUrl: true, bouquetImage: true, samplePhotoUrls: true },
    })
    const samples = task.samplePhotoUrls ? JSON.parse(task.samplePhotoUrls) : []
    if (!isInline(task.completionProofUrl) && !isInline(task.bouquetImage) && !samples.some(isInline)) continue

    const data = {
      completionProofUrl: await toR2(task.completionProofUrl, 'proofs'),
      bouquetImage: await toR2(task.bouquetImage, 'samples'),
      samplePhotoUrls: JSON.stringify(await Promise.all(samples.map((url) => toR2(url, 'samples')))),
    }
    stats.rows += 1
    if (apply) await prisma.task.update({ where: { id }, data })
  }

  const orderIds = await prisma.order.findMany({ select: { id: true } })
  for (const { id } of orderIds) {
    const order = await prisma.order.findUnique({ where: { id }, select: { bouquetImage: true } })
    if (!isInline(order.bouquetImage)) continue
    const bouquetImage = await toR2(order.bouquetImage, 'samples')
    stats.rows += 1
    if (apply) await prisma.order.update({ where: { id }, data: { bouquetImage } })
  }

  console.log(
    `${apply ? 'Migrated' : 'Would migrate'} ${stats.photos} photos ` +
      `(${(stats.bytes / 1024 / 1024).toFixed(1)} MB) across ${stats.rows} rows` +
      (apply ? `; ${uploaded.size} unique files uploaded.` : '. Re-run with --apply to do it.'),
  )
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
