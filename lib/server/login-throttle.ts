import db from './db'
import { ApiError } from './api-error'

// Failed sign-ins per client IP. The per-account lock (5 wrong passwords)
// stops guessing one password, but not trying a common password against every
// email; this caps all failures from one IP.
const WINDOW_MS = 15 * 60_000
const MAX_FAILURES_PER_IP = 20

/** The client's IP. On Vercel these headers are set by the platform, not the client. */
export const clientIp = (request: Request) =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

export async function assertIpAllowed(ip: string) {
  const failures = await db.loginFailure.count({ where: { ip, at: { gte: new Date(Date.now() - WINDOW_MS) } } })
  if (failures >= MAX_FAILURES_PER_IP) {
    throw new ApiError(429, 'Đăng nhập sai quá nhiều lần từ thiết bị này. Vui lòng thử lại sau 15 phút.')
  }
}

export const recordLoginFailure = (ip: string) => db.loginFailure.create({ data: { ip } })

/** Nightly: failures older than a day no longer matter. */
export const pruneLoginFailures = () => db.loginFailure.deleteMany({ where: { at: { lt: new Date(Date.now() - 86_400_000) } } })
