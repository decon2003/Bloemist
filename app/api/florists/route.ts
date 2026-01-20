import { NextResponse } from 'next/server'
import { listFlorists } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
  try {
    const florists = await listFlorists()
    return NextResponse.json(florists)
  } catch (error) {
    return handleRouteError(error)
  }
}
