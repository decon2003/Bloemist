import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { backupToR2 } from '@/lib/server/backup'
import { isR2Configured } from '@/lib/server/storage'

// Called by Vercel Cron (see vercel.json) once a day. Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anyone else gets 401.
export const maxDuration = 60

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) {
    console.error('Backup skipped: R2 is not configured')
    return NextResponse.json({ error: 'R2 is not configured' }, { status: 500 })
  }
  try {
    const result = await backupToR2()
    console.log('Backup written', JSON.stringify(result))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Backup failed', error)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
