import { NextResponse } from 'next/server'
import db from '@/lib/server/db'

// Public liveness check for an uptime monitor (e.g. UptimeRobot every 5 min).
//
// By default it does NOT touch the database: on Neon's free plan a query every
// few minutes would keep the compute awake around the clock and use up the
// monthly compute allowance. Add ?db=1 for a deep check when investigating.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const body: Record<string, unknown> = { ok: true, time: new Date().toISOString() }
  let status = 200

  if (new URL(request.url).searchParams.get('db') === '1') {
    const started = Date.now()
    try {
      await db.$queryRaw`SELECT 1`
      body.db = { ok: true, ms: Date.now() - started }
    } catch (error) {
      console.error('Health check: database unreachable', error)
      body.ok = false
      body.db = { ok: false }
      status = 503
    }
  }

  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
