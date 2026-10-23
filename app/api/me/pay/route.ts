import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'
import { getMyPay } from '@/lib/server/payroll'

// GET ?month=YYYY-MM -> the signed-in person's own pay for that month: the
// locked payroll line, or an estimate while the month is open. Never anyone else's.
export async function GET(request: Request) {
  try {
    const me = await requireUser(request)
    const month = new URL(request.url).searchParams.get('month') ?? ''
    return NextResponse.json(await getMyPay(me.id, month))
  } catch (error) {
    return handleRouteError(error)
  }
}
