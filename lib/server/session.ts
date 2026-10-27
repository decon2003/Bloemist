import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextResponse } from 'next/server'
import db from './db'
import { ApiError } from './api-error'
import type { UserRole } from './validation'

export const SESSION_COOKIE = 'bloemist_session'
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

export const MANAGER_ROLES: UserRole[] = ['boss', 'admin']
export const ORDER_WRITE_ROLES: UserRole[] = ['boss', 'admin', 'sales']

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  mustChangePassword: boolean
  sessionVersion: number
}

const BLOCKED_STATUSES = ['inactive', 'disabled']

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV !== 'production') {
    // Local dev without AUTH_SECRET: a random key for this server process, never
    // a fixed one (the repo is readable, so a fixed key would let anyone forge
    // a session). Kept on globalThis so hot reloads don't log everyone out.
    const dev = globalThis as { bloemistDevSecret?: string }
    dev.bloemistDevSecret ??= randomBytes(32).toString('base64url')
    return dev.bloemistDevSecret
  }
  // Refuse to sign or accept anything rather than fall back to a guessable key.
  throw new Error('AUTH_SECRET must be set (at least 32 characters)')
}

const sign = (payload: string) => createHmac('sha256', getSecret()).update(payload).digest('base64url')

// Cookie value: base64url("<userId>.<sessionVersion>.<expiresAtSeconds>").<hmac>
// Stateless, but every request re-reads the user, so deactivating an account or
// bumping sessionVersion (password change/reset) revokes it immediately.
function encodeSession(userId: string, sessionVersion: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(`${userId}.${sessionVersion}.${expiresAt}`).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function decodeSession(value: string): { userId: string; sessionVersion: number } | null {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  const [userId, version, expiresAt] = Buffer.from(payload, 'base64url').toString().split('.')
  if (!userId || Number(expiresAt) * 1000 < Date.now()) return null
  return { userId, sessionVersion: Number(version) }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function setSessionCookie(response: NextResponse, user: { id: string; sessionVersion: number }) {
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id, user.sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return null
  const session = decodeSession(raw)
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true, sessionVersion: true },
  })
  if (!user || user.sessionVersion !== session.sessionVersion || BLOCKED_STATUSES.includes(user.status)) {
    return null
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  }
}

/** Gate for every API route. Throws 401 without a valid session, 403 when the
 *  role is not allowed or the user still has to replace a temporary password. */
export async function requireUser(
  request: Request,
  roles?: readonly UserRole[],
  { allowPendingPasswordChange = false } = {},
): Promise<SessionUser> {
  const user = await getSessionUser(request)
  if (!user) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    throw new ApiError(403, 'PASSWORD_CHANGE_REQUIRED')
  }
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này')
  }
  return user
}

export const isManager = (user: SessionUser) => MANAGER_ROLES.includes(user.role)
