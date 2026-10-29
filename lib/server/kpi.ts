import db from './db'
import { ApiError } from './api-error'
import { vnDateKey } from './vn-time'

// Sales KPI: a bonus per shift (by default sáng 08-13, chiều 13-18, tối 18-23)
// from the money customers transferred, in that shift, for the orders the
// salesperson took in that same shift while at work (checked in, at the shop
// or online). Money paid for an order in a later shift (the rest of a deposit)
// earns only the sales commission, not KPI. Of each transfer only the flowers
// count: payments go to the flowers first, then to VAT and delivery. Only the
// highest tier reached is paid. Florists get no KPI.

export type KpiShift = { name: string; start: string; end: string }
export type KpiTier = { revenue: number; bonus: number }

export const DEFAULT_KPI_SHIFTS: KpiShift[] = [
  { name: 'Ca sáng', start: '08:00', end: '13:00' },
  { name: 'Ca chiều', start: '13:00', end: '18:00' },
  { name: 'Ca tối', start: '18:00', end: '23:00' },
]
export const DEFAULT_KPI_TIERS: KpiTier[] = [
  { revenue: 5_000_000, bonus: 100_000 },
  { revenue: 6_500_000, bonus: 250_000 },
  { revenue: 10_000_000, bonus: 500_000 },
]

/** One shift's bonus in a payroll line. */
export type KpiFact = {
  key: string
  date: string
  shift: string
  /** Flower money paid in the shift for the person's orders. */
  revenue: number
  bonus: number
  /** Number of payments counted. */
  payments: number
}
export type KpiItem = KpiFact & { included: boolean }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Shifts from Settings; '' or anything unreadable = the defaults. */
export function parseKpiShifts(value: string | null | undefined): KpiShift[] {
  try {
    return value ? readKpiShifts(JSON.parse(value)) : DEFAULT_KPI_SHIFTS
  } catch {
    return DEFAULT_KPI_SHIFTS
  }
}

export function parseKpiTiers(value: string | null | undefined): KpiTier[] {
  try {
    return value ? readKpiTiers(JSON.parse(value)) : DEFAULT_KPI_TIERS
  } catch {
    return DEFAULT_KPI_TIERS
  }
}

/** Shifts sent by a manager: 1 to 6, named, within one day, not overlapping. */
export function readKpiShifts(value: unknown): KpiShift[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) throw new ApiError(400, 'Cần từ 1 đến 6 ca')
  const shifts = value.map((raw, i) => {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 40) : ''
    if (!name) throw new ApiError(400, `Ca ${i + 1}: thiếu tên ca`)
    if (typeof raw?.start !== 'string' || !TIME.test(raw.start) || typeof raw?.end !== 'string' || !TIME.test(raw.end)) {
      throw new ApiError(400, `${name}: giờ phải có dạng HH:mm`)
    }
    if (raw.end <= raw.start) throw new ApiError(400, `${name}: giờ kết thúc phải sau giờ bắt đầu`)
    return { name, start: raw.start as string, end: raw.end as string }
  })
  const sorted = [...shifts].sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) throw new ApiError(400, `${sorted[i - 1].name} và ${sorted[i].name} bị trùng giờ`)
  }
  if (new Set(shifts.map((s) => s.name)).size !== shifts.length) throw new ApiError(400, 'Tên các ca phải khác nhau')
  return sorted
}

/** Tiers sent by a manager: up to 10, each a revenue threshold and its bonus. */
export function readKpiTiers(value: unknown): KpiTier[] {
  if (!Array.isArray(value) || value.length > 10) throw new ApiError(400, 'Danh sách mức KPI không hợp lệ')
  const tiers = value.map((raw, i) => {
    const revenue = Number(raw?.revenue)
    const bonus = Number(raw?.bonus)
    if (!Number.isInteger(revenue) || revenue <= 0 || revenue > 2_000_000_000) throw new ApiError(400, `Mức ${i + 1}: doanh thu không hợp lệ`)
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > 100_000_000) throw new ApiError(400, `Mức ${i + 1}: tiền thưởng không hợp lệ`)
    return { revenue, bonus }
  })
  const sorted = tiers.sort((a, b) => a.revenue - b.revenue)
  if (new Set(sorted.map((t) => t.revenue)).size !== sorted.length) throw new ApiError(400, 'Hai mức KPI trùng doanh thu')
  return sorted
}

/** The bonus for a shift's revenue: the highest tier reached, 0 below the first. */
export const kpiBonus = (revenue: number, tiers: KpiTier[]) =>
  tiers.reduce((bonus, tier) => (revenue >= tier.revenue ? tier.bonus : bonus), 0)

/** "HH:mm" of an instant, Vietnam time. */
const vnTime = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(11, 16)

/** Each salesperson's KPI bonuses for the month, by shift (only shifts that
 *  reached a tier). */
export async function collectKpi(
  month: { key: string; start: Date; end: Date },
  settings: { kpiShifts: string; kpiTiers: string },
): Promise<Map<string, KpiFact[]>> {
  const result = new Map<string, KpiFact[]>()
  const shifts = parseKpiShifts(settings.kpiShifts)
  const tiers = parseKpiTiers(settings.kpiTiers)
  if (!tiers.length) return result

  const inMonth = (at: Date) => at >= month.start && at < month.end
  const paid = await db.orderPayment.findMany({ where: { paidAt: { gte: month.start, lt: month.end } }, select: { orderId: true } })
  if (!paid.length) return result
  // Earlier payments (even last month's) decide how much of a payment is flowers.
  const orders = await db.order.findMany({
    where: { id: { in: [...new Set(paid.map((p) => p.orderId))] }, status: { not: 'CANCELLED' } },
    select: {
      createdAt: true,
      listedPrice: true,
      salespersonId: true,
      createdById: true,
      payments: { select: { amount: true, paidAt: true }, orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  // "YYYY-MM-DD|shift" an instant falls in, or null outside every shift.
  const shiftOf = (at: Date) => {
    const time = vnTime(at)
    const shift = shifts.find((s) => s.start <= time && time < s.end)
    return shift ? `${vnDateKey(at)}|${shift.name}` : null
  }

  const credits = new Map<string, { at: Date; amount: number }[]>()
  for (const order of orders) {
    const seller = order.salespersonId ?? order.createdById
    const taken = shiftOf(order.createdAt)
    if (!seller || !taken) continue
    let before = 0
    for (const payment of order.payments) {
      const flowers = Math.max(0, Math.min(payment.amount, order.listedPrice - before))
      before += payment.amount
      if (flowers > 0 && inMonth(payment.paidAt) && shiftOf(payment.paidAt) === taken) {
        const list = credits.get(seller) ?? []
        list.push({ at: payment.paidAt, amount: flowers })
        credits.set(seller, list)
      }
    }
  }
  if (!credits.size) return result

  const sellers = await db.user.findMany({ where: { id: { in: [...credits.keys()] }, role: 'sales' }, select: { id: true } })
  const sellerIds = sellers.map((s) => s.id)
  const lastDay = vnDateKey(new Date(month.end.getTime() - 1))
  const checkIns = await db.staffCheckIn.findMany({
    where: { staffId: { in: sellerIds }, workDate: { gte: `${month.key}-01`, lte: lastDay } },
    select: { staffId: true, checkInAt: true, timestamp: true, checkOutAt: true },
  })
  // At work = within a check-in; a shift still open counts until now.
  const atWork = (staffId: string, at: Date) =>
    checkIns.some((c) => c.staffId === staffId && (c.checkInAt ?? c.timestamp) <= at && (c.checkOutAt === null || c.checkOutAt >= at))

  for (const sellerId of sellerIds) {
    const byShift = new Map<string, KpiFact>()
    for (const credit of credits.get(sellerId)!) {
      const time = vnTime(credit.at)
      const shift = shifts.find((s) => s.start <= time && time < s.end)
      if (!shift || !atWork(sellerId, credit.at)) continue
      const date = vnDateKey(credit.at)
      const key = `KPI:${date}:${shift.name}`
      const fact = byShift.get(key) ?? { key, date, shift: shift.name, revenue: 0, bonus: 0, payments: 0 }
      fact.revenue += credit.amount
      fact.payments += 1
      byShift.set(key, fact)
    }
    const facts = [...byShift.values()]
      .map((f) => ({ ...f, bonus: kpiBonus(f.revenue, tiers) }))
      .filter((f) => f.bonus > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || shifts.findIndex((s) => s.name === a.shift) - shifts.findIndex((s) => s.name === b.shift))
    if (facts.length) result.set(sellerId, facts)
  }
  return result
}
