import { NextResponse } from 'next/server'
import { clearSessionCookie, revokeSession } from '@/lib/server/session'

// Signing out revokes this device's session on the server: a copied cookie
// stops working at once, while the account's other devices stay signed in
// (the admin account is shared by the owner and the technician).
export async function POST(request: Request) {
    await revokeSession(request).catch((error) => console.error('Revoking the session failed', error))
    const response = new NextResponse(null, { status: 204 })
    clearSessionCookie(response)
    return response
}
