import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { clearSessionCookie, getSessionUser } from '@/lib/server/session'

// Signing out revokes the session on the server too (it also signs the person
// out on their other devices): a copied cookie stops working at once.
export async function POST(request: Request) {
    const me = await getSessionUser(request).catch(() => null)
    if (me) await db.user.update({ where: { id: me.id }, data: { sessionVersion: { increment: 1 } } }).catch(() => undefined)
    const response = new NextResponse(null, { status: 204 })
    clearSessionCookie(response)
    return response
}
