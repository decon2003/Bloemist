import { NextResponse } from 'next/server'
import { listFlorists } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'
import { requireUser } from '@/lib/server/session'

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const florists = await listFlorists()
    return NextResponse.json(florists)
  } catch (error) {
    return handleRouteError(error)
  }
}
