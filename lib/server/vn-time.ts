// Business dates are Vietnam dates. Vercel functions run in UTC, so local-time
// Date methods put orders placed 00:00-07:00 in Vietnam on the previous day and
// start "this month" at 07:00 on the 1st. Vietnam has no daylight saving, so a
// fixed +07:00 offset is exact.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The same instant, shifted so its UTC fields read as Vietnam wall-clock time. */
const toVnWallClock = (date: Date) => new Date(date.getTime() + VN_OFFSET_MS)

/** "YYYY-MM-DD" of the Vietnam calendar day containing `date`. */
export function vnDateKey(date: Date): string {
  return toVnWallClock(date).toISOString().slice(0, 10)
}

/** The instant Vietnam's calendar day containing `date` begins (00:00 +07:00). */
export function startOfVnDay(date: Date): Date {
  const wall = toVnWallClock(date)
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - VN_OFFSET_MS)
}

/** The instant the Vietnam calendar month containing `date` begins. */
export function startOfVnMonth(date: Date): Date {
  const wall = toVnWallClock(date)
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1) - VN_OFFSET_MS)
}

/** Start of the Vietnam day `days` days after the one containing `date` (negative = before). */
export function addVnDays(date: Date, days: number): Date {
  return new Date(startOfVnDay(date).getTime() + days * DAY_MS)
}

/** Parse "YYYY-MM-DD" as the start of that Vietnam day, or null if malformed. */
export function parseVnDateKey(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const time = Date.parse(`${key}T00:00:00+07:00`)
  return Number.isNaN(time) ? null : new Date(time)
}
