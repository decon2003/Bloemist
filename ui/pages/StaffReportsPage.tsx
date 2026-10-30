'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { Users, ShoppingBag, ClipboardList, Search, Filter, Settings, X, Save } from 'lucide-react'
import { StaffProfile, User } from '@/lib/types'
import { formatDateTime, parseCurrencyToNumber, formatCurrencyFromNumber, formatCurrencyInput } from '@/lib/utils'
import { useLocale } from '@/components/providers/locale-provider'
import { useAuth } from '@/components/providers/auth-provider'
import { useAppData } from '@/components/providers/app-data-provider'
import { fetchStaffReport } from '@/lib/api'
import { DateInputVN } from '@/components/date-input-vn'

const formatInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface StaffReportRow {
  profile: StaffProfile & { baseSalary?: string; commissionRate?: number }
  checkins: number
  hours: number
  orders: number
  tasks: number
  tasksInProgress: number
  tasksCompleted: number
  salary: number
  commissionAmount: number
  lastSeen: string | null
  lastLocation: string | null
}

/** Default pay profile: pre-fills each month's payroll draft, where every
 *  figure can still be changed for that month. */
function SalaryConfigModal({ user, onClose, onSave }: { user: User, onClose: () => void, onSave: (id: string, data: Partial<User>) => Promise<any> }) {
  const [payType, setPayType] = useState<'MONTHLY' | 'HOURLY'>(user.payType ?? 'MONTHLY')
  const [base, setBase] = useState(String(user.baseSalary ?? 0))
  const [hourly, setHourly] = useState(String(user.hourlyRate ?? 0))
  const [makerRate, setMakerRate] = useState(String(user.commissionRate ?? 0))
  const [salesRate, setSalesRate] = useState(String(user.salesCommissionRate ?? 0))
  const [holidayRate, setHolidayRate] = useState(user.holidayHourlyRate == null ? '' : String(user.holidayHourlyRate))
  const [onlineRate, setOnlineRate] = useState(user.onlineHourlyRate == null ? '' : String(user.onlineHourlyRate))
  const [otRate, setOtRate] = useState(user.otHourlyRate == null ? '' : String(user.otHourlyRate))
  const [allowances, setAllowances] = useState((user.allowances ?? []).map((a) => ({ label: a.label, amount: String(a.amount) })))
  const isSales = user.role === 'sales'
  const [daysOff, setDaysOff] = useState(String(user.daysOffPerMonth ?? 4))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(user.id, {
        payType,
        baseSalary: Number(base.replace(/\D/g, '') || 0),
        hourlyRate: Number(hourly.replace(/\D/g, '') || 0),
        // Sales earn the sales commission only.
        commissionRate: isSales ? 0 : Number(makerRate),
        salesCommissionRate: Number(salesRate),
        holidayHourlyRate: !isSales && holidayRate.trim() ? Number(holidayRate.replace(/\D/g, '') || 0) : null,
        onlineHourlyRate: isSales && onlineRate.trim() ? Number(onlineRate.replace(/\D/g, '') || 0) : null,
        otHourlyRate: !isSales && otRate.trim() ? Number(otRate.replace(/\D/g, '') || 0) : null,
        allowances: allowances
          .filter((a) => a.label.trim() || a.amount)
          .map((a) => ({ label: a.label.trim(), amount: Number(a.amount || 0) })),
        daysOffPerMonth: Number(daysOff),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-border p-2 text-sm'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Hồ sơ lương · {user.name}</h3>
          <button onClick={onClose} aria-label="Đóng"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Mức mặc định để điền sẵn bảng lương mỗi tháng. Trong bảng lương vẫn sửa được riêng cho từng tháng.
        </p>
        <label className="block text-sm font-medium">
          Hình thức lương
          <select value={payType} onChange={(e) => setPayType(e.target.value as 'MONTHLY' | 'HOURLY')} className={field}>
            <option value="MONTHLY">Lương cứng (thợ chính)</option>
            <option value="HOURLY">Theo giờ (sale, thợ phụ)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Lương cứng / tháng
            <input value={formatCurrencyInput(base)} disabled={payType !== 'MONTHLY'} onChange={(e) => setBase(e.target.value.replace(/\D/g, ''))} className={field} />
          </label>
          <label className="block text-sm font-medium">
            Đơn giá / giờ
            <input value={formatCurrencyInput(hourly)} onChange={(e) => setHourly(e.target.value.replace(/\D/g, ''))} className={field} />
          </label>
        </div>
        {!isSales && (<>
        <label className="block text-sm font-medium">
          Đơn giá tăng ca / giờ
          <input
            value={formatCurrencyInput(otRate)}
            placeholder="Trống = như đơn giá giờ"
            onChange={(e) => setOtRate(e.target.value.replace(/\D/g, ''))}
            className={field}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Trả cho giờ tăng ca đã được quản lý duyệt và ca gấp, kể cả người lương cứng. Ngoài khung dưới 10 phút không tính.
        </p>
        </>)}
        {isSales && <p className="text-xs text-muted-foreground">Sale không tính tăng ca: mọi giờ làm tính theo đơn giá giờ.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Ngày nghỉ được hưởng / tháng
            <input type="number" min={0} max={15} value={daysOff} disabled={payType !== 'MONTHLY'} onChange={(e) => setDaysOff(e.target.value)} className={field} />
          </label>
          {isSales ? (
            <label className="block text-sm font-medium">
              Đơn giá giờ online (tại nhà)
              <input
                value={formatCurrencyInput(onlineRate)}
                disabled={payType !== 'HOURLY'}
                placeholder="Như tại cửa hàng"
                onChange={(e) => setOnlineRate(e.target.value.replace(/\D/g, ''))}
                className={field}
              />
            </label>
          ) : (
            <label className="block text-sm font-medium">
              Đơn giá giờ ngày lễ
              <input
                value={formatCurrencyInput(holidayRate)}
                disabled={payType !== 'HOURLY'}
                placeholder="Như ngày thường"
                onChange={(e) => setHolidayRate(e.target.value.replace(/\D/g, ''))}
                className={field}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Lương cứng chia theo ngày công: lương × số ngày đi làm ÷ (số ngày trong tháng − ngày nghỉ được hưởng).
          Ngày lễ khai báo ở Cài đặt; người lương cứng và sale ngày lễ tính như ngày thường. Ca online của sale tính đơn giá
          online cho mọi giờ, không tính OT.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ...(isSales ? [] : [['% HH làm đơn', makerRate, setMakerRate] as const]),
            ['% HH sale', salesRate, setSalesRate] as const,
          ]).map(([label, value, set]) => (
            <label key={label} className="block text-sm font-medium">
              {label}
              <input type="number" min={0} max={100} step={0.5} value={value} onChange={(e) => set(e.target.value)} className={field} />
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Phụ cấp cố định / tháng</span>
            <button
              type="button"
              onClick={() => setAllowances((list) => [...list, { label: '', amount: '' }])}
              className="text-sm font-medium text-primary hover:underline"
            >
              + Thêm phụ cấp
            </button>
          </div>
          {allowances.map((a, index) => (
            <div key={index} className="flex gap-2">
              <input
                placeholder="Ví dụ: Ăn uống"
                aria-label={`Tên phụ cấp ${index + 1}`}
                value={a.label}
                onChange={(e) => setAllowances((list) => list.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-lg border border-border p-2 text-sm"
              />
              <input
                placeholder="Số tiền"
                aria-label={`Số tiền phụ cấp ${index + 1}`}
                inputMode="numeric"
                value={formatCurrencyInput(a.amount)}
                onChange={(e) => setAllowances((list) => list.map((x, i) => (i === index ? { ...x, amount: e.target.value.replace(/\D/g, '') } : x)))}
                className="w-32 rounded-lg border border-border p-2 text-sm"
              />
              <button
                type="button"
                aria-label="Xoá phụ cấp"
                onClick={() => setAllowances((list) => list.filter((_, i) => i !== index))}
                className="rounded-lg border border-border px-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Trả đủ mỗi tháng, không trừ theo ngày nghỉ.</p>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">Huỷ</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : <><Save className="h-4 w-4" /> Lưu</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StaffReportsPage() {
  const { lang } = useLocale()
  const { user } = useAuth()
  const { users, updateUser } = useAppData()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [editingConfigUser, setEditingConfigUser] = useState<User | null>(null)

  const dateInputValue = useMemo(() => formatInputDate(selectedDate), [selectedDate])

  const handleDateChange = useCallback((value: string) => {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return
    setSelectedDate(new Date(year, month - 1, day))
  }, [])

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'long' }),
    [lang],
  )

  // Pay and attendance are computed on the server for just this month
  // (lib/server/staff-report.ts) instead of from every order/task in the browser.
  const monthKey = useMemo(
    () => `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`,
    [selectedDate],
  )
  const [staffReports, setStaffReports] = useState<StaffReportRow[]>([])
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportVersion, setReportVersion] = useState(0)

  useEffect(() => {
    let active = true
    setReportError(null)
    fetchStaffReport(monthKey)
      .then((report) => active && setStaffReports(report.rows as StaffReportRow[]))
      .catch((error) => active && setReportError(error instanceof Error ? error.message : 'Không tải được báo cáo'))
    return () => {
      active = false
    }
  }, [monthKey, reportVersion])

  const saveSalaryConfig = useCallback(
    async (userId: string, input: Partial<User>) => {
      const updated = await updateUser(userId, input)
      setReportVersion((version) => version + 1)
      return updated
    },
    [updateUser],
  )

  const totals = useMemo(
    () =>
      staffReports.reduce(
        (acc, row) => {
          acc.headcount += 1
          acc.orders += row.orders
          acc.tasks += row.tasks
          return acc
        },
        { headcount: 0, orders: 0, tasks: 0 },
      ),
    [staffReports],
  )

  const filteredStaffReports = useMemo(
    () =>
      staffReports.filter((row) => {
        return !searchTerm || row.profile.name.toLowerCase().includes(searchTerm.toLowerCase())
      }),
    [staffReports, searchTerm],
  )

  const roleLabel = (specialty: string) => {
    switch (specialty) {
      case 'sales':
        return 'Sale'
      case 'florist':
        return 'Thợ hoa'
      default:
        return 'Quản trị viên'
    }
  }

  const monthLabel = useMemo(
    () => `${monthFormatter.format(selectedDate)} ${selectedDate.getFullYear()}`,
    [selectedDate, monthFormatter],
  )

  const handleOpenConfig = (userId: string) => {
    const u = users.find(u => u.id === userId)
    if (u) setEditingConfigUser(u)
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      {editingConfigUser && (
        <SalaryConfigModal
          user={editingConfigUser}
          onClose={() => setEditingConfigUser(null)}
          onSave={saveSalaryConfig}
        />
      )}

      <div>

        <h1 className="mt-1 text-3xl font-bold text-foreground">Báo cáo nhân sự</h1>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Nhân sự đang hoạt động</p>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.headcount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Đơn hàng đã xử lý</p>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.orders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Công việc đã hoàn thành</p>
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{totals.tasks}</p>
        </div>
      </div>

      {/* Main Table Section */}
      {reportError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{reportError}</div>
      )}

      <section className="rounded-3xl border border-border bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Danh sách điểm danh tháng</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm nhân viên"
                className="w-40 bg-transparent text-sm focus:outline-none"
              />
            </div>
            <DateInputVN
              value={dateInputValue}
              onChange={(value) => value && handleDateChange(value)}
              className="w-40 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none"
            />
          </div>
        </div>

        {filteredStaffReports.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Chưa có hoạt động nhân sự trong tháng này.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Nhân viên</th>
                  <th className="px-4 py-3 font-medium">Vai trò</th>
                  <th className="px-4 py-3 font-medium">Chấm công</th>
                  <th className="px-4 py-3 font-medium">Giờ làm</th>
                  <th className="px-4 py-3 font-medium">Đơn hàng</th>
                  <th className="px-4 py-3 font-medium">Công việc phụ trách</th>
                  <th className="px-4 py-3 font-medium">Hồ sơ lương</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaffReports.map((row) => (
                  <tr key={row.profile.id} className="text-foreground hover:bg-gray-50/50">
                    <td className="py-4 pr-4 align-top">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold">{row.profile.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.lastSeen
                              ? `${'Gần nhất'}: ${formatDateTime(row.lastSeen, lang)}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{roleLabel(row.profile.specialty)}</td>
                    <td className="px-4 py-4 align-top font-medium">
                      {row.checkins}
                    </td>
                    <td className="px-4 py-4 align-top font-medium">
                      {`${Math.floor(row.hours)}h${String(Math.round((row.hours % 1) * 60)).padStart(2, '0')}`}
                    </td>
                    <td className="px-4 py-4 align-top">{row.orders}</td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold">
                        {row.tasksInProgress}/{row.tasksCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground">Đang làm / Hoàn tất</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div>
                          {(() => {
                            const profile = users.find((u) => u.id === row.profile.id)
                            if (!profile) return <p className="text-xs text-muted-foreground">—</p>
                            return (
                              <p className="text-xs text-muted-foreground">
                                {profile.payType === 'HOURLY'
                                  ? `Theo giờ ${formatCurrencyFromNumber(profile.hourlyRate ?? 0)}/h`
                                  : `Lương cứng ${formatCurrencyFromNumber(profile.baseSalary ?? 0)}`}
                                {` · HH làm đơn ${profile.commissionRate ?? 0}% · HH sale ${profile.salesCommissionRate ?? 0}%`}
                              </p>
                            )
                          })()}
                          <a href="payroll" className="text-xs font-medium text-primary hover:underline">Xem bảng lương →</a>
                        </div>
                        <button
                          onClick={() => handleOpenConfig(row.profile.id)}
                          className="rounded-full p-1 hover:bg-gray-200 text-gray-500"
                          title="Sửa hồ sơ lương"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
