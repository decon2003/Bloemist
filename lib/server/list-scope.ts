import { ApiError } from './api-error'
import { addVnDays, parseVnDateKey, startOfVnDay } from './vn-time'

// List endpoints never return a whole table any more: the response grew with
// every order ever placed and would pass Vercel's 4.5 MB response cap within
// about a year. A list is either a date window (Vietnam days) or a search.

/** With no date and no search: the working window - last week to two months ahead. */
const DEFAULT_DAYS_BACK = 7
const DEFAULT_DAYS_AHEAD = 60
/** Days covered by ?from= without ?to=. */
const OPEN_RANGE_DAYS = 31
/** Longest window a caller may ask for. */
const MAX_RANGE_DAYS = 93
/** Hard cap on rows; a peak day is ~200 orders. */
export const LIST_LIMIT = 1000
/** Searches cover all history, newest first, but return fewer rows. */
export const SEARCH_LIMIT = 100

export type ListScope =
  | { kind: 'range'; start: Date; end: Date }
  | { kind: 'search'; q: string }

/** Read ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive Vietnam days) or ?q=text. */
export function parseListScope(params: URLSearchParams): ListScope {
  const q = params.get('q')?.trim()
  if (q) {
    if (q.length > 100) throw new ApiError(400, 'Search text is too long')
    return { kind: 'search', q }
  }

  const fromParam = params.get('from')
  const toParam = params.get('to')
  const from = parseVnDateKey(fromParam)
  const to = parseVnDateKey(toParam)
  if ((fromParam && !from) || (toParam && !to)) throw new ApiError(400, 'Dates must be YYYY-MM-DD')

  const now = new Date()
  const start = from ?? (to ? to : addVnDays(now, -DEFAULT_DAYS_BACK))
  // `to` is inclusive, so the window ends at the start of the following day.
  // A start date alone (an open-ended range in the UI) covers the next month.
  const end = to ? addVnDays(to, 1) : from ? addVnDays(from, OPEN_RANGE_DAYS) : addVnDays(now, DEFAULT_DAYS_AHEAD + 1)

  if (end <= start) throw new ApiError(400, '"to" must not be before "from"')
  const days = Math.round((end.getTime() - startOfVnDay(start).getTime()) / 86_400_000)
  if (days > MAX_RANGE_DAYS) throw new ApiError(400, `Date range is limited to ${MAX_RANGE_DAYS} days`)

  return { kind: 'range', start, end }
}

/** Digits of a search term, for matching phone numbers typed with spaces or dashes. */
export const searchDigits = (q: string) => q.replace(/\D/g, '')
