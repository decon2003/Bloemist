export const DAY_IN_MS = 1000 * 60 * 60 * 24

export const getStartOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

/** Local-time day key. Returns null for unparseable input rather than the
 *  string "NaN-NaN-NaN", which silently matches no bucket and makes the record
 *  disappear from every date view without any error.
 *
 *  A Date argument is assumed already-constructed and yields a plain string, so
 *  callers building keys from Dates they just made don't need a null check. */
export function getDateKey(value: Date): string
export function getDateKey(value: string | Date | null | undefined): string | null
export function getDateKey(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
