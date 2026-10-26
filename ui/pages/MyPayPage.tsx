'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lock, Info } from 'lucide-react'
import { fetchMyPay } from '@/lib/api'
import { useLocale } from '@/components/providers/locale-provider'
import type { MyPay, OtDecision, PayrollCommission } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MonthInputVN } from '@/components/date-input-vn'

const VN = 'Asia/Ho_Chi_Minh'
const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`
const hours = (h: number) => {
  const minutes = Math.round(h * 60)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}
const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: VN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '—'
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: VN }).format(new Date()).slice(0, 7)

const OT_LABEL: Record<Exclude<OtDecision, 'NONE'>, string> = {
  PENDING: 'Chờ duyệt',
  OT: 'Tính OT',
  REGULAR: 'Tính giờ thường',
  EXCLUDE: 'Không tính',
  RUSH: 'Ca gấp (tính OT)',
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-white p-4', strong && 'border-primary/40 bg-primary/5')}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-semibold text-foreground', strong ? 'text-2xl' : 'text-lg')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Products made (maker commission) or orders sold (sales commission). */
function CommissionTable({ title, empty, items, labelHeader, lang }: {
  title: string
  empty: string
  items: PayrollCommission[]
  labelHeader: string
  lang: string
}) {
  const earned = items.filter((c) => c.included).reduce((sum, c) => sum + Math.round((c.base * c.rate) / 100), 0)
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-foreground">{title} ({items.length})</h2>
        <span className="text-sm font-semibold text-foreground">{money(earned)}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Đơn</th>
                <th className="py-2 pr-3">{labelHeader}</th>
                <th className="py-2 pr-3 text-right">Giá tính</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 text-right">Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.key} className={cn('border-t border-border', !c.included && 'text-muted-foreground line-through')}>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {c.orderId ? (
                      <Link href={`/${lang}/orders/${c.orderId}`} className="font-medium text-primary hover:underline">
                        {c.orderCode ?? 'Xem'}
                      </Link>
                    ) : (c.orderCode ?? '—')}
                  </td>
                  <td className="py-2 pr-3">{c.label}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{money(c.base)}</td>
                  <td className="py-2 pr-3 text-right">{c.rate}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {c.included ? money(Math.round((c.base * c.rate) / 100)) : 'Không tính'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function MyPayPage() {
  const { lang } = useLocale()
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<MyPay | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMyPay(month)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được dữ liệu') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [month])

  const line = data?.month === month ? data.line : null
  const t = line?.totals
  const makerItems = line?.commissions.filter((c) => c.kind === 'MAKER') ?? []
  const salesItems = line?.commissions.filter((c) => c.kind === 'SALES') ?? []
  const shifts = line?.shifts ?? []

  return (
    <div className="space-y-6 p-4 pb-24 md:p-8 md:pb-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Thu nhập</h1>
          <p className="text-muted-foreground">Giờ công, sản phẩm đã làm, đơn đã sale và lương trong tháng</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Tháng
          <MonthInputVN
            value={month}
            max={thisMonth()}
            onChange={setMonth}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </header>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !line && !error && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {data?.month === month && (
        data.status === 'LOCKED' ? (
          <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Bảng lương tháng {month.slice(5)}/{month.slice(0, 4)} đã chốt
              {data.lockedAt ? ` ngày ${new Intl.DateTimeFormat('vi-VN', { timeZone: VN }).format(new Date(data.lockedAt))}` : ''}.
              Đây là số chính thức.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Tạm tính</b> theo chấm công và đơn hàng đến hiện tại. Quản lý sẽ duyệt giờ OT, thưởng/khấu trừ
              và chốt số chính thức cuối tháng.
            </span>
          </div>
        )
      )}

      {data?.month === month && !line && (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-8 text-center text-muted-foreground">
          Bạn không có trong bảng lương tháng này.
        </p>
      )}

      {line && t && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat
              label={line.payType === 'MONTHLY' ? 'Lương cứng' : 'Lương theo giờ'}
              value={money(t.basePay)}
              hint={
                line.payType === 'MONTHLY'
                  ? `${t.daysWorked}/${t.standardDays} ngày công`
                  : `${hours(t.regularHours)} giờ${t.onlineHours > 0 ? ` (${hours(t.onlineHours)} online)` : ''}${t.holidayHours > 0 ? ` (${hours(t.holidayHours)} ngày lễ)` : ''}`
              }
            />
            <Stat
              label="Tiền OT"
              value={money(t.otPay)}
              hint={`${hours(t.otHours + t.rushHours)} × ${data!.otMultiplier}${t.pendingOtDays ? ` · ${t.pendingOtDays} ngày chờ duyệt` : ''}`}
            />
            {line.role !== 'sales' && (
              <Stat label="HH làm đơn" value={money(t.commissionByKind.MAKER)} hint={`${makerItems.length} sản phẩm · ${line.makerRate}%`} />
            )}
            <Stat label="HH sale" value={money(t.commissionByKind.SALES)} hint={`${salesItems.length} đơn · ${line.salesRate}%`} />
            <Stat
              label="Thưởng / khấu trừ"
              value={money(t.adjustmentsTotal)}
              hint={data!.status === 'LOCKED' ? `${line.adjustments.length} khoản` : 'Có khi chốt lương'}
            />
            <Stat label={data!.status === 'LOCKED' ? 'Thực nhận' : 'Tổng tạm tính'} value={money(t.total)} strong />
          </div>

          {line.adjustments.length > 0 && (
            <section className="rounded-2xl border border-border bg-white p-5">
              <h2 className="mb-3 font-semibold text-foreground">Thưởng / khấu trừ</h2>
              <ul className="space-y-1 text-sm">
                {line.adjustments.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{a.label}</span>
                    <span className={cn('font-medium', a.amount < 0 ? 'text-red-700' : 'text-foreground')}>{money(a.amount)}</span>
                  </li>
                ))}
              </ul>
              {line.note && <p className="mt-3 text-sm text-muted-foreground">Ghi chú: {line.note}</p>}
            </section>
          )}

          {(makerItems.length > 0 || line.role === 'florist') && (
            <CommissionTable
              title="Sản phẩm đã làm"
              empty="Chưa có sản phẩm nào hoàn thành trong tháng."
              items={makerItems}
              labelHeader="Sản phẩm"
              lang={lang}
            />
          )}
          {(salesItems.length > 0 || line.role === 'sales') && (
            <CommissionTable
              title="Đơn đã sale"
              empty="Chưa có đơn nào trong tháng."
              items={salesItems}
              labelHeader="Khách hàng"
              lang={lang}
            />
          )}

          <section className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-semibold text-foreground">Ca làm ({shifts.length})</h2>
              <span className="text-sm text-muted-foreground">
                {hours(t.regularHours)} giờ thường · {hours(t.otHours + t.rushHours)} OT
              </span>
            </div>
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có ca nào đã chấm ra trong tháng.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ngày</th>
                      <th className="py-2 pr-3">Vào</th>
                      <th className="py-2 pr-3">Ra</th>
                      <th className="py-2 pr-3 text-right">Giờ làm</th>
                      <th className="py-2 pr-3 text-right">Ngoài giờ</th>
                      <th className="py-2">OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s.date} className="border-t border-border">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {dayLabel(s.date)}
                          {s.holiday && s.mode !== 'ONLINE' && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-800">Lễ</span>}
                          {s.mode === 'ONLINE' && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-800">Online</span>}
                        </td>
                        <td className="py-2 pr-3">{time(s.checkIn)}</td>
                        <td className="py-2 pr-3">
                          {s.autoClosed ? (
                            <span className="text-xs font-medium text-red-700">Quên chấm ra – 0 giờ</span>
                          ) : (
                            time(s.checkOut)
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{hours(s.hours)}</td>
                        <td className="py-2 pr-3 text-right">{s.otHours > 0.01 ? hours(s.otHours) : '—'}</td>
                        <td className="py-2">
                          {s.otDecision === 'NONE' ? '—' : (
                            <span className={cn('text-xs font-medium', s.otDecision === 'PENDING' ? 'text-amber-700' : 'text-foreground')}>
                              {OT_LABEL[s.otDecision]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
