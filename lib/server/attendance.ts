import db from './db'
import { ApiError } from './api-error'
import { audit, diff, type AuditActor } from './audit'
import { addVnDays, parseVnDateKey, vnDateKey } from './vn-time'

// Attendance rules. Hours feed hourly pay (sales, assistant florists), so a
// shift must be complete and plausible:
// - one shift per person per Vietnam day (unique staffId + workDate);
// - a shift nobody checked out of is closed at closing time by the nightly
//   job and flagged, so it is never left open or billed for days;
// - staff may enter or fix their own times for today and the previous
//   CORRECTION_DAYS days (no approval, but every change is audited);
//   managers may fix anyone's shift within MANAGER_CORRECTION_DAYS.

export const CORRECTION_DAYS = 3
const MANAGER_CORRECTION_DAYS = 62
const MAX_SHIFT_HOURS = 16
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export async function getShopSettings() {
  return db.shopSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
}

export async function updateShopSettings(actor: AuditActor, input: { openTime?: unknown; closeTime?: unknown }) {
  const current = await getShopSettings()
  const openTime = input.openTime === undefined ? current.openTime : parseTime(input.openTime, 'openTime')
  const closeTime = input.closeTime === undefined ? current.closeTime : parseTime(input.closeTime, 'closeTime')
  if (closeTime <= openTime) throw new ApiError(400, 'Giờ đóng cửa phải sau giờ mở cửa')
  const updated = await db.shopSettings.update({ where: { id: 1 }, data: { openTime, closeTime } })
  const changes = diff(current, updated, ['openTime', 'closeTime'])
  if (changes) await audit(actor, { action: 'settings.update', entity: 'settings', summary: 'Giờ làm việc', changes })
  return updated
}

function parseTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) throw new ApiError(400, `${field} phải có dạng HH:mm`)
  return value
}

/** The instant a Vietnam wall-clock time occurs on a given Vietnam date. */
const atVnTime = (workDate: string, time: string) => new Date(`${workDate}T${time}:00+07:00`)

const hoursBetween = (start: Date, end: Date) => Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100

/** Close every shift from before today that nobody checked out of, at the
 *  shop's closing time (or at check-in if they checked in after closing).
 *  Run nightly, and also before check-ins are listed, so a missed job can't
 *  leave a shift open. Returns how many were closed. */
export async function closeOpenShifts(now = new Date()) {
  const today = vnDateKey(now)
  const open = await db.staffCheckIn.findMany({
    where: { checkOutAt: null, workDate: { lt: today } },
    select: { id: true, staffId: true, staffName: true, workDate: true, checkInAt: true, timestamp: true },
  })
  if (open.length === 0) return 0

  const { closeTime } = await getShopSettings()
  for (const shift of open) {
    const checkIn = shift.checkInAt ?? shift.timestamp
    const closing = atVnTime(shift.workDate, closeTime)
    const checkOut = closing > checkIn ? closing : checkIn
    await db.staffCheckIn.update({
      where: { id: shift.id },
      data: { checkOutAt: checkOut, workingHours: hoursBetween(checkIn, checkOut), autoClosed: true },
    })
    await audit(null, {
      action: 'checkin.auto_close',
      entity: 'checkin',
      entityId: shift.id,
      summary: `${shift.staffName} ${shift.workDate}: quên chấm công ra, tự chốt lúc ${closeTime}`,
    })
  }
  return open.length
}

type Staff = { id: string; name: string; role: string }

export async function checkIn(staff: Staff, now = new Date()) {
  const workDate = vnDateKey(now)
  const existing = await db.staffCheckIn.findUnique({ where: { staffId_workDate: { staffId: staff.id, workDate } } })
  if (existing) throw new ApiError(409, 'Bạn đã chấm công vào hôm nay. Nếu giờ vào chưa đúng, dùng "Sửa giờ".')
  return db.staffCheckIn.create({
    data: {
      staffId: staff.id,
      staffName: staff.name,
      discipline: staff.role === 'sales' ? 'sales' : 'florist',
      workDate,
      timestamp: now,
      checkInAt: now,
      locationLabel: 'Tại cửa hàng',
      locationType: 'AT_OFFICE',
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
  // Checking out "now" on an earlier day's shift would bill every hour since.
  if (shift.workDate !== vnDateKey(now)) {
    throw new ApiError(409, 'Ca này thuộc ngày khác. Dùng "Sửa giờ" để nhập giờ ra thực tế.')
  }
  const checkInAt = shift.checkInAt ?? shift.timestamp
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
  input: { staffId?: unknown; workDate?: unknown; checkIn?: unknown; checkOut?: unknown; reason?: unknown },
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

  const checkInAt = atVnTime(workDate, parseTime(input.checkIn, 'Giờ vào'))
  const checkOutAt = input.checkOut === null || input.checkOut === undefined || input.checkOut === ''
    ? null
    : atVnTime(workDate, parseTime(input.checkOut, 'Giờ ra'))

  if (checkInAt > now) throw new ApiError(400, 'Giờ vào không được ở tương lai')
  if (checkOutAt && checkOutAt > now) throw new ApiError(400, 'Giờ ra không được ở tương lai')
  if (checkOutAt && checkOutAt <= checkInAt) throw new ApiError(400, 'Giờ ra phải sau giờ vào')
  if (checkOutAt && hoursBetween(checkInAt, checkOutAt) > MAX_SHIFT_HOURS) {
    throw new ApiError(400, `Một ca không quá ${MAX_SHIFT_HOURS} tiếng`)
  }
  // Only today's shift may stay open; an earlier day needs its check-out time.
  if (!checkOutAt && workDate !== today) throw new ApiError(400, 'Vui lòng nhập giờ ra cho ngày đã qua')

  const staff = await db.user.findUnique({ where: { id: staffId }, select: { id: true, name: true, role: true } })
  if (!staff) throw new ApiError(404, 'Không tìm thấy nhân viên')

  const existing = await db.staffCheckIn.findUnique({ where: { staffId_workDate: { staffId, workDate } } })
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
          timestamp: checkInAt,
          locationLabel: 'Chấm công bù',
          locationType: 'AT_OFFICE',
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
      summary: `${staff.name} ${workDate}: ${reason.slice(0, 120)}`,
      changes: existing ? diff(existing, saved, ['checkInAt', 'checkOutAt', 'workingHours']) : null,
    },
  )
  return saved
}
