import { ApiError, fieldLabel } from './api-error'

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

// Money is stored as whole VND (integers). Inputs still arrive as typed text
// ("1.250.000", "1,250,000 ₫") or numbers; VND has no minor unit, so every
// non-digit is formatting.
const MAX_VND = 2_000_000_000

export function toVnd(value: unknown, field: string, { required = false } = {}): number | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ApiError(400, `Vui lòng nhập ${fieldLabel(field)}`)
    return null
  }
  let amount: number
  if (typeof value === 'number') {
    amount = Math.round(value)
  } else if (typeof value === 'string') {
    if (value.includes('-')) throw new ApiError(400, `${fieldLabel(field)} không được âm`)
    // "1.250.000 đ" is fine; "1e9" must not quietly become 19.
    if (!/^[\d.,\s]+(?:đ|₫|vnđ|vnd)?$/i.test(value.trim())) {
      throw new ApiError(400, `${fieldLabel(field)} không phải số tiền hợp lệ`)
    }
    const digits = value.replace(/\D/g, '')
    if (!digits) throw new ApiError(400, `${fieldLabel(field)} không phải số tiền hợp lệ`)
    amount = Number(digits)
  } else {
    throw new ApiError(400, `${fieldLabel(field)} không phải số tiền hợp lệ`)
  }
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, `${fieldLabel(field)} không được âm`)
  if (amount > MAX_VND) throw new ApiError(400, `${fieldLabel(field)} quá lớn`)
  return amount
}

export type OrderMoneyInput = {
  listedPrice: number
  deliveryFee: number | null
  deliveryCoveredByShop: boolean
  deposit: number | null
}

/** Derived amounts, computed on the server so a client cannot send a total
 *  that does not match its prices. Same formula as the new-order form:
 *  total = flowers + delivery fee (unless freeship); remaining = total -
 *  deposit. The shop charges no VAT and gives no discounts. */
export function computeOrderTotals(input: OrderMoneyInput) {
  const sellingPrice = input.listedPrice
  const total = sellingPrice + (input.deliveryCoveredByShop ? 0 : input.deliveryFee ?? 0)
  const remainingBalance = Math.max(total - (input.deposit ?? 0), 0)
  return { sellingPrice, total, remainingBalance }
}

