'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Lock, Plus, RefreshCw, Trash2, Unlock, X } from 'lucide-react'
import {
  fetchPayroll,
  generatePayroll,
  lockPayroll,
  unlockPayroll,
  updatePayrollLine,
  updatePayrollSettings,
} from '@/lib/api'
import type {
  CommissionKind,
  OtDecision,
  Payroll,
  PayrollCommission,
  PayrollLine,
  PayrollLineUpdate,
  PayrollShift,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const VN = 'Asia/Ho_Chi_Minh'
const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`
const hours = (h: number) => {
  const minutes = Math.round(h * 60)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}
const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: VN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '—'
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: VN }).format(new Date()).slice(0, 7)
const digits = (text: string) => Number(text.replace(/\D/g, '') || 0)
/** The month is over (pay is locked after it, and paid on the 5th). */
const monthOver = (month: string) => thisMonth() > month

const KIND_LABEL: Record<CommissionKind, string> = {
  MAKER: 'Làm đơn',
  SALES: 'Sale',
}
const DECISION_LABEL: Record<OtDecision, string> = {
  NONE: 'Bình thường',
  PENDING: 'Chờ duyệt',
  OT: 'Tính OT',
  REGULAR: 'Tính giờ thường',
  EXCLUDE: 'Không tính giờ ngoài khung',
  RUSH: 'Ca gấp (cả ca tính OT)',
}

/** The choices that make sense for a shift. */
const decisionsFor = (shift: PayrollShift, payType: 'MONTHLY' | 'HOURLY'): OtDecision[] =>
  shift.otHours > 0.01
    ? (['PENDING', 'OT', ...(payType === 'HOURLY' ? (['REGULAR'] as const) : []), 'EXCLUDE', 'RUSH'] as OtDecision[])
    : ['NONE', 'RUSH']

const inputClass = 'w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted/50'

type AdjustmentDraft = { label: string; sign: 1 | -1; amount: string }

/** One person's line: this month's rates, the decision for each shift,
 *  commission items and adjustments. All edits are sent in one save. */
function LineEditor({
  line,
  locked,
  otMultiplier,
  onClose,
  onSaved,
}: {
  line: PayrollLine
  locked: boolean
  otMultiplier: number
  onClose: () => void
  onSaved: (payroll: Payroll) => void
}) {
  const [payType, setPayType] = useState(line.payType)
  const [baseSalary, setBaseSalary] = useState(String(line.baseSalary))
  const [hourlyRate, setHourlyRate] = useState(String(line.hourlyRate))
  const [holidayRate, setHolidayRate] = useState(line.holidayHourlyRate == null ? '' : String(line.holidayHourlyRate))
  const [daysOff, setDaysOff] = useState(String(line.daysOffPerMonth ?? 4))
  const [rates, setRates] = useState({ makerRate: line.makerRate, salesRate: line.salesRate })
  const [decisions, setDecisions] = useState<Record<string, OtDecision>>(
    Object.fromEntries(line.shifts.map((s) => [s.date, s.otDecision])),
  )
  const [items, setItems] = useState<PayrollCommission[]>(line.commissions)
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>(
    line.adjustments.map((a) => ({ label: a.label, sign: a.amount < 0 ? -1 : 1, amount: String(Math.abs(a.amount)) })),
  )
  const [note, setNote] = useState(line.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const ratesChanged = rates.makerRate !== line.makerRate || rates.salesRate !== line.salesRate
  const pendingDays = line.shifts.filter((s) => decisions[s.date] === 'PENDING').length

  const save = async () => {
    setError('')
    if (adjustments.some((a) => !a.label.trim() && digits(a.amount) > 0)) {
      setError('Mỗi khoản điều chỉnh cần có nội dung')
      return
    }
    setSaving(true)
    const input: PayrollLineUpdate = {
      shiftDecisions: line.shifts
        .filter((s) => decisions[s.date] !== s.otDecision)
        .map((s) => ({ date: s.date, otDecision: decisions[s.date] })),
      adjustments: adjustments
        .filter((a) => a.label.trim())
        .map((a) => ({ label: a.label.trim(), amount: a.sign * digits(a.amount) })),
      note,
    }
    // Only the rates actually changed are sent: they then stay fixed for this
    // month instead of following the person's pay profile.
    if (payType !== line.payType) input.payType = payType
    if (digits(baseSalary) !== line.baseSalary) input.baseSalary = digits(baseSalary)
    if (digits(hourlyRate) !== line.hourlyRate) input.hourlyRate = digits(hourlyRate)
    const holiday = holidayRate.trim() ? digits(holidayRate) : null
    if (holiday !== (line.holidayHourlyRate ?? null)) input.holidayHourlyRate = holiday
    if (Number(daysOff) !== (line.daysOffPerMonth ?? 4)) input.daysOffPerMonth = Number(daysOff)
    // A changed line rate resets every item of that kind; otherwise send per-item edits.
    if (ratesChanged) Object.assign(input, rates)
    else input.commissionChanges = items.map((i) => ({ key: i.key, included: i.included, rate: i.rate }))
    try {
      onSaved(await updatePayrollLine(line.id, input))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-3xl space-y-6 rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">{line.userName}</h3>
            <p className="text-sm text-muted-foreground">
              Tổng hiện tại: <span className="font-semibold text-foreground">{money(line.totals.total)}</span>
              {locked && ' · Bảng lương đã chốt (chỉ xem)'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="space-y-3">
          <h4 className="font-semibold text-foreground">Cách tính tháng này</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Hình thức</span>
              <select value={payType} disabled={locked} onChange={(e) => setPayType(e.target.value as 'MONTHLY' | 'HOURLY')} className={inputClass}>
                <option value="MONTHLY">Lương cứng</option>
                <option value="HOURLY">Theo giờ</option>
              </select>
            </label>
            {payType === 'MONTHLY' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Lương cứng cả tháng (₫)</span>
                  <input value={baseSalary} disabled={locked} inputMode="numeric" onChange={(e) => setBaseSalary(e.target.value)} className={inputClass} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Ngày nghỉ được hưởng / tháng</span>
                  <input type="number" min={0} max={15} value={daysOff} disabled={locked} onChange={(e) => setDaysOff(e.target.value)} className={inputClass} />
                </label>
              </>
            ) : (
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Đơn giá giờ ngày lễ (₫, trống = như ngày thường)</span>
                <input value={holidayRate} disabled={locked} inputMode="numeric" onChange={(e) => setHolidayRate(e.target.value)} className={inputClass} />
              </label>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Đơn giá giờ (₫), cũng dùng cho OT</span>
              <input value={hourlyRate} disabled={locked} inputMode="numeric" onChange={(e) => setHourlyRate(e.target.value)} className={inputClass} />
            </label>
            {(['makerRate', 'salesRate'] as const).map((field, i) => (
              <label key={field} className="space-y-1 text-sm">
                <span className="text-muted-foreground">% HH {['làm đơn', 'sale'][i]}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  disabled={locked}
                  value={rates[field]}
                  onChange={(e) => setRates((r) => ({ ...r, [field]: Number(e.target.value) }))}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          {line.payType === 'MONTHLY' && (
            <p className="text-xs text-muted-foreground">
              Ngày công {line.totals.daysWorked}/{line.totals.standardDays}: lương cứng chia theo số ngày đi làm.
            </p>
          )}
          {ratesChanged && (
            <p className="text-xs text-amber-700">Đổi % ở đây sẽ áp dụng cho mọi khoản hoa hồng cùng loại bên dưới khi lưu.</p>
          )}
          {line.ratesOverridden && (
            <p className="text-xs text-muted-foreground">Mức lương tháng này đã được sửa tay, không tự lấy theo hồ sơ lương nữa.</p>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground">
              Ca làm ({line.shifts.length}){' '}
              <span className="text-sm font-normal text-muted-foreground">· hệ số OT ×{otMultiplier}</span>
            </h4>
            {!locked && pendingDays > 0 && (
              <button
                type="button"
                onClick={() =>
                  setDecisions((d) => Object.fromEntries(Object.entries(d).map(([date, v]) => [date, v === 'PENDING' ? 'OT' : v])))
                }
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Duyệt OT {pendingDays} ngày chờ
              </button>
            )}
          </div>
          {line.shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có ca nào trong tháng.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Ngày</th>
                    <th className="px-3 py-2">Vào – Ra</th>
                    <th className="px-3 py-2">Trong khung</th>
                    <th className="px-3 py-2">Ngoài khung</th>
                    <th className="px-3 py-2">Tính</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {line.shifts.map((s) => (
                    <tr key={s.date} className={cn(decisions[s.date] === 'PENDING' && 'bg-amber-50', s.autoClosed && 'bg-red-50/60')}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {dayLabel(s.date)}
                        {s.holiday && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-800">Lễ</span>}
                        {s.corrected && <span className="ml-1 rounded bg-sky-100 px-1 text-xs text-sky-800">Sửa tay</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {time(s.checkIn)} – {s.autoClosed ? '?' : time(s.checkOut)}
                      </td>
                      <td className="px-3 py-2">{hours(s.regularHours)}</td>
                      <td className="px-3 py-2 font-medium">{s.otHours > 0.01 ? hours(s.otHours) : '—'}</td>
                      <td className="px-3 py-2">
                        {s.autoClosed ? (
                          <span className="text-xs font-medium text-red-700">Quên chấm ra – 0 giờ</span>
                        ) : (
                          <select
                            value={decisions[s.date]}
                            disabled={locked}
                            onChange={(e) => setDecisions((d) => ({ ...d, [s.date]: e.target.value as OtDecision }))}
                            className={inputClass}
                          >
                            {decisionsFor(s, payType).map((k) => (
                              <option key={k} value={k}>{DECISION_LABEL[k]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {hours(line.totals.regularHours)} giờ thường, {hours(line.totals.otHours)} OT
            {line.totals.rushHours > 0 ? `, ${hours(line.totals.rushHours)} ca gấp` : ''}
            {line.totals.holidayHours > 0 ? `, ${hours(line.totals.holidayHours)} ngày lễ` : ''}. Lệch dưới 15 phút ngoài khung được bỏ qua;
            ngày chờ duyệt tạm tính như OT.
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="font-semibold text-foreground">Hoa hồng ({items.length})</h4>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có khoản hoa hồng nào trong tháng.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2">Tính</th>
                    <th className="px-2 py-2">Loại</th>
                    <th className="px-2 py-2">Đơn</th>
                    <th className="px-2 py-2 text-right">Cơ sở</th>
                    <th className="px-2 py-2">%</th>
                    <th className="px-2 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, index) => (
                    <tr key={item.key} className={cn(!item.included && 'text-muted-foreground line-through')}>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={item.included}
                          disabled={locked || ratesChanged}
                          onChange={(e) => setItems((list) => list.map((x, i) => (i === index ? { ...x, included: e.target.checked } : x)))}
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{KIND_LABEL[item.kind]}</td>
                      <td className="px-2 py-2">
                        <span className="font-medium">{item.orderCode ?? '—'}</span>
                        <span className="block text-xs text-muted-foreground">{item.label}</span>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{money(item.base)}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={item.rate}
                          disabled={locked || ratesChanged}
                          onChange={(e) => setItems((list) => list.map((x, i) => (i === index ? { ...x, rate: Number(e.target.value) } : x)))}
                          className="w-20 rounded border border-border px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{money(Math.round((item.base * item.rate) / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Thưởng, phạt, tạm ứng, phụ cấp…</h4>
            {!locked && (
              <button
                type="button"
                onClick={() => setAdjustments((a) => [...a, { label: '', sign: 1, amount: '' }])}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm khoản
              </button>
            )}
          </div>
          {adjustments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khoản điều chỉnh.</p>}
          {adjustments.map((adj, index) => (
            <div key={index} className="flex gap-2">
              <input
                placeholder="Nội dung, ví dụ: Thưởng 20/10, Tạm ứng"
                value={adj.label}
                disabled={locked}
                onChange={(e) => setAdjustments((list) => list.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))}
                className={inputClass}
              />
              <select
                value={adj.sign}
                disabled={locked}
                onChange={(e) => setAdjustments((list) => list.map((x, i) => (i === index ? { ...x, sign: Number(e.target.value) as 1 | -1 } : x)))}
                className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm"
              >
                <option value={1}>Cộng</option>
                <option value={-1}>Trừ</option>
              </select>
              <input
                placeholder="Số tiền"
                value={adj.amount ? Number(digits(adj.amount)).toLocaleString('vi-VN') : ''}
                disabled={locked}
                inputMode="numeric"
                onChange={(e) => setAdjustments((list) => list.map((x, i) => (i === index ? { ...x, amount: e.target.value.replace(/\D/g, '') } : x)))}
                className="w-36 rounded-lg border border-border px-2 py-1.5 text-sm"
              />
              {!locked && (
                <button
                  type="button"
                  aria-label="Xoá khoản"
                  onClick={() => setAdjustments((list) => list.filter((_, i) => i !== index))}
                  className="rounded-lg border border-border px-2 hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </section>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-foreground">Ghi chú</span>
          <span className="block text-xs text-muted-foreground">Nhân viên sẽ thấy ghi chú này trong mục Thu nhập sau khi chốt lương.</span>
          <textarea value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 hover:bg-muted">
            {locked ? 'Đóng' : 'Huỷ'}
          </button>
          {!locked && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Someone has hours (or days) but no rate in their pay profile yet. */
const missingRate = (line: PayrollLine) =>
  line.payType === 'MONTHLY'
    ? line.baseSalary === 0 && line.totals.daysWorked > 0
    : line.hourlyRate === 0 && line.totals.regularHours > 0

export default function PayrollPage() {
  const [month, setMonth] = useState(thisMonth())
  const [payroll, setPayroll] = useState<Payroll | null | undefined>(undefined)
  const [editing, setEditing] = useState<PayrollLine | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [otMultiplier, setOtMultiplier] = useState('1.5')

  useEffect(() => {
    let active = true
    setPayroll(undefined)
    setError('')
    fetchPayroll(month)
      .then((p) => active && setPayroll(p))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Không tải được bảng lương'))
    return () => {
      active = false
    }
  }, [month])

  useEffect(() => {
    if (payroll) setOtMultiplier(String(payroll.otMultiplier))
  }, [payroll])

  const run = async (action: () => Promise<Payroll>) => {
    setBusy(true)
    setError('')
    try {
      setPayroll(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác không thành công')
    } finally {
      setBusy(false)
    }
  }

  const locked = payroll?.status === 'LOCKED'
  const canLock = monthOver(month)
  const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50'

  return (
    <div className="space-y-6 p-4 pb-20 md:p-8 md:pb-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bảng lương</h1>
          <p className="text-sm text-muted-foreground">
            Bảng lương dự kiến từ chấm công và đơn hàng. Sửa từng người, duyệt OT, rồi chốt sau khi hết tháng.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {payroll === undefined && !error && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {payroll === null && (
        <section className="space-y-3 rounded-3xl border border-dashed border-border bg-white/90 p-8 text-center">
          <p className="text-foreground">Chưa có bảng lương tháng {month.slice(5)}/{month.slice(0, 4)}.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => generatePayroll(month))}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Đang tạo…' : 'Tạo bảng lương nháp'}
          </button>
        </section>
      )}

      {payroll && (
        <>
          <section className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                locked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
              )}
            >
              {locked ? `Đã chốt${payroll.lockedByName ? ` · ${payroll.lockedByName}` : ''}` : 'Nháp'}
            </span>
            {!locked && (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => generatePayroll(month))} className={buttonClass}>
                  <RefreshCw className="h-4 w-4" /> Cập nhật dữ liệu mới
                </button>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  Hệ số OT ×
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={otMultiplier}
                    onChange={(e) => setOtMultiplier(e.target.value)}
                    onBlur={() =>
                      Number(otMultiplier) !== payroll.otMultiplier &&
                      run(() => updatePayrollSettings(payroll.id, { otMultiplier: Number(otMultiplier) }))
                    }
                    className="w-20 rounded-lg border border-border px-2 py-1.5"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !canLock}
                  title={canLock ? undefined : 'Chỉ chốt được khi đã hết tháng'}
                  onClick={() =>
                    confirm(`Chốt bảng lương tháng ${month.slice(5)}/${month.slice(0, 4)}? Hệ thống cập nhật dữ liệu mới nhất rồi chốt; sau đó không sửa được nữa.`) &&
                    run(() => lockPayroll(payroll.id))
                  }
                  className={buttonClass}
                >
                  <Lock className="h-4 w-4" /> Chốt bảng lương
                </button>
              </>
            )}
            {locked && (
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm('Mở khoá để sửa bảng lương đã chốt?') && run(() => unlockPayroll(payroll.id))}
                className={buttonClass}
              >
                <Unlock className="h-4 w-4" /> Mở khoá
              </button>
            )}
            <a href={`/api/payroll/export?month=${month}`} className={buttonClass}>
              <Download className="h-4 w-4" /> Xuất Excel
            </a>
            {!locked && (
              <span className="text-xs text-muted-foreground">
                Cập nhật lần cuối {dateTime(payroll.updatedAt)}
                {!canLock && ' · chốt được từ ngày 01 tháng sau'}
              </span>
            )}
          </section>

          {payroll.summary.pendingOtDays > 0 && !locked && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Còn <strong>{payroll.summary.pendingOtDays}</strong> ngày có giờ ngoài khung làm việc chưa duyệt (đang tạm tính như OT).
                Mở từng người để duyệt trước khi chốt.
              </p>
            </div>
          )}
          {payroll.summary.autoClosedDays > 0 && !locked && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <strong>{payroll.summary.autoClosedDays}</strong> ca quên chấm công ra đang tính 0 giờ. Sửa giờ ở màn Điểm danh
                rồi bấm &quot;Cập nhật dữ liệu mới&quot;.
              </p>
            </div>
          )}

          <section className="overflow-x-auto rounded-3xl border border-border bg-white/90 p-4 md:p-6">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-3 pr-3">Nhân viên</th>
                  <th className="px-3 py-3">Hình thức</th>
                  <th className="px-3 py-3">Giờ thường</th>
                  <th className="px-3 py-3">OT</th>
                  <th className="px-3 py-3 text-right">Lương</th>
                  <th className="px-3 py-3 text-right">Tiền OT</th>
                  <th className="px-3 py-3 text-right">Hoa hồng</th>
                  <th className="px-3 py-3 text-right">Điều chỉnh</th>
                  <th className="px-3 py-3 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payroll.lines.map((line) => (
                  <tr key={line.id} onClick={() => setEditing(line)} className="cursor-pointer hover:bg-muted/40">
                    <td className="py-3 pr-3 font-medium text-foreground underline-offset-2 hover:underline">
                      {line.userName}
                      {missingRate(line) && (
                        <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs font-normal text-red-700">Chưa có mức lương</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {line.payType === 'MONTHLY' ? `Lương cứng · ${line.totals.daysWorked}/${line.totals.standardDays} công` : 'Theo giờ'}
                    </td>
                    <td className="px-3 py-3">{hours(line.totals.regularHours)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {hours(line.totals.otHours + line.totals.rushHours)}
                      {line.totals.pendingOtDays > 0 && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{line.totals.pendingOtDays} chờ</span>
                      )}
                      {line.totals.autoClosedDays > 0 && (
                        <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs text-red-700">{line.totals.autoClosedDays} quên chấm ra</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{money(line.totals.basePay)}</td>
                    <td className="px-3 py-3 text-right">{money(line.totals.otPay)}</td>
                    <td className="px-3 py-3 text-right">{money(line.totals.commission)}</td>
                    <td className="px-3 py-3 text-right">{money(line.totals.adjustmentsTotal)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">{money(line.totals.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-3 pr-3" colSpan={8}>Tổng quỹ lương</td>
                  <td className="px-3 py-3 text-right">{money(payroll.summary.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}

      {editing && payroll && (
        <LineEditor
          line={editing}
          locked={locked}
          otMultiplier={payroll.otMultiplier}
          onClose={() => setEditing(null)}
          onSaved={setPayroll}
        />
      )}
    </div>
  )
}
