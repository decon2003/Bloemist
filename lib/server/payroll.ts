import type { Prisma } from '@prisma/client'
import db from './db'
import { ApiError } from './api-error'
import { audit, type AuditActor } from './audit'
import { getShopSettings } from './attendance'
import { parseVnMonth } from './vn-time'

// Monthly payroll. The system pre-fills a draft from facts recorded during the
// month (shifts, products made, orders sold); a manager adjusts it
// and locks it. Defaults, all editable per person and per item:
//
// - regular hours = the part of each shift inside opening hours; the rest is
//   overtime, PENDING until a manager marks the day OT, REGULAR or EXCLUDE;
// - pay = base salary (MONTHLY) or hourly rate x regular hours (HOURLY),
//   plus hourly rate x OT multiplier x OT hours;
// - maker commission = rate% of each completed product's price, net of its
//   share of the order discount, before VAT; it goes in full to whoever the
//   product's task was assigned to;
// - sales commission = rate% of (listed price - discount) of each order
//   created that month where the person is the salesperson (whoever brought
//   the order in; defaults to the creator);
// - cancelled orders never earn commission;
// - free-form adjustments (bonus, deduction, advance...).

export const OT_DECISIONS = ['PENDING', 'OT', 'REGULAR', 'EXCLUDE', 'NONE'] as const
export type OtDecision = (typeof OT_DECISIONS)[number]

export type ShiftItem = {
  date: string
  checkIn: string | null
  checkOut: string | null
  hours: number
  regularHours: number
  otHours: number
  otDecision: OtDecision
  autoClosed: boolean
}

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

const round2 = (n: number) => Math.round(n * 100) / 100
const hoursBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3_600_000)
const atVnTime = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`)
const orderBase = (o: { listedPrice: number; discount: number | null }) => Math.max(o.listedPrice - (o.discount ?? 0), 0)

/** Totals for one line under the payroll's OT multiplier. PENDING overtime is
 *  counted as OT in the estimate until a manager decides. */
export function computeLine(line: Pick<LineRow, 'payType' | 'baseSalary' | 'hourlyRate'> & {
  shifts: unknown
  commissions: unknown
  adjustments: unknown
}, otMultiplier: number) {
  const shifts = line.shifts as ShiftItem[]
  const commissions = line.commissions as CommissionItem[]
  const adjustments = line.adjustments as Adjustment[]

  const regularHours = round2(
    shifts.reduce((sum, s) => sum + s.regularHours + (s.otDecision === 'REGULAR' ? s.otHours : 0), 0),
  )
  const otHours = round2(shifts.reduce((sum, s) => sum + (s.otDecision === 'OT' || s.otDecision === 'PENDING' ? s.otHours : 0), 0))
  const pendingOtDays = shifts.filter((s) => s.otDecision === 'PENDING').length

  const basePay = line.payType === 'MONTHLY' ? line.baseSalary : Math.round(line.hourlyRate * regularHours)
  const otPay = Math.round(line.hourlyRate * otMultiplier * otHours)
  const commissionByKind: Record<CommissionKind, number> = { MAKER: 0, SALES: 0 }
  for (const item of commissions) {
    // Unknown kinds (e.g. the retired REFERRAL in an old draft) are ignored.
    if (item.included && item.kind in commissionByKind) commissionByKind[item.kind] += Math.round((item.base * item.rate) / 100)
  }
  const commission = commissionByKind.MAKER + commissionByKind.SALES
  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0)

  return {
    regularHours,
    otHours,
    pendingOtDays,
    basePay,
    otPay,
    commissionByKind,
    commission,
    adjustmentsTotal,
    total: basePay + otPay + commission + adjustmentsTotal,
  }
}

/** Facts for the month, itemised per person. */
async function collectFacts(month: { key: string; start: Date; end: Date }) {
  const settings = await getShopSettings()
  const [y, m] = month.key.split('-').map(Number)
  const firstDay = `${month.key}-01`
  const lastDay = `${month.key}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const inMonth = { gte: month.start, lt: month.end }

  const [users, shifts, tasks, orders] = await Promise.all([
    db.user.findMany(),
    db.staffCheckIn.findMany({
      where: { workDate: { gte: firstDay, lte: lastDay }, checkOutAt: { not: null } },
      orderBy: { workDate: 'asc' },
    }),
    db.task.findMany({
      where: { status: 'COMPLETED', completedAt: inMonth, assigneeId: { not: null } },
      include: { order: { select: { id: true, code: true, status: true, listedPrice: true, discount: true, tasks: { select: { price: true } } } } },
    }),
    db.order.findMany({
      where: { createdAt: inMonth, status: { not: 'CANCELLED' } },
      select: { id: true, code: true, listedPrice: true, discount: true, createdById: true, salespersonId: true, customerName: true },
    }),
  ])

  const shiftsByUser = new Map<string, ShiftItem[]>()
  for (const s of shifts) {
    const checkIn = s.checkInAt ?? s.timestamp
    const checkOut = s.checkOutAt!
    const hours = round2(hoursBetween(checkIn, checkOut))
    const open = atVnTime(s.workDate, settings.openTime)
    const close = atVnTime(s.workDate, settings.closeTime)
    const regular = round2(
      hoursBetween(new Date(Math.max(checkIn.getTime(), open.getTime())), new Date(Math.min(checkOut.getTime(), close.getTime()))),
    )
    const ot = round2(Math.max(0, hours - regular))
    const list = shiftsByUser.get(s.staffId) ?? []
    list.push({
      date: s.workDate,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      hours,
      regularHours: regular,
      otHours: ot,
      otDecision: ot > 0.01 ? 'PENDING' : 'NONE',
      autoClosed: s.autoClosed,
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
    if (task.order) {
      const priced = task.order.tasks.filter((t) => t.price !== null)
      const pricedSum = priced.reduce((sum, t) => sum + (t.price ?? 0), 0)
      if (task.price !== null && pricedSum > 0) {
        // The product's price less its share of the order discount.
        base = Math.round(task.price - ((task.order.discount ?? 0) * task.price) / pricedSum)
      } else {
        // Older orders without per-product prices: split the order evenly.
        base = Math.round(orderBase(task.order) / Math.max(task.order.tasks.length, 1))
      }
    } else {
      base = task.price ?? 0
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
    const base = orderBase(order)
    const salesperson = order.salespersonId ?? order.createdById
    if (salesperson) {
      push(salesperson, { key: `SALES:${order.id}`, kind: 'SALES', orderId: order.id, orderCode: order.code, label: order.customerName, base })
    }
  }

  return { settings, users, shiftsByUser, commissionsByUser }
}

const rateFor = (line: { makerRate: number; salesRate: number }, kind: CommissionKind) =>
  kind === 'MAKER' ? line.makerRate : line.salesRate

/** Create the month's draft, or refresh an existing draft with the latest
 *  shifts and orders while keeping every manual change: per-month rates,
 *  OT decisions (by day), commission items switched off or re-rated, and
 *  adjustments. Locked payrolls are never touched. */
export async function generatePayroll(monthKey: string, actor: AuditActor) {
  const month = parseVnMonth(monthKey)
  if (!month) throw new ApiError(400, 'month must be YYYY-MM')

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

    // Rates: keep this month's overrides, otherwise take the pay profile.
    const rates = before ?? {
      payType: user.payType,
      baseSalary: user.baseSalary ?? 0,
      hourlyRate: user.hourlyRate,
      makerRate: user.commissionRate ?? 0,
      salesRate: user.salesCommissionRate,
    }

    const oldShifts = new Map(((before?.shifts as ShiftItem[] | undefined) ?? []).map((s) => [s.date, s.otDecision]))
    const shifts = (shiftsByUser.get(user.id) ?? []).map((s) => {
      const kept = oldShifts.get(s.date)
      return s.otDecision === 'PENDING' && kept && kept !== 'PENDING' && kept !== 'NONE' ? { ...s, otDecision: kept } : s
    })

    const oldItems = new Map(((before?.commissions as CommissionItem[] | undefined) ?? []).map((c) => [c.key, c]))
    const commissions: CommissionItem[] = (commissionsByUser.get(user.id) ?? []).map((item) => {
      const kept = oldItems.get(item.key)
      return { ...item, rate: kept?.rate ?? rateFor(rates, item.kind), included: kept?.included ?? true }
    })

    const data = {
      userName: user.name,
      role: user.role,
      payType: rates.payType,
      baseSalary: rates.baseSalary,
      hourlyRate: rates.hourlyRate,
      makerRate: rates.makerRate,
      salesRate: rates.salesRate,
      shifts: shifts as unknown as Prisma.InputJsonValue,
      commissions: commissions as unknown as Prisma.InputJsonValue,
    }
    const total = computeLine({ ...data, adjustments: before?.adjustments ?? [] }, payroll.otMultiplier).total
    if (before) {
      await db.payrollLine.update({ where: { id: before.id }, data: { ...data, total } })
    } else {
      await db.payrollLine.create({ data: { ...data, payrollId: payroll.id, userId: user.id, total } })
    }
  }

  await audit(actor, {
    action: existing ? 'payroll.refresh' : 'payroll.create',
    entity: 'payroll',
    entityId: payroll.id,
    summary: `Bảng lương ${month.key}`,
  })
  return getPayroll(month.key)
}

/** The month's payroll with computed totals, or null if not created yet. */
export async function getPayroll(monthKey: string) {
  const payroll = await db.payroll.findUnique({
    where: { month: monthKey },
    include: { lines: { orderBy: { userName: 'asc' } } },
  })
  if (!payroll) return null
  const lines = payroll.lines.map((line) => ({ ...line, totals: computeLine(line, payroll.otMultiplier) }))
  return {
    ...payroll,
    createdAt: payroll.createdAt.toISOString(),
    updatedAt: payroll.updatedAt.toISOString(),
    lockedAt: payroll.lockedAt?.toISOString() ?? null,
    lines,
    summary: {
      total: lines.reduce((sum, l) => sum + l.totals.total, 0),
      pendingOtDays: lines.reduce((sum, l) => sum + l.totals.pendingOtDays, 0),
    },
  }
}

/** A staff member's own pay for a month ("Lương của tôi"). Once the payroll is
 *  locked it is exactly the locked line. Before that it is an estimate from
 *  their pay profile and the month's facts so far: overtime awaiting review
 *  counts as OT (as in the manager's draft), and the manager's draft edits and
 *  adjustments stay private until the payroll is locked. */
export async function getMyPay(userId: string, monthKey: string) {
  const month = parseVnMonth(monthKey)
  if (!month) throw new ApiError(400, 'month must be YYYY-MM')
  if (month.start > new Date()) throw new ApiError(400, 'Tháng chưa bắt đầu')

  const payroll = await db.payroll.findUnique({ where: { month: month.key }, include: { lines: { where: { userId } } } })
  if (payroll?.status === 'LOCKED') {
    const line = payroll.lines[0]
    return {
      month: month.key,
      status: 'LOCKED' as const,
      lockedAt: payroll.lockedAt?.toISOString() ?? null,
      otMultiplier: payroll.otMultiplier,
      line: line ? { ...line, totals: computeLine(line, payroll.otMultiplier) } : null,
    }
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new ApiError(404, 'User not found')
  const { settings, shiftsByUser, commissionsByUser } = await collectFacts(month)
  const rates = {
    payType: user.payType,
    baseSalary: user.baseSalary ?? 0,
    hourlyRate: user.hourlyRate,
    makerRate: user.commissionRate ?? 0,
    salesRate: user.salesCommissionRate,
  }
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
    line: { ...line, totals: computeLine(line, otMultiplier) },
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

/** Edit one person's line: this month's pay type/rates, OT decisions, which
 *  commission items count and at what rate, adjustments and a note. */
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
    shifts: line.shifts as ShiftItem[],
    commissions: line.commissions as CommissionItem[],
    adjustments: line.adjustments as Adjustment[],
    note: line.note,
  }

  if (body.payType !== undefined) {
    if (body.payType !== 'MONTHLY' && body.payType !== 'HOURLY') throw new ApiError(400, 'payType không hợp lệ')
    next.payType = body.payType
  }
  if (body.baseSalary !== undefined) next.baseSalary = asMoney(body.baseSalary, 'Lương cứng')
  if (body.hourlyRate !== undefined) next.hourlyRate = asMoney(body.hourlyRate, 'Đơn giá giờ')

  // A new line rate applies to every item of that kind (overriding per-item rates).
  for (const [field, kind] of [['makerRate', 'MAKER'], ['salesRate', 'SALES']] as const) {
    if (body[field] === undefined) continue
    const rate = asRate(body[field], field)
    next[field] = rate
    next.commissions = next.commissions.map((c) => (c.kind === kind ? { ...c, rate } : c))
  }

  if (Array.isArray(body.shiftDecisions)) {
    const decisions = new Map<string, OtDecision>()
    for (const d of body.shiftDecisions as { date?: unknown; otDecision?: unknown }[]) {
      if (typeof d?.date !== 'string' || !['OT', 'REGULAR', 'EXCLUDE', 'PENDING'].includes(d.otDecision as string)) {
        throw new ApiError(400, 'Quyết định OT không hợp lệ')
      }
      decisions.set(d.date, d.otDecision as OtDecision)
    }
    next.shifts = next.shifts.map((s) => (s.otHours > 0.01 && decisions.has(s.date) ? { ...s, otDecision: decisions.get(s.date)! } : s))
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
    if (!Array.isArray(body.adjustments)) throw new ApiError(400, 'adjustments must be a list')
    next.adjustments = (body.adjustments as { label?: unknown; amount?: unknown }[]).map((a, i) => {
      if (typeof a?.label !== 'string' || !a.label.trim()) throw new ApiError(400, `Khoản điều chỉnh ${i + 1}: thiếu nội dung`)
      return { label: a.label.trim().slice(0, 200), amount: asMoney(a.amount, `Khoản điều chỉnh ${i + 1}`, { allowNegative: true }) }
    })
  }
  if (body.note !== undefined) next.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null

  const total = computeLine(next, payroll.otMultiplier).total
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
    await db.payrollLine.update({ where: { id: line.id }, data: { total: computeLine(line, n).total } })
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
 *  affect it. Every OT day must have been reviewed first. */
export async function lockPayroll(payrollId: string, actor: AuditActor) {
  const payroll = await draftOf(payrollId)
  const current = (await getPayroll(payroll.month))!
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
  const text = value === null || value === undefined ? '' : String(value)
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
    ['Nhân viên', 'Hình thức', 'Giờ thường', 'Giờ OT', 'Lương', 'Tiền OT', 'HH làm đơn', 'HH sale', 'Điều chỉnh', 'Tổng', 'Ghi chú'],
  ]
  for (const line of payroll.lines) {
    const t = line.totals
    rows.push([
      line.userName,
      line.payType === 'MONTHLY' ? 'Lương cứng' : 'Theo giờ',
      t.regularHours,
      t.otHours,
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
