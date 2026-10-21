// Phone photos are 3-5 MB. Sample photos are what florists copy, so they must
// stay sharp when zoomed: keep "HD" (2560px, high JPEG quality, ~1 MB) rather
// than squeezing for storage - R2 costs cents per GB. Step the quality down
// only if a busy photo would exceed the upload limit.

const MAX_DIMENSION = 2560
const QUALITIES = [0.88, 0.8, 0.7]
// Uploads pass through a Vercel function (4.5 MB request cap, server allows 4 MB).
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024

export async function compressImage(file: File | Blob): Promise<Blob> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Formats the browser cannot decode (e.g. HEIC outside Safari) go up as-is;
    // the server still enforces the size limit.
    return file
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob: Blob | null = null
  for (const quality of QUALITIES) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size <= TARGET_MAX_BYTES) break
  }
  // Never make a small file bigger.
  return blob && blob.size < file.size ? blob : file
}
