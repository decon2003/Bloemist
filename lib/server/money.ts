// Money arrives as free-form strings ("1.500.000 d", "-50000", "1 234,56").
// Strip grouping separators and currency decoration but preserve the sign and
// the decimal separator - dropping either silently turns refunds into revenue
// and inflates decimal amounts by 10x/100x.
export const parseCurrencyToNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  let text = value.trim().replace(/[^\d,.\-]/g, '')
  const negative = text.startsWith('-')
  text = text.replace(/-/g, '')

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const decimalAt = Math.max(lastComma, lastDot)

  // A separator is decimal only when it is the last one and leaves 1-2 digits
  // after it; otherwise every separator is thousands grouping (VN style).
  if (decimalAt !== -1 && text.length - decimalAt - 1 <= 2 && text.length - decimalAt - 1 > 0) {
    const whole = text.slice(0, decimalAt).replace(/[.,]/g, '')
    const fraction = text.slice(decimalAt + 1)
    text = `${whole}.${fraction}`
  } else {
    text = text.replace(/[.,]/g, '')
  }

  const numeric = Number(text)
  if (!Number.isFinite(numeric)) return 0
  return negative ? -numeric : numeric
}
