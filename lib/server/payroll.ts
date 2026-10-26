import type { Prisma } from '@prisma/client'
import db from './db'
import { ApiError } from './api-error'
import { audit, type AuditActor } from './audit'
import { closeOpenShifts, getShopSettings, parseHolidays } from './attendance'
import { parseVnMonth, vnDateKey } from './vn-time'

// Monthly payroll. The system pre-fills a draft from facts recorded during the
// month (shifts, products made, orders sold); a manager adjusts it
// and locks it once the month is over. Defaults, all editable per person:
//
// - regular hours = the part of each shift inside opening hours; time outside
//   them is overtime, PENDING until a manager marks the day OT, REGULAR or
//   EXCLUDE. Less than 15 minutes at either end of a shift is ignored;
// - a "ca gấp" (RUSH) day is paid entirely as overtime;
// - a shift nobody checked out of counts 0 hours until it is corrected;
// - an ONLINE shift (sales working from home) is paid at the online hourly
//   rate for all its hours: no overtime, no holiday rate;
// - MONTHLY pay = base salary x days worked / (days in month - paid days off),
//   at most the full salary;
//   HOURLY pay = hourly rate x regular hours, at the holiday rate on public
//   holidays (Settings); overtime = rate x OT multiplier x OT hours;
// - making commission = rate% of each completed product's price (before VAT);
//   it goes in full to whoever the product's task is assigned to;
// - sales commission = rate% of the listed price of each order created that
//   month where the person is the salesperson (defaults to the creator);
// - cancelled orders never earn commission;
// - free-form adjustments (bonus, deduction, advance...).

export const OT_DECISIONS = ['PENDING', 'OT', 'REGULAR', 'EXCLUDE', 'NONE', 'RUSH'] as const
export type OtDecision = (typeof OT_DECISIONS)[number]
/** Time outside opening hours shorter than this, at either end of a shift, is ignored. */
export const OT_GRACE_HOURS = 0.25

export type ShiftItem = {
  date: string
  checkIn: string | null
  checkOut: string | null
  hours: number
  regularHours: number
  otHours: number
  otDecision: OtDecision
  /** Nobody checked out: counts 0 hours until the shift is corrected. */
  autoClosed: boolean
  /** Entered or fixed by hand (forgotten check-in/out). */
  corrected?: boolean
  /** A public holiday from Settings. */
  holiday?: boolean
  /** ONLINE = sales working from home; missing on older drafts = SHOP. */
  mode?: 'SHOP' | 'ONLINE'
}

/** Decisions and previous values are matched per day and mode. */
export const shiftKey = (s: Pick<ShiftItem, 'date' | 'mode'>) => `${s.date}:${s.mode ?? 'SHOP'}`

export type CommissionKind = 'MAKER' | 'SALES'
export type CommissionItem = {
  key: string
  kind: CommissionKind
  orderId: string | null
  orderCode: string | null
  label: string
  base: number
  rate: number
  included: boolean
}

export type Adjustment = { label: string; amount: number }

type LineRow = Prisma.PayrollLineGetPayload<object>
type LineRates = Pick<LineRow, 'payType' | 'baseSalary' | 'hourlyRate' | 'makerRate' | 'salesRate' | 'holidayHourlyRate' | 'onlineHourlyRate' | 'daysOffPerMonth'>

const round2 = (n: number) => Math.round(n * 100) / 100
const hoursBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3_600_000)
const atVnTime = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`)

export const daysInMonth = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Totals for one line in a month under the payroll's OT multiplier. PENDING
 *  overtime is counted as OT in the estimate until a manager decides. */
export function computeLine(
  line: Pick<LineRates, 'payType' | 'baseSalary' | 'hourlyRate'> &
    Partial<Pick<LineRates, 'holidayHourlyRate' | 'onlineHourlyRate' | 'daysOffPerMonth'>> & {
      shifts: unknown
      commissions: unknown
      adjustments: unknown
    },
  otMultiplier: number,
  monthKey: string,
) {
  const shifts = line.shifts as ShiftItem[]
  const commissions = line.commissions as CommissionItem[]
  const adjustments = line.adjustments as Adjustment[]
  const monthly = line.payType === 'MONTHLY'
  // Holidays change the rate of hourly staff only; monthly staff are paid as usual.
  const rateFor = (s: ShiftItem) =>
    !monthly && s.holiday && line.holidayHourlyRate != null ? line.holidayHourlyRate : line.hourlyRate

  let regularHours = 0
  let otHours = 0
  let rushHours = 0
  let holidayHours = 0
  let onlineHours = 0
  let hourlyPay = 0
  let otPay = 0
  const workedDays = new Set<string>()
  for (const s of shifts) {
    if (s.mode === 'ONLINE') {
      // Every online hour at the online rate: no overtime, no holiday rate.
      onlineHours += s.hours
      regularHours += s.hours
      hourlyPay += s.hours * (line.onlineHourlyRate ?? line.hourlyRate)
      if (s.hours > 0) workedDays.add(s.date)
      continue
    }
    const rate = rateFor(s)
    if (s.otDecision === 'RUSH') {
      rushHours += s.hours
      otPay += s.hours * rate * otMultiplier
      continue
    }
    const regular = s.regularHours + (s.otDecision === 'REGULAR' ? s.otHours : 0)
    const ot = s.otDecision === 'OT' || s.otDecision === 'PENDING' ? s.otHours : 0
    regularHours += regular
    otHours += ot
    if (s.holiday && !monthly && line.holidayHourlyRate != null) holidayHours += regular
    hourlyPay += regular * rate
    otPay += ot * rate * otMultiplier
    if (s.hours > 0) workedDays.add(s.date)
  }
  const daysWorked = workedDays.size

  const standardDays = Math.max(1, daysInMonth(monthKey) - (line.daysOffPerMonth ?? 0))
  // Working more days than the standard does not pay more than the full salary.
  const basePay = monthly ? Math.round((line.baseSalary * Math.min(daysWorked, standardDays)) / standardDays) : Math.round(hourlyPay)
  const commissionByKind: Record<CommissionKind, number> = { MAKER: 0, SALES: 0 }
  for (const item of commissions) {
    // Unknown kinds (e.g. the retired REFERRAL in an old draft) are ignored.
    if (item.included && item.kind in commissionByKind) commissionByKind[item.kind] += Math.round((item.base * item.rate) / 100)
  }
  const commission = commissionByKind.MAKER + commissionByKind.SALES
  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0)
  const roundedOtPay = Math.round(otPay)

  return {
    regularHours: round2(regularHours),
    otHours: round2(otHours),
    rushHours: round2(rushHours),
    holidayHours: round2(holidayHours),
    onlineHours: round2(onlineHours),
    pendingOtDays: shifts.filter((s) => s.otDecision === 'PENDING').length,
    autoClosedDays: shifts.filter((s) => s.autoClosed).length,
    daysWorked,
    standardDays,
    basePay,
    otPay: roundedOtPay,
    commissionByKind,
    commission,
    adjustmentsTotal,
    total: basePay + roundedOtPay + commission + adjustmentsTotal,
  }
}

/** Hours of [start, end] that fall within [from, to]. */
const overlap = (start: Date, end: Date, from: Date, to: Date) =>
  hoursBetween(new Date(Math.max(start.getTime(), from.getTime())), new Date(Math.min(end.getTime(), to.getTime())))

/** Facts for the month, itemised per person. */
async function collectFacts(month: { key: string; start: Date; end: Date }) {
  const settings = await getShopSettings()
  const holidays = new Set(parseHolidays(settings.holidays).map((h) => h.date))
  const firstDay = `${month.key}-01`
  const lastDay = `${month.key}-${String(daysInMonth(month.key)).padStart(2, '0')}`
  const inMonth = { gte: month.start, lt: month.end }

  const [users, shifts, tasks, orders] = await Promise.all([
    db.user.findMany(),
    db.staffCheckIn.findMany({
      where: { workDate: { gte: firstDay, lte: lastDay }, checkOutAt: { not: null } },
      orderBy: { workDate: 'asc' },
    }),
    db.task.findMany({
      where: { status: 'COMPLETED', completedAt: inMonth, assigneeId: { not: null } },
      include: { order: { select: { id: true, code: true, status: true, listedPrice: true, tasks: { select: { price: true } } } } },
    }),
    db.order.findMany({
      where: { createdAt: inMonth, status: { not: 'CANCELLED' } },
      select: { id: true, code: true, listedPrice: true, createdById: true, salespersonId: true, customerName: true },
    }),
  ])

  const shiftsByUser = new Map<string, ShiftItem[]>()
  for (const s of shifts) {
    const checkIn = s.checkInAt ?? s.timestamp
    const checkOut = s.checkOutAt!
    let hours = 0
    let regular = 0
    let ot = 0
    const online = s.workMode === 'ONLINE'
    if (!s.autoClosed && online) {
      hours = round2(hoursBetween(checkIn, checkOut))
      regular = hours
    } else if (!s.autoClosed) {
      const open = atVnTime(s.workDate, settings.openTime)
      const close = atVnTime(s.workDate, settings.closeTime)
      hours = round2(hoursBetween(checkIn, checkOut))
      regular = round2(overlap(checkIn, checkOut, open, close))
      // A shift may run past midnight; everything after closing is overtime.
      const before = checkIn < open ? hoursBetween(checkIn, new Date(Math.min(checkOut.getTime(), open.getTime()))) : 0
      const after = checkOut > close ? hoursBetween(new Date(Math.max(checkIn.getTime(), close.getTime())), checkOut) : 0
      ot = round2((before >= OT_GRACE_HOURS ? before : 0) + (after >= OT_GRACE_HOURS ? after : 0))
    }
    const list = shiftsByUser.get(s.staffId) ?? []
    list.push({
      date: s.workDate,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      hours,
      regularHours: regular,
      otHours: ot,
      otDecision: ot > 0 ? 'PENDING' : 'NONE',
      autoClosed: s.autoClosed,
      corrected: s.correctedAt !== null,
      holiday: holidays.has(s.workDate),
      mode: online ? 'ONLINE' : 'SHOP',
    })
    shiftsByUser.set(s.staffId, list)
  }

  const commissionsByUser = new Map<string, Omit<CommissionItem, 'rate' | 'included'>[]>()
  const push = (userId: string, item: Omit<CommissionItem, 'rate' | 'included'>) => {
    const list = commissionsByUser.get(userId) ?? []
    list.push(item)
    commissionsByUser.set(userId, list)
  }

  for (const task of tasks) {
    if (task.order?.status === 'CANCELLED') continue
    let base: number
    if (task.price !== null) {
      base = task.price
    } else if (task.order && task.order.tasks.every((t) => t.price === null)) {
      // Orders from before per-product prices: split the order evenly.
      base = Math.round(task.order.listedPrice / Math.max(task.order.tasks.length, 1))
    } else {
      // Added by hand without a price (e.g. "in thiệp"): no commission, so it
      // cannot inflate the order's value.
      base = 0
    }
    push(task.assigneeId!, {
      key: `MAKER:${task.id}`,
      kind: 'MAKER',
      orderId: task.order?.id ?? null,
      orderCode: task.order?.code ?? task.orderCode ?? null,
      label: task.taskTitle,
      base: Math.max(base, 0),
    })
  }

  for (const order of orders) {
    const salesperson = order.salespersonId ?? order.createdById
    if (salesperson) {
      push(salesperson, {
        key: `SALES:${order.id}`,
        kind: 'SALES',
        orderId: order.id,
        orderCode: order.code,
        label: order.customerName || 'Chưa có tên khách',
        base: order.listedPrice,
      })
    }
  }

  return { settings, users, shiftsByUser, commissionsByUser }
}

const rateFor = (line: { makerRate: number; salesRate: number }, kind: CommissionKind) =>
  kind === 'MAKER' ? line.makerRate : line.salesRate

type ProfileUser = Prisma.UserGetPayload<object>
/** The month's rates from a person's pay profile. */
const profileRates = (user: ProfileUser) => ({
  payType: user.payType,
  baseSalary: user.baseSalary ?? 0,
  hourlyRate: user.hourlyRate,
  makerRate: user.commissionRate ?? 0,
  salesRate: user.salesCommissionRate,
  // Sales get no holiday rate.
  holidayHourlyRate: user.role === 'sales' ? null : user.holidayHourlyRate,
  onlineHourlyRate: user.role === 'sales' ? user.onlineHourlyRate : null,
  daysOffPerMonth: user.daysOffPerMonth,
})

/** Create the month's draft, or refresh an existing draft with the latest
 *  shifts and orders while keeping every manual change: this month's rates
 *  when a manager set them (otherwise the pay profile is re-read), OT
 *  decisions (for shifts whose times did not change), commission items
 *  switched off or re-rated, and adjustments. Locked payrolls are never touched. */
export async function generatePayroll(monthKey: string, actor: AuditActor) {
  const month = parseVnMonth(monthKey)
  if (!month) throw new ApiError(400, 'Tháng không hợp lệ')

  const existing = await db.payroll.findUnique({ where: { month: month.key }, include: { lines: true } })
  if (existing?.status === 'LOCKED') throw new ApiError(409, 'Bảng lương tháng này đã chốt. Mở khoá trước khi cập nhật.')

  const { settings, users, shiftsByUser, commissionsByUser } = await collectFacts(month)
  const payroll =
    existing ??
    (await db.payroll.create({ data: { month: month.key, otMultiplier: settings.otMultiplier }, include: { lines: true } }))
  const previous = new Map(existing?.lines.map((line) => [line.userId, line]) ?? [])

  for (const user of users) {
    const before = previous.get(user.id)
    const hasActivity = shiftsByUser.has(user.id) || commissionsByUser.has(user.id)
    if (!before && !hasActivity && user.status !== 'active') continue

    const rates = before?.ratesOverridden
      ? {
          payType: before.payType,
          baseSalary: before.baseSalary,
          hourlyRate: before.hourlyRate,
          makerRate: before.makerRate,
          salesRate: before.salesRate,
          holidayHourlyRate: before.holidayHourlyRate,
          onlineHourlyRate: before.onlineHourlyRate,
          daysOffPerMonth: before.daysOffPerMonth,
        }
      : profileRates(user)

    // A decision is kept only for the same shift times: an edited shift is reviewed again.
    const oldShifts = new Map(((before?.shifts as ShiftItem[] | undefined) ?? []).map((s) => [shiftKey(s), s]))
    const shifts = (shiftsByUser.get(user.id) ?? []).map((s) => {
      const old = oldShifts.get(shiftKey(s))
      if (!old || old.checkIn !== s.checkIn || old.checkOut !== s.checkOut) return s
      if (old.otDecision === 'RUSH') return { ...s, otDecision: old.otDecision }
      if (s.otHours > 0 && ['OT', 'REGULAR', 'EXCLUDE'].includes(old.otDecision)) return { ...s, otDecision: old.otDecision }
      return s
    })

    const oldItems = new Map(((before?.commissions as CommissionItem[] | undefined) ?? []).map((c) => [c.key, c]))
    const commissions: CommissionItem[] = (commissionsByUser.get(user.id) ?? []).map((item) => {
      const kept = oldItems.get(item.key)
      return { ...item, rate: kept?.rate ?? rateFor(rates, item.kind), included: kept?.included ?? true }
    })

    const data = {
      userName: user.name,
      role: user.role,
      ...rates,
      shifts: shifts as unknown as Prisma.InputJsonValue,
      commissions: commissions as unknown as Prisma.InputJsonValue,
    }
    const total = computeLine({ ...data, adjustments: before?.adjustments ?? [] }, payroll.otMultiplier, month.key).total
    if (before) {
      await db.payrollLine.update({ where: { id: before.id }, data: { ...data, total } })
    } else {
      await db.payrollLine.create({ data: { ...data, payrollId: payroll.id, userId: user.id, total } })
    }
  }

  // "Cập nhật lần cuối" on the payroll page.
  await db.payroll.update({ where: { id: payroll.id }, data: { updatedAt: new Date() } })
  await audit(actor, {
    action: existing ? 'payroll.refresh' : 'payroll.create',
    entity: 'payroll',
    entityId: payroll.id,
    summary: `Bảng lương ${month.key}`,
  })
  return getPayroll(month.key)
}

/** Payroll months an order's commissions fall in: the month it was created
 *  (sales commission) and the months its products were completed (making
 *  commission). Read before the order is cancelled or deleted. */
export async function payrollMonthsForOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { createdAt: true, tasks: { where: { completedAt: { not: null } }, select: { completedAt: true } } },
  })
  if (!order) return []
  const dates = [order.createdAt, ...order.tasks.map((t) => t.completedAt!)]
  return [...new Set(dates.map((d) => vnDateKey(d).slice(0, 7)))]
}

/** After an order is cancelled, restored or deleted: refresh those months'
 *  draft payrolls (manual edits are kept). Locked payrolls are left as locked;
 *  their months are returned so the caller can say so. */
export async function refreshPayrollsFor(months: string[], actor: AuditActor) {
  const payrolls = await db.payroll.findMany({ where: { month: { in: months } } })
  const locked: string[] = []
  for (const payroll of payrolls) {
    if (payroll.status === 'LOCKED') locked.push(payroll.month)
    else await generatePayroll(payroll.month, actor)
  }
  return { lockedMonths: locked }
}

/** Refuse a change that would alter pay already locked for `date`'s month. */
export async function assertPayrollOpen(date: Date, what: string) {
  const month = vnDateKey(date).slice(0, 7)
  const payroll = await db.payroll.findUnique({ where: { month }, select: { status: true } })
  if (payroll?.status === 'LOCKED') {
    throw new ApiError(409, `${what} đã tính vào bảng lương tháng ${month.slice(5)}/${month.slice(0, 4)} đã chốt. Quản lý cần mở khoá bảng lương trước.`)
  }
}

/** The month's payroll with computed totals, or null if not created yet. */
export async function getPayroll(monthKey: string) {
  const payroll = await db.payroll.findUnique({
    where: { month: monthKey },
    include: { lines: { orderBy: { userName: 'asc' } } },
  })
  if (!payroll) return null
  const lines = payroll.lines.map((line) => ({ ...line, totals: computeLine(line, payroll.otMultiplier, payroll.month) }))
  return {
    ...payroll,
    createdAt: payroll.createdAt.toISOString(),
    updatedAt: payroll.updatedAt.toISOString(),
    lockedAt: payroll.lockedAt?.toISOString() ?? null,
    lines,
    summary: {
      total: lines.reduce((sum, l) => sum + l.totals.total, 0),
      pendingOtDays: lines.reduce((sum, l) => sum + l.totals.pendingOtDays, 0),
      autoClosedDays: lines.reduce((sum, l) => sum + l.totals.autoClosedDays, 0),
    },
  }
}

/** A staff member's own pay for a month ("Thu nhập"). Once the payroll is
 *  locked it is exactly the locked line. Before that it is an estimate from
 *  their pay profile and the month's facts so far: overtime awaiting review
 *  counts as OT (as in the manager's draft), and the manager's draft edits and
 *  adjustments stay private until the payroll is locked. */
export async function getMyPay(userId: string, monthKey: string) {
  const month = parseVnMonth(monthKey)
  if (!month) throw new ApiError(400, 'Tháng không hợp lệ')
  if (month.start > new Date()) throw new ApiError(400, 'Tháng chưa bắt đầu')

  const payroll = await db.payroll.findUnique({ where: { month: month.key }, include: { lines: { where: { userId } } } })
  if (payroll?.status === 'LOCKED') {
    const line = payroll.lines[0]
    return {
      month: month.key,
      status: 'LOCKED' as const,
      lockedAt: payroll.lockedAt?.toISOString() ?? null,
      otMultiplier: payroll.otMultiplier,
      line: line ? { ...line, totals: computeLine(line, payroll.otMultiplier, month.key) } : null,
    }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new ApiError(404, 'Không tìm thấy nhân viên')
  const { settings, shiftsByUser, commissionsByUser } = await collectFacts(month)
  const rates = profileRates(user)
  const line = {
    id: null,
    userId,
    userName: user.name,
    role: user.role,
    ...rates,
    shifts: shiftsByUser.get(userId) ?? [],
    commissions: (commissionsByUser.get(userId) ?? []).map((item) => ({ ...item, rate: rateFor(rates, item.kind), included: true })),
    adjustments: [] as Adjustment[],
    note: null,
  }
  const otMultiplier = payroll?.otMultiplier ?? settings.otMultiplier
  return {
    month: month.key,
    status: 'ESTIMATE' as const,
    lockedAt: null,
    otMultiplier,
    line: { ...line, totals: computeLine(line, otMultiplier, month.key) },
  }
}

async function draftOf(payrollId: string) {
  const payroll = await db.payroll.findUnique({ where: { id: payrollId } })
  if (!payroll) throw new ApiError(404, 'Không tìm thấy bảng lương')
  if (payroll.status === 'LOCKED') throw new ApiError(409, 'Bảng lương đã chốt. Mở khoá để sửa.')
  return payroll
}

const asRate = (value: unknown, field: string) => {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) throw new ApiError(400, `${field} phải từ 0 đến 100`)
  return n
}
const asMoney = (value: unknown, field: string, { allowNegative = false } = {}) => {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d-]/g, '')) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || (!allowNegative && n < 0) || Math.abs(n) > 2_000_000_000) {
    throw new ApiError(400, `${field} không hợp lệ`)
  }
  return Math.round(n)
}

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/** Edit one person's line: this month's pay type/rates, the decision for each
 *  shift (overtime, "ca gấp"), which commission items count and at what rate,
 *  adjustments and a note. */
export async function updatePayrollLine(lineId: string, body: Record<string, unknown>, actor: AuditActor) {
  const line = await db.payrollLine.findUnique({ where: { id: lineId } })
  if (!line) throw new ApiError(404, 'Không tìm thấy dòng lương')
  const payroll = await draftOf(line.payrollId)

  const next = {
    payType: line.payType,
    baseSalary: line.baseSalary,
    hourlyRate: line.hourlyRate,
    makerRate: line.makerRate,
    salesRate: line.salesRate,
    holidayHourlyRate: line.holidayHourlyRate,
    onlineHourlyRate: line.onlineHourlyRate,
    daysOffPerMonth: line.daysOffPerMonth,
    ratesOverridden: line.ratesOverridden,
    shifts: line.shifts as ShiftItem[],
    commissions: line.commissions as CommissionItem[],
    adjustments: line.adjustments as Adjustment[],
    note: line.note,
  }

  if (body.payType !== undefined) {
    if (body.payType !== 'MONTHLY' && body.payType !== 'HOURLY') throw new ApiError(400, 'Hình thức lương không hợp lệ')
    next.payType = body.payType
  }
  if (body.baseSalary !== undefined) next.baseSalary = asMoney(body.baseSalary, 'Lương cứng')
  if (body.hourlyRate !== undefined) next.hourlyRate = asMoney(body.hourlyRate, 'Đơn giá giờ')
  if (body.holidayHourlyRate !== undefined) {
    next.holidayHourlyRate = body.holidayHourlyRate === null || body.holidayHourlyRate === '' ? null : asMoney(body.holidayHourlyRate, 'Đơn giá giờ ngày lễ')
  }
  if (body.onlineHourlyRate !== undefined) {
    next.onlineHourlyRate = body.onlineHourlyRate === null || body.onlineHourlyRate === '' ? null : asMoney(body.onlineHourlyRate, 'Đơn giá giờ online')
  }
  if (body.daysOffPerMonth !== undefined) {
    const n = Number(body.daysOffPerMonth)
    if (!Number.isInteger(n) || n < 0 || n > 15) throw new ApiError(400, 'Số ngày nghỉ phải từ 0 đến 15')
    next.daysOffPerMonth = n
  }

  // A new line rate applies to every item of that kind (overriding per-item rates).
  for (const [field, kind] of [['makerRate', 'MAKER'], ['salesRate', 'SALES']] as const) {
    if (body[field] === undefined) continue
    const rate = asRate(body[field], field === 'makerRate' ? 'Hoa hồng làm đơn' : 'Hoa hồng sale')
    next[field] = rate
    next.commissions = next.commissions.map((c) => (c.kind === kind ? { ...c, rate } : c))
  }
  // Rates set by hand for this month are kept on refresh instead of re-reading the profile.
  if (['payType', 'baseSalary', 'hourlyRate', 'holidayHourlyRate', 'onlineHourlyRate', 'daysOffPerMonth', 'makerRate', 'salesRate'].some((f) => body[f] !== undefined)) {
    next.ratesOverridden = true
  }

  if (Array.isArray(body.shiftDecisions)) {
    const decisions = new Map<string, OtDecision>()
    for (const d of body.shiftDecisions as { date?: unknown; otDecision?: unknown }[]) {
      if (typeof d?.date !== 'string' || !OT_DECISIONS.includes(d.otDecision as OtDecision)) throw new ApiError(400, 'Quyết định OT không hợp lệ')
      decisions.set(d.date, d.otDecision as OtDecision)
    }
    next.shifts = next.shifts.map((s) => {
      // Online shifts have no overtime decisions.
      const d = s.mode === 'ONLINE' ? undefined : decisions.get(s.date)
      if (!d || d === s.otDecision) return s
      const hasOt = s.otHours > 0.01
      const ok =
        (d === 'RUSH' && s.hours > 0) ||
        (d === 'NONE' && !hasOt) ||
        (d === 'PENDING' && hasOt) ||
        (hasOt && (d === 'OT' || d === 'EXCLUDE')) ||
        (hasOt && d === 'REGULAR' && next.payType === 'HOURLY')
      if (!ok) throw new ApiError(400, `Không áp dụng được lựa chọn này cho ngày ${dayLabel(s.date)}`)
      return { ...s, otDecision: d }
    })
  }

  if (Array.isArray(body.commissionChanges)) {
    const changes = new Map<string, { included?: unknown; rate?: unknown }>()
    for (const c of body.commissionChanges as { key?: unknown }[]) {
      if (typeof c?.key === 'string') changes.set(c.key, c as { included?: unknown; rate?: unknown })
    }
    next.commissions = next.commissions.map((item) => {
      const change = changes.get(item.key)
      if (!change) return item
      return {
        ...item,
        included: change.included === undefined ? item.included : change.included === true,
        rate: change.rate === undefined ? item.rate : asRate(change.rate, 'Tỉ lệ hoa hồng'),
      }
    })
  }

  if (body.adjustments !== undefined) {
    if (!Array.isArray(body.adjustments)) throw new ApiError(400, 'Danh sách điều chỉnh không hợp lệ')
    next.adjustments = (body.adjustments as { label?: unknown; amount?: unknown }[]).map((a, i) => {
      if (typeof a?.label !== 'string' || !a.label.trim()) throw new ApiError(400, `Khoản điều chỉnh ${i + 1}: thiếu nội dung`)
      return { label: a.label.trim().slice(0, 200), amount: asMoney(a.amount, `Khoản điều chỉnh ${i + 1}`, { allowNegative: true }) }
    })
  }
  if (body.note !== undefined) next.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null

  const total = computeLine(next, payroll.otMultiplier, payroll.month).total
  await db.payrollLine.update({
    where: { id: lineId },
    data: {
      ...next,
      shifts: next.shifts as unknown as Prisma.InputJsonValue,
      commissions: next.commissions as unknown as Prisma.InputJsonValue,
      adjustments: next.adjustments as unknown as Prisma.InputJsonValue,
      total,
    },
  })
  await audit(actor, {
    action: 'payroll.line_update',
    entity: 'payroll',
    entityId: payroll.id,
    summary: `${line.userName} ${payroll.month}: ${line.total.toLocaleString('vi-VN')} → ${total.toLocaleString('vi-VN')} ₫`,
  })
  return getPayroll(payroll.month)
}

/** Change the month's formula settings (currently the OT multiplier). */
export async function updatePayrollSettings(payrollId: string, body: Record<string, unknown>, actor: AuditActor) {
  const payroll = await draftOf(payrollId)
  const n = typeof body.otMultiplier === 'string' ? Number(body.otMultiplier) : body.otMultiplier
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 5) throw new ApiError(400, 'Hệ số OT phải từ 1 đến 5')
  await db.payroll.update({ where: { id: payrollId }, data: { otMultiplier: n } })
  const lines = await db.payrollLine.findMany({ where: { payrollId } })
  for (const line of lines) {
    await db.payrollLine.update({ where: { id: line.id }, data: { total: computeLine(line, n, payroll.month).total } })
  }
  await audit(actor, {
    action: 'payroll.settings',
    entity: 'payroll',
    entityId: payrollId,
    summary: `Bảng lương ${payroll.month}`,
    changes: { otMultiplier: [payroll.otMultiplier, n] },
  })
  return getPayroll(payroll.month)
}

/** Lock: no further edits, and later changes to shifts or orders no longer
 *  affect it. Only once the month is over (pay goes out on the 5th), and it
 *  first refreshes the draft so the whole month is in it; every OT day must
 *  have been reviewed. */
export async function lockPayroll(payrollId: string, actor: AuditActor) {
  const payroll = await draftOf(payrollId)
  const month = parseVnMonth(payroll.month)!
  if (new Date() < month.end) {
    const from = vnDateKey(month.end)
    throw new ApiError(409, `Chỉ chốt được khi đã hết tháng (từ ngày ${from.slice(8, 10)}/${from.slice(5, 7)}/${from.slice(0, 4)}).`)
  }
  await closeOpenShifts()
  const current = (await generatePayroll(payroll.month, actor))!
  const pending = current.lines.filter((l) => l.totals.pendingOtDays > 0)
  if (pending.length) {
    throw new ApiError(409, `Còn ngày OT chưa duyệt: ${pending.map((l) => `${l.userName} (${l.totals.pendingOtDays})`).join(', ')}`)
  }
  await db.payroll.update({
    where: { id: payrollId },
    data: { status: 'LOCKED', lockedAt: new Date(), lockedByName: actor?.name ?? null },
  })
  await audit(actor, {
    action: 'payroll.lock',
    entity: 'payroll',
    entityId: payrollId,
    summary: `Chốt bảng lương ${payroll.month}: ${current.summary.total.toLocaleString('vi-VN')} ₫`,
  })
  return getPayroll(payroll.month)
}

export async function unlockPayroll(payrollId: string, actor: AuditActor) {
  const payroll = await db.payroll.findUnique({ where: { id: payrollId } })
  if (!payroll) throw new ApiError(404, 'Không tìm thấy bảng lương')
  await db.payroll.update({ where: { id: payrollId }, data: { status: 'DRAFT', lockedAt: null, lockedByName: null } })
  await audit(actor, { action: 'payroll.unlock', entity: 'payroll', entityId: payrollId, summary: `Mở khoá bảng lương ${payroll.month}` })
  return getPayroll(payroll.month)
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  // Excel runs text starting with = + - @ as a formula; numbers are left alone.
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Spreadsheet export (UTF-8 with BOM so Excel shows Vietnamese correctly):
 *  a summary row per person, then their itemised commissions and adjustments. */
export async function exportPayrollCsv(monthKey: string) {
  const payroll = await getPayroll(monthKey)
  if (!payroll) throw new ApiError(404, 'Chưa có bảng lương tháng này')
  const kindLabel: Record<CommissionKind, string> = { MAKER: 'HH làm đơn', SALES: 'HH sale' }
  const rows: unknown[][] = [
    [`Bảng lương ${payroll.month}`, payroll.status === 'LOCKED' ? `Đã chốt bởi ${payroll.lockedByName ?? ''}` : 'Nháp', `Hệ số OT ${payroll.otMultiplier}`],
    [],
    ['Nhân viên', 'Hình thức', 'Ngày công', 'Giờ thường', 'Giờ OT', 'Giờ ca gấp', 'Lương', 'Tiền OT', 'HH làm đơn', 'HH sale', 'Điều chỉnh', 'Tổng', 'Ghi chú'],
  ]
  for (const line of payroll.lines) {
    const t = line.totals
    rows.push([
      line.userName,
      line.payType === 'MONTHLY' ? 'Lương cứng' : 'Theo giờ',
      line.payType === 'MONTHLY' ? `${t.daysWorked}/${t.standardDays}` : t.daysWorked,
      t.regularHours,
      t.otHours,
      t.rushHours,
      t.basePay,
      t.otPay,
      t.commissionByKind.MAKER,
      t.commissionByKind.SALES,
      t.adjustmentsTotal,
      t.total,
      line.note ?? '',
    ])
  }
  rows.push([], ['Chi tiết'], ['Nhân viên', 'Loại', 'Đơn', 'Nội dung', 'Cơ sở tính', '%', 'Thành tiền', 'Tính'])
  for (const line of payroll.lines) {
    for (const c of line.commissions as CommissionItem[]) {
      rows.push([line.userName, kindLabel[c.kind], c.orderCode ?? '', c.label, c.base, c.rate, Math.round((c.base * c.rate) / 100), c.included ? 'Có' : 'Không'])
    }
    for (const a of line.adjustments as Adjustment[]) {
      rows.push([line.userName, 'Điều chỉnh', '', a.label, '', '', a.amount, 'Có'])
    }
  }
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
