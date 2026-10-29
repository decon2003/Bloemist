import { ApiError } from './api-error'
import { addVnDays, parseVnDateKey, startOfVnDay } from './vn-time'

// List endpoints never return a whole table any more: the response grew with
// every order ever placed and would pass Vercel's 4.5 MB response cap within
// about a year. A list is either a date window (Vietnam days) or a search, and
// the Orders page loads it a page at a time (?limit=).

/** With no date and no search: the working window - last week to two months ahead. */
const DEFAULT_DAYS_BACK = 7
const DEFAULT_DAYS_AHEAD = 60
/** Days covered by ?from= without ?to=. */
const OPEN_RANGE_DAYS = 31
/** Longest window a manager may ask for (a year of history). */
const MAX_RANGE_DAYS = 400
/** Sales and florists only see the last month of history. */
export const STAFF_HISTORY_DAYS = 30
/** Hard cap on rows; a peak day is ~200 orders. */
export const LIST_LIMIT = 1000
/** Searches cover all history, newest first, but return fewer rows. */
export const SEARCH_LIMIT = 100

/** `since`: nothing older may be returned (staff history limit).
 *  `limit`: rows wanted, for pages loaded with "Xem thêm". */
export type ListScope =
  | { kind: 'range'; start: Date; end: Date; since?: Date; limit?: number }
  | { kind: 'search'; q: string; since?: Date; limit?: number }

type Viewer = { role: string }
const MANAGER_ROLES = ['admin']

/** Read ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive Vietnam days) or ?q=text,
 *  plus ?limit=. Without a manager viewer, history is cut at 30 days. */
export function parseListScope(params: URLSearchParams, viewer?: Viewer): ListScope {
  const now = new Date()
  const since = viewer && !MANAGER_ROLES.includes(viewer.role)
    ? addVnDays(startOfVnDay(now), -STAFF_HISTORY_DAYS)
    : undefined

  const limitParam = params.get('limit')
  const limit = limitParam ? Number(limitParam) : undefined
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0 && limit <= LIST_LIMIT)) {
    throw new ApiError(400, `Số dòng phải từ 1 đến ${LIST_LIMIT}`)
  }

  const q = params.get('q')?.trim()
  if (q) {
    if (q.length > 100) throw new ApiError(400, 'Từ khoá tìm kiếm quá dài')
    return { kind: 'search', q, since, limit }
  }

  const fromParam = params.get('from')
  const toParam = params.get('to')
  const from = parseVnDateKey(fromParam)
  const to = parseVnDateKey(toParam)
  if ((fromParam && !from) || (toParam && !to)) throw new ApiError(400, 'Ngày không hợp lệ')

  let start = from ?? (to ? to : addVnDays(now, -DEFAULT_DAYS_BACK))
  // `to` is inclusive, so the window ends at the start of the following day.
  // A start date alone (an open-ended range in the UI) covers the next month.
  const end = to ? addVnDays(to, 1) : from ? addVnDays(from, OPEN_RANGE_DAYS) : addVnDays(now, DEFAULT_DAYS_AHEAD + 1)

  if (end <= start) throw new ApiError(400, 'Ngày kết thúc phải sau ngày bắt đầu')
  const days = Math.round((end.getTime() - startOfVnDay(start).getTime()) / 86_400_000)
  if (days > MAX_RANGE_DAYS) throw new ApiError(400, `Chỉ xem được tối đa ${MAX_RANGE_DAYS} ngày một lần`)

  if (since && start < since) {
    if (end <= since) throw new ApiError(403, `Chỉ xem được ${STAFF_HISTORY_DAYS} ngày gần nhất`)
    start = since
  }

  return { kind: 'range', start, end, since, limit }
}
