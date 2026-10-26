import db from './db'
import { ApiError } from './api-error'
import { audit, diff, type AuditActor } from './audit'
import { addVnDays, parseVnDateKey, vnDateKey } from './vn-time'

// Attendance rules. Hours feed pay, so a shift must be complete and plausible:
// - one shift per person per Vietnam day and work mode (unique staffId +
//   workDate + workMode, the day the shift started): sales may add an ONLINE
//   (at-home) shift to their SHOP shift, e.g. the evening from home; the two
//   may not overlap. A shift may run past midnight, up to MAX_SHIFT_HOURS;
// - a shift nobody checked out of within MAX_SHIFT_HOURS is closed with 0
//   hours and flagged, and stays at 0 until someone enters the real time;
// - staff may enter or fix their own times for today and the previous
//   CORRECTION_DAYS days (no approval, but every change is audited);
//   managers may fix anyone's shift within MANAGER_CORRECTION_DAYS, and
//   delete a shift checked in by mistake;
// - nothing can change in a month whose payroll is locked.

export const CORRECTION_DAYS = 3
const MANAGER_CORRECTION_DAYS = 62
const MAX_SHIFT_HOURS = 16
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export async function getShopSettings() {
  return db.shopSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
}

export type Holiday = { date: string; name: string }

/** Public holidays stored in ShopSettings.holidays (JSON). */
export function parseHolidays(value: string | null | undefined): Holiday[] {
  try {
    const list = JSON.parse(value || '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter((h) => h && typeof h.date === 'string' && parseVnDateKey(h.date))
      .map((h) => ({ date: h.date as string, name: typeof h.name === 'string' ? h.name : '' }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

const readHolidays = (value: unknown): Holiday[] => {
  if (!Array.isArray(value)) throw new ApiError(400, 'Danh sách ngày lễ không hợp lệ')
  const byDate = new Map<string, Holiday>()
  for (const raw of value as { date?: unknown; name?: unknown }[]) {
    if (typeof raw?.date !== 'string' || !parseVnDateKey(raw.date)) throw new ApiError(400, 'Ngày lễ phải có dạng YYYY-MM-DD')
    byDate.set(raw.date, { date: raw.date, name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : '' })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function updateShopSettings(
  actor: AuditActor,
  input: { openTime?: unknown; closeTime?: unknown; holidays?: unknown },
) {
  const current = await getShopSettings()
  const openTime = input.openTime === undefined ? current.openTime : parseTime(input.openTime, 'Giờ mở cửa')
  const closeTime = input.closeTime === undefined ? current.closeTime : parseTime(input.closeTime, 'Giờ đóng cửa')
  if (closeTime <= openTime) throw new ApiError(400, 'Giờ đóng cửa phải sau giờ mở cửa')
  const holidays = input.holidays === undefined ? current.holidays : JSON.stringify(readHolidays(input.holidays))
  const updated = await db.shopSettings.update({ where: { id: 1 }, data: { openTime, closeTime, holidays } })
  const changes = diff(current, updated, ['openTime', 'closeTime', 'holidays'])
  if (changes) await audit(actor, { action: 'settings.update', entity: 'settings', summary: 'Giờ làm việc / ngày lễ', changes })
  return updated
}

/** Shifts of a month whose payroll is locked are final. */
async function assertMonthOpen(workDate: string) {
  const month = workDate.slice(0, 7)
  const payroll = await db.payroll.findUnique({ where: { month }, select: { status: true } })
  if (payroll?.status === 'LOCKED') {
    throw new ApiError(409, `Tháng ${month.slice(5)}/${month.slice(0, 4)} đã chốt lương, không sửa chấm công được nữa. Liên hệ quản lý.`)
  }
}

function parseTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) throw new ApiError(400, `${field} phải có dạng HH:mm`)
  return value
}

/** The instant a Vietnam wall-clock time occurs on a given Vietnam date. */
const atVnTime = (workDate: string, time: string) => new Date(`${workDate}T${time}:00+07:00`)

const hoursBetween = (start: Date, end: Date) => Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100

/** Close every shift nobody checked out of within MAX_SHIFT_HOURS, with 0
 *  hours: it is paid only once someone enters the real check-out time. Run
 *  nightly, and also before check-ins are listed, so a missed job can't leave
 *  a shift open. Returns how many were closed. */
export async function closeOpenShifts(now = new Date()) {
  const open = await db.staffCheckIn.findMany({
    where: { checkOutAt: null },
    select: { id: true, staffName: true, workDate: true, checkInAt: true, timestamp: true },
  })
  const stale = open.filter((shift) => hoursBetween(shift.checkInAt ?? shift.timestamp, now) > MAX_SHIFT_HOURS)
  for (const shift of stale) {
    const checkIn = shift.checkInAt ?? shift.timestamp
    await db.staffCheckIn.update({
      where: { id: shift.id },
      data: { checkOutAt: checkIn, workingHours: 0, autoClosed: true },
    })
    await audit(null, {
      action: 'checkin.auto_close',
      entity: 'checkin',
      entityId: shift.id,
      summary: `${shift.staffName} ${shift.workDate}: quên chấm công ra, tính 0 giờ cho tới khi sửa`,
    })
  }
  return stale.length
}

/** The person's shift still open (checked in, not out) within MAX_SHIFT_HOURS. */
async function openShiftOf(staffId: string, now: Date) {
  const open = await db.staffCheckIn.findMany({ where: { staffId, checkOutAt: null }, orderBy: { timestamp: 'desc' } })
  return open.find((shift) => hoursBetween(shift.checkInAt ?? shift.timestamp, now) <= MAX_SHIFT_HOURS) ?? null
}

type Staff = { id: string; name: string; role: string }

export const WORK_MODES = ['SHOP', 'ONLINE'] as const
export type WorkMode = (typeof WORK_MODES)[number]
const MODE_LABEL: Record<WorkMode, string> = { SHOP: 'Tại cửa hàng', ONLINE: 'Online (tại nhà)' }

/** SHOP unless given; only sales may work online. */
function readWorkMode(value: unknown, role: string): WorkMode {
  if (value === undefined || value === null || value === '') return 'SHOP'
  if (value !== 'SHOP' && value !== 'ONLINE') throw new ApiError(400, 'Hình thức làm việc không hợp lệ')
  if (value === 'ONLINE' && role !== 'sales') throw new ApiError(403, 'Chỉ sale được chấm công online')
  return value
}

export async function checkIn(staff: Staff, now = new Date(), modeInput?: unknown) {
  const workMode = readWorkMode(modeInput, staff.role)
  const workDate = vnDateKey(now)
  const open = await openShiftOf(staff.id, now)
  if (open) throw new ApiError(409, 'Bạn chưa chấm công ra ca trước. Chấm công ra trước khi vào ca mới.')
  const existing = await db.staffCheckIn.findUnique({ where: { staffId_workDate_workMode: { staffId: staff.id, workDate, workMode } } })
  if (existing) {
    throw new ApiError(409, `Bạn đã có ca ${MODE_LABEL[workMode].toLowerCase()} hôm nay. Nếu giờ chưa đúng, dùng "Sửa giờ".`)
  }
  return db.staffCheckIn.create({
    data: {
      staffId: staff.id,
      staffName: staff.name,
      discipline: staff.role === 'sales' ? 'sales' : 'florist',
      workDate,
      workMode,
      timestamp: now,
      checkInAt: now,
      locationLabel: MODE_LABEL[workMode],
      locationType: workMode === 'ONLINE' ? 'REMOTE' : 'AT_OFFICE',
      lat: 0,
      lng: 0,
      distanceFromOfficeKm: 0,
    },
  })
}

export async function checkOut(staffId: string, checkInId: string, now = new Date()) {
  const shift = await db.staffCheckIn.findUnique({ where: { id: checkInId } })
  if (!shift || shift.staffId !== staffId) throw new ApiError(404, 'Không tìm thấy ca làm')
  if (shift.checkOutAt) throw new ApiError(409, 'Ca này đã chấm công ra')
  const checkInAt = shift.checkInAt ?? shift.timestamp
  // A shift may cross midnight, but checking out "now" on a shift older than
  // that would bill every hour since.
  if (hoursBetween(checkInAt, now) > MAX_SHIFT_HOURS) {
    throw new ApiError(409, `Ca này đã quá ${MAX_SHIFT_HOURS} tiếng. Dùng "Sửa giờ" để nhập giờ ra thực tế.`)
  }
  return db.staffCheckIn.update({
    where: { id: checkInId },
    data: { checkOutAt: now, workingHours: hoursBetween(checkInAt, now) },
  })
}

/** Enter or fix a shift's times: a forgotten check-in or check-out, or a
 *  check-in pressed late. Creates the shift if the day has none. */
export async function correctShift(
  actor: Staff,
  isManager: boolean,
  input: { staffId?: unknown; workDate?: unknown; workMode?: unknown; checkIn?: unknown; checkOut?: unknown; reason?: unknown },
  now = new Date(),
) {
  const staffId = isManager && typeof input.staffId === 'string' && input.staffId ? input.staffId : actor.id
  if (staffId !== actor.id && !isManager) throw new ApiError(403, 'Bạn chỉ sửa được chấm công của mình')

  const workDate = typeof input.workDate === 'string' ? input.workDate : ''
  const day = parseVnDateKey(workDate)
  if (!day) throw new ApiError(400, 'Ngày không hợp lệ')
  const today = vnDateKey(now)
  const windowDays = isManager ? MANAGER_CORRECTION_DAYS : CORRECTION_DAYS
  const earliest = vnDateKey(addVnDays(now, -windowDays))
  if (workDate > today) throw new ApiError(400, 'Không thể chấm công cho ngày trong tương lai')
  if (workDate < earliest) {
    throw new ApiError(400, isManager
      ? `Chỉ sửa được trong ${MANAGER_CORRECTION_DAYS} ngày gần nhất`
      : `Chỉ tự sửa được trong ${CORRECTION_DAYS} ngày gần nhất. Liên hệ quản lý để sửa ngày cũ hơn.`)
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) throw new ApiError(400, 'Vui lòng ghi lý do')
  await assertMonthOpen(workDate)

  const checkInAt = atVnTime(workDate, parseTime(input.checkIn, 'Giờ vào'))
  let checkOutAt = input.checkOut === null || input.checkOut === undefined || input.checkOut === ''
    ? null
    : atVnTime(workDate, parseTime(input.checkOut, 'Giờ ra'))
  // A check-out earlier than the check-in is the next morning (a shift past midnight).
  if (checkOutAt && checkOutAt <= checkInAt) checkOutAt = new Date(checkOutAt.getTime() + 24 * 3_600_000)

  if (checkInAt > now) throw new ApiError(400, 'Giờ vào không được ở tương lai')
  if (checkOutAt && checkOutAt > now) throw new ApiError(400, 'Giờ ra không được ở tương lai')
  if (checkOutAt && hoursBetween(checkInAt, checkOutAt) > MAX_SHIFT_HOURS) {
    throw new ApiError(400, `Một ca không quá ${MAX_SHIFT_HOURS} tiếng`)
  }
  // Only today's shift may stay open; an earlier day needs its check-out time.
  if (!checkOutAt && workDate !== today) throw new ApiError(400, 'Vui lòng nhập giờ ra cho ngày đã qua')

  const staff = await db.user.findUnique({ where: { id: staffId }, select: { id: true, name: true, role: true } })
  if (!staff) throw new ApiError(404, 'Không tìm thấy nhân viên')
  const workMode = readWorkMode(input.workMode, staff.role)

  const existing = await db.staffCheckIn.findUnique({ where: { staffId_workDate_workMode: { staffId, workDate, workMode } } })
  // The day's other shift (shop vs online) must not overlap this one.
  const other = await db.staffCheckIn.findFirst({ where: { staffId, workDate, workMode: { not: workMode } } })
  if (other) {
    const otherIn = other.checkInAt ?? other.timestamp
    const otherOut = other.checkOutAt ?? now
    const thisOut = checkOutAt ?? now
    if (checkInAt < otherOut && otherIn < thisOut) {
      throw new ApiError(400, `Ca này trùng giờ với ca ${MODE_LABEL[other.workMode as WorkMode].toLowerCase()} cùng ngày`)
    }
  }
  const correction = {
    checkInAt,
    checkOutAt,
    workingHours: checkOutAt ? hoursBetween(checkInAt, checkOutAt) : null,
    autoClosed: false,
    correctedAt: now,
    correctedById: actor.id,
    correctedByName: actor.name,
    correctionReason: reason.slice(0, 500),
  }

  const saved = existing
    ? await db.staffCheckIn.update({ where: { id: existing.id }, data: correction })
    : await db.staffCheckIn.create({
        data: {
          ...correction,
          staffId,
          staffName: staff.name,
          discipline: staff.role === 'sales' ? 'sales' : 'florist',
          workDate,
          workMode,
          timestamp: checkInAt,
          locationLabel: `Chấm công bù · ${MODE_LABEL[workMode]}`,
          locationType: workMode === 'ONLINE' ? 'REMOTE' : 'AT_OFFICE',
          lat: 0,
          lng: 0,
          distanceFromOfficeKm: 0,
        },
      })

  await audit(
    { id: actor.id, name: actor.name },
    {
      action: existing ? 'checkin.correct' : 'checkin.backfill',
      entity: 'checkin',
      entityId: saved.id,
      summary: `${staff.name} ${workDate}${workMode === 'ONLINE' ? ' (online)' : ''}: ${reason.slice(0, 120)}`,
      changes: existing ? diff(existing, saved, ['checkInAt', 'checkOutAt', 'workingHours']) : null,
    },
  )
  return saved
}

/** Remove a shift checked in by mistake (managers only, with a reason). */
export async function deleteShift(actor: Staff, checkInId: string, reasonInput: unknown) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw new ApiError(400, 'Vui lòng ghi lý do')
  const shift = await db.staffCheckIn.findUnique({ where: { id: checkInId } })
  if (!shift) throw new ApiError(404, 'Không tìm thấy ca làm')
  await assertMonthOpen(shift.workDate)
  await db.staffCheckIn.delete({ where: { id: checkInId } })
  await audit(
    { id: actor.id, name: actor.name },
    {
      action: 'checkin.delete',
      entity: 'checkin',
      entityId: checkInId,
      summary: `${shift.staffName} ${shift.workDate}: xoá ca (${reason.slice(0, 120)})`,
    },
  )
}
