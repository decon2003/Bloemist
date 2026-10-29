import { NextResponse, type NextRequest } from 'next/server'

// Refuse API writes started by another site. The session cookie is SameSite=Lax,
// which keeps it off cross-site requests, but sites on our own domain
// (bloemistflorals.com and its other subdomains) count as the same site; a
// write must come from this host. Requests without these headers (scripts,
// the cron job) are not from a browser page and are left to the session check.
export function proxy(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return NextResponse.next()
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const origin = request.headers.get('origin')
  let foreign = request.headers.get('sec-fetch-site') === 'cross-site'
  if (origin && origin !== 'null') {
    try {
      foreign ||= new URL(origin).host !== host
    } catch {
      foreign = true
    }
  } else if (origin === 'null') {
    foreign = true
  }
  if (foreign) return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 403 })
  return NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
