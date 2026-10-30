'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useLocale } from '@/components/providers/locale-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { fetchRecentCheckIns } from '@/lib/api'
import type { ShiftCorrectionInput, StaffCheckIn, User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { TimeInput24 } from '@/components/time-input-24'
import { DateInputVN } from '@/components/date-input-vn'

// Staff may fix their own shifts for today and the previous days below;
// must match CORRECTION_DAYS in lib/server/attendance.ts.
const CORRECTION_DAYS = 3
// A shift may run past midnight up to this long (MAX_SHIFT_HOURS on the server).
const MAX_SHIFT_HOURS = 16

const VN = 'Asia/Ho_Chi_Minh'
/** YYYY-MM-DD of an instant in Vietnam. */
const vnDay = (value: string | Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: VN }).format(new Date(value))
/** HH:mm of an instant in Vietnam. */
const vnTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-GB', { timeZone: VN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : ''
const shiftDay = (dayKey: string, days: number) =>
  new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const dayLabel = (dayKey: string) => {
  const [, month, day] = dayKey.split('-')
  return `${day}/${month}`
}
const hoursLabel = (hours?: number | null) => {
  if (hours === null || hours === undefined) return '—'
  const minutes = Math.round(hours * 60)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

/** "Online" for a sales shift worked from home. */
function ModeBadge({ entry }: { entry?: StaffCheckIn }) {
  if (entry?.workMode !== 'ONLINE') return null
  return (
    <span className="ml-2 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
      Online
    </span>
  )
}

function ShiftTag({ entry }: { entry: StaffCheckIn }) {
  const [label, tone] = entry.autoClosed
    ? ['Quên chấm ra – 0 giờ', 'bg-amber-50 text-amber-800 border-amber-200']
    : entry.correctedAt
      ? ['Đã sửa tay', 'bg-sky-50 text-sky-700 border-sky-200']
      : !entry.checkOutAt
        ? ['Đang làm', 'bg-emerald-50 text-emerald-700 border-emerald-200']
        : ['Bình thường', 'bg-muted text-muted-foreground border-border']
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', tone)}>{label}</span>
}

type CorrectionTarget = {
  staffId?: string
  staffName?: string
  workDate: string
  entry?: StaffCheckIn
  /** Sales may enter an online (at-home) shift. */
  canOnline?: boolean
  mode?: 'SHOP' | 'ONLINE'
}

/** Enter or fix one shift's times. Staff: own shifts within CORRECTION_DAYS.
 *  Managers: anyone's (staff pre-selected from the row they clicked). */
function CorrectionModal({
  target,
  isManager,
  closeTime,
  onClose,
  onSave,
}: {
  target: CorrectionTarget
  isManager: boolean
  closeTime: string
  onClose: () => void
  onSave: (input: ShiftCorrectionInput) => Promise<unknown>
}) {
  const today = vnDay()
  const [workDate, setWorkDate] = useState(target.workDate)
  const [checkIn, setCheckIn] = useState(vnTime(target.entry?.checkInAt) || '')
  const [checkOut, setCheckOut] = useState(
    target.entry?.autoClosed ? '' : vnTime(target.entry?.checkOutAt) || '',
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [workMode, setWorkMode] = useState<'SHOP' | 'ONLINE'>(target.entry?.workMode ?? target.mode ?? 'SHOP')

  const save = async () => {
    setError('')
    if (!checkIn) return setError('Vui lòng nhập giờ vào')
    if (workDate !== today && !checkOut) return setError('Ngày đã qua cần có giờ ra')
    if (!reason.trim()) return setError('Vui lòng ghi lý do')
    setSaving(true)
    try {
      await onSave({ workDate, workMode, checkIn, checkOut: checkOut || null, reason: reason.trim(), staffId: target.staffId })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">
            {target.entry ? 'Sửa giờ chấm công' : 'Chấm công bù'}
            {target.staffName ? ` · ${target.staffName}` : ''}
            {target.entry?.workMode === 'ONLINE' ? ' · Online' : ''}
          </h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {target.entry?.autoClosed && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Ca này quên chấm công ra nên đang tính 0 giờ. Nhập giờ ra thực tế.
          </p>
        )}

        <label className="block space-y-1 text-sm font-medium text-foreground">
          <span>Ngày</span>
          <DateInputVN
            value={workDate}
            min={isManager ? undefined : shiftDay(today, -CORRECTION_DAYS)}
            max={today}
            disabled={Boolean(target.entry)}
            onChange={setWorkDate}
            className={inputClass}
          />
        </label>
        {target.canOnline && !target.entry && (
          <label className="block space-y-1 text-sm font-medium text-foreground">
            <span>Hình thức</span>
            <select value={workMode} onChange={(e) => setWorkMode(e.target.value as 'SHOP' | 'ONLINE')} className={inputClass}>
              <option value="SHOP">Tại cửa hàng</option>
              <option value="ONLINE">Online (tại nhà)</option>
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm font-medium text-foreground">
            <span>Giờ vào</span>
            <TimeInput24 value={checkIn} onChange={setCheckIn} className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm font-medium text-foreground">
            <span>Giờ ra {workDate === today ? '(nếu đã về)' : ''}</span>
            <TimeInput24 value={checkOut} onChange={setCheckOut} className={inputClass} />
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium text-foreground">
          <span>Lý do</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: quên bấm chấm công ra"
            className={inputClass}
          />
        </label>
        {checkIn && checkOut && checkOut <= checkIn && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Giờ ra trước giờ vào: tính là ca qua đêm, ra lúc {checkOut} sáng hôm sau.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Ca qua đêm: nhập giờ ra như bình thường (ví dụ vào 18:00, ra 01:30).
          Thay đổi được lưu ngay và ghi vào nhật ký (ai sửa, giờ cũ → giờ mới).
          {!isManager && ` Chỉ tự sửa được trong ${CORRECTION_DAYS} ngày gần nhất.`}
        </p>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 hover:bg-muted">
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CheckinPage() {
  const { user } = useAuth()
  const { checkins, settings, users, createCheckIn, checkOut, correctCheckIn, deleteCheckIn, setCheckinMonth } = useAppData()
  const today = vnDay()
  const isAdmin = user?.role === 'admin'

  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [correcting, setCorrecting] = useState<CorrectionTarget | null>(null)

  // The month table: the selected day's month for managers, this month for staff.
  const monthToLoad = (isAdmin ? selectedDate : today).slice(0, 7)
  useEffect(() => setCheckinMonth(monthToLoad), [monthToLoad, setCheckinMonth])

  // Staff: the last few days, loaded separately so a fix at the start of a
  // month still reaches the end of the previous one.
  const [recent, setRecent] = useState<StaffCheckIn[]>([])
  const loadRecent = useCallback(() => {
    if (!user || isAdmin) return
    fetchRecentCheckIns(CORRECTION_DAYS + 1).then(setRecent).catch(() => setRecent([]))
  }, [user, isAdmin])
  useEffect(loadRecent, [loadRecent])

  const openTime = settings?.workingHours.start ?? '08:00'
  const closeTime = settings?.workingHours.end ?? '19:00'

  const saveCorrection = async (input: ShiftCorrectionInput) => {
    await correctCheckIn(input)
    loadRecent()
  }

  // ---------------- Manager view ----------------
  if (isAdmin) {
    const dayList = checkins.filter((entry) => entry.workDate === selectedDate)
    // The admin account is the shop owner and does not check in.
    const activeStaff = (users as User[]).filter((u) => u.status === 'active' && u.role !== 'admin')
    // One row per shift (a sales day may have a shop and an online shift).
    const rows = activeStaff
      .flatMap((u) => {
        const shifts = dayList
          .filter((entry) => entry.staffId === u.id)
          .sort((a, b) => (a.checkInAt ?? a.timestamp).localeCompare(b.checkInAt ?? b.timestamp))
        return shifts.length ? shifts.map((entry) => ({ staff: u, entry })) : [{ staff: u, entry: undefined as StaffCheckIn | undefined }]
      })
      .sort((a, b) => Number(Boolean(b.entry)) - Number(Boolean(a.entry)) || a.staff.name.localeCompare(b.staff.name, 'vi'))
    const hasOnline = (staffId: string) => dayList.some((entry) => entry.staffId === staffId && entry.workMode === 'ONLINE')
    const needsFix = checkins.filter((entry) => entry.autoClosed)

    return (
      <div className="space-y-6 p-4 pb-20 md:p-8 md:pb-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chấm công</h1>
            <p className="text-sm text-muted-foreground">
              Giờ làm việc {openTime} – {closeTime}. Ca quên chấm ra quá {MAX_SHIFT_HOURS} tiếng tính 0 giờ cho tới khi được sửa.
            </p>
          </div>
          <DateInputVN
            value={selectedDate}
            max={today}
            onChange={(value) => value && setSelectedDate(value)}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </header>

        {needsFix.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{needsFix.length} ca trong tháng quên chấm công ra (đang tính 0 giờ), chưa ai sửa:</p>
              <p>{needsFix.map((entry) => `${entry.staffName} (${dayLabel(entry.workDate)})`).join(', ')}</p>
            </div>
          </div>
        )}

        <section className="overflow-x-auto rounded-3xl border border-border bg-white/90 p-6">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Nhân viên</th>
                <th className="px-4 py-3 font-semibold">Vào</th>
                <th className="px-4 py-3 font-semibold">Ra</th>
                <th className="px-4 py-3 font-semibold">Số giờ</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ staff, entry }) => (
                <tr key={entry?.id ?? staff.id}>
                  <td className="py-3 pr-4 font-medium text-foreground">
                    {staff.name}
                    <ModeBadge entry={entry} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{vnTime(entry?.checkInAt) || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{vnTime(entry?.checkOutAt) || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{hoursLabel(entry?.workingHours)}</td>
                  <td className="px-4 py-3">
                    {entry ? (
                      <div className="space-y-1">
                        <ShiftTag entry={entry} />
                        {entry.correctedAt && (
                          <p className="text-xs text-muted-foreground">
                            {entry.correctedByName}: {entry.correctionReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chưa chấm công</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setCorrecting({ staffId: staff.id, staffName: staff.name, workDate: selectedDate, entry, canOnline: staff.role === 'sales' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      {entry ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {entry ? 'Sửa' : 'Thêm'}
                    </button>
                    {staff.role === 'sales' && entry && entry.workMode !== 'ONLINE' && !hasOnline(staff.id) && (
                      <button
                        type="button"
                        onClick={() => setCorrecting({ staffId: staff.id, staffName: staff.name, workDate: selectedDate, canOnline: true, mode: 'ONLINE' })}
                        className="ml-2 inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Ca online
                      </button>
                    )}
                    {entry && (
                      <button
                        type="button"
                        title="Xoá ca chấm nhầm"
                        onClick={async () => {
                          const reason = window.prompt(`Xoá ca ${dayLabel(entry.workDate)} của ${staff.name}? Ghi lý do (ví dụ: bấm nhầm ngày nghỉ):`)
                          if (!reason?.trim()) return
                          try {
                            await deleteCheckIn(entry.id, reason.trim())
                          } catch (error) {
                            window.alert(error instanceof Error ? error.message : 'Không xoá được ca')
                          }
                        }}
                        className="ml-2 inline-flex items-center rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {correcting && (
          <CorrectionModal
            target={correcting}
            isManager
            closeTime={closeTime}
            onClose={() => setCorrecting(null)}
            onSave={saveCorrection}
          />
        )}
      </div>
    )
  }

  // ---------------- Staff view ----------------
  // The shift in progress may have started yesterday evening (past midnight).
  const openEntry =
    recent.find(
      (entry) =>
        !entry.checkOutAt &&
        Date.now() - new Date(entry.checkInAt ?? entry.timestamp).getTime() <= MAX_SHIFT_HOURS * 3_600_000,
    ) ?? null
  const isSales = user?.role === 'sales'
  // Today's shifts: one at the shop and, for sales, one online (from home).
  const todayEntries = recent
    .filter((entry) => entry.workDate === today || entry.id === openEntry?.id)
    .sort((a, b) => (a.checkInAt ?? a.timestamp).localeCompare(b.checkInAt ?? b.timestamp))
  const todayEntry = openEntry ?? todayEntries[todayEntries.length - 1] ?? null
  const hasShopToday = recent.some((entry) => entry.workDate === today && (entry.workMode ?? 'SHOP') === 'SHOP')
  const hasOnlineToday = recent.some((entry) => entry.workDate === today && entry.workMode === 'ONLINE')
  const canStartShop = !openEntry && !hasShopToday
  const canStartOnline = isSales && !openEntry && !hasOnlineToday
  const earliestFixable = shiftDay(today, -CORRECTION_DAYS)
  const toFix = recent.filter((entry) => entry.autoClosed && entry.workDate >= earliestFixable)
  const monthEntries = [...checkins].sort((a, b) => b.workDate.localeCompare(a.workDate))

  const run = async (action: () => Promise<StaffCheckIn | unknown>, done: string) => {
    setIsSubmitting(true)
    setActionError('')
    setActionMessage('')
    try {
      await action()
      setActionMessage(`${done} lúc ${vnTime(new Date().toISOString())}`)
      loadRecent()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác không thành công')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 p-4 pb-20 md:p-8 md:pb-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Điểm danh</h1>
        <p className="text-sm text-muted-foreground">
          Giờ làm việc {openTime} – {closeTime}
        </p>
      </header>

      {toFix.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Ngày <strong>{dayLabel(entry.workDate)}</strong> bạn quên chấm công ra nên ca đang tính 0 giờ. Nhập giờ ra để được tính công.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCorrecting({ workDate: entry.workDate, entry })}
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
          >
            Nhập giờ ra thực tế
          </button>
        </div>
      ))}

      <section className="space-y-4 rounded-3xl border border-border bg-white/90 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            {todayEntry ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <Clock className="h-6 w-6 text-muted-foreground" />}
            {!todayEntry
              ? 'Chưa chấm công hôm nay'
              : openEntry
                ? `Đang trong ca${openEntry.workMode === 'ONLINE' ? ' online' : ''}${openEntry.workDate !== today ? ` (từ ${dayLabel(openEntry.workDate)})` : ''}`
                : 'Đã chấm công hôm nay'}
          </h2>
          {!openEntry && (canStartShop || canStartOnline) ? (
            <div className="flex flex-wrap gap-2">
              {canStartShop && (
                <button
                  type="button"
                  onClick={() => run(() => createCheckIn({ workMode: 'SHOP' }), 'Đã chấm công vào')}
                  disabled={isSubmitting}
                  className="h-12 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting ? '...' : isSales ? 'Chấm công tại cửa hàng' : 'Chấm công vào'}
                </button>
              )}
              {canStartOnline && (
                <button
                  type="button"
                  onClick={() => run(() => createCheckIn({ workMode: 'ONLINE' }), 'Đã chấm công online')}
                  disabled={isSubmitting}
                  className="h-12 rounded-full border-2 border-violet-500 bg-white px-6 text-base font-semibold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-60"
                >
                  {isSubmitting ? '...' : 'Chấm công online (tại nhà)'}
                </button>
              )}
            </div>
          ) : openEntry ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Chấm công ra, kết thúc ca làm?')) run(() => checkOut(openEntry.id), 'Đã chấm công ra')
              }}
              disabled={isSubmitting}
              className="h-12 rounded-full bg-amber-500 px-8 text-base font-semibold text-white shadow-lg hover:bg-amber-600 disabled:opacity-60"
            >
              {isSubmitting ? '...' : 'Chấm công ra'}
            </button>
          ) : null}
        </div>

        {todayEntries.map((entry) => (
          <div key={entry.id} className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Vào{entry.workMode === 'ONLINE' ? ' · online' : todayEntries.length > 1 ? ' · tại cửa hàng' : ''}
              </p>
              <p className="text-lg font-semibold">{vnTime(entry.checkInAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ra</p>
              <p className="text-lg font-semibold">{vnTime(entry.checkOutAt) || '--:--'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Số giờ</p>
              <p className="text-lg font-semibold">{hoursLabel(entry.workingHours)}</p>
            </div>
          </div>
        ))}

        {actionError && <p className="text-sm text-red-700">{actionError}</p>}
        {actionMessage && !actionError && <p className="text-sm font-medium text-green-700">{actionMessage}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {todayEntry && (
            <button
              type="button"
              onClick={() => setCorrecting({ workDate: todayEntry.workDate, entry: todayEntry })}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <Pencil className="h-4 w-4" /> Sửa giờ ca này
            </button>
          )}
          <button
            type="button"
            onClick={() => setCorrecting({ workDate: todayEntry ? shiftDay(today, -1) : today, canOnline: isSales })}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Quên chấm công? Chấm công bù
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white/90 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chấm công tháng này</h2>
        {monthEntries.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Chưa có lượt chấm công nào trong tháng.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Ngày</th>
                  <th className="px-4 py-3 font-semibold">Vào</th>
                  <th className="px-4 py-3 font-semibold">Ra</th>
                  <th className="px-4 py-3 font-semibold">Số giờ</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-3 pr-4 text-foreground">
                      {dayLabel(entry.workDate)}
                      <ModeBadge entry={entry} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{vnTime(entry.checkInAt) || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vnTime(entry.checkOutAt) || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{hoursLabel(entry.workingHours)}</td>
                    <td className="px-4 py-3"><ShiftTag entry={entry} /></td>
                    <td className="px-4 py-3 text-right">
                      {entry.workDate >= earliestFixable && (
                        <button
                          type="button"
                          onClick={() => setCorrecting({ workDate: entry.workDate, entry })}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {correcting && (
        <CorrectionModal
          target={correcting}
          isManager={false}
          closeTime={closeTime}
          onClose={() => setCorrecting(null)}
          onSave={saveCorrection}
        />
      )}
    </div>
  )
}
