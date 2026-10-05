// Phone photos are 3-5 MB; a bouquet photo only needs to be legible on a
// phone screen. Downscale and re-encode as JPEG before upload so it stays well
// under the server limit and keeps storage on the free tier.

const MAX_DIMENSION = 1600
const QUALITY = 0.8

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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  // Never make a small file bigger.
  return blob && blob.size < file.size ? blob : file
}
