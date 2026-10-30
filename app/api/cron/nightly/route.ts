import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { backupToR2 } from '@/lib/server/backup'
import { closeOpenShifts } from '@/lib/server/attendance'
import { isR2Configured } from '@/lib/server/storage'
import { pruneLoginFailures } from '@/lib/server/login-throttle'
import { pruneRevokedSessions } from '@/lib/server/session'

// Nightly job (vercel.json, 19:00 UTC = 02:00 Vietnam): close shifts nobody
// checked out of, then back up - so the backup holds the closed shifts.
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
  const result: Record<string, unknown> = {}
  try {
    result.closedShifts = await closeOpenShifts()
  } catch (error) {
    console.error('Closing open shifts failed', error)
    result.closedShifts = 'failed'
  }
  await pruneLoginFailures().catch((error) => console.error('Pruning login failures failed', error))
  await pruneRevokedSessions().catch((error) => console.error('Pruning revoked sessions failed', error))
  if (!isR2Configured()) {
    console.error('Backup skipped: R2 is not configured')
    return NextResponse.json({ ...result, backup: 'R2 is not configured' }, { status: 500 })
  }
  try {
    result.backup = await backupToR2()
    console.log('Nightly job done', JSON.stringify(result))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Backup failed', error)
    return NextResponse.json({ ...result, backup: 'failed' }, { status: 500 })
  }
}
