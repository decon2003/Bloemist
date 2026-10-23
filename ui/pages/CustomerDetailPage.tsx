'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { EditCustomerModal, SOURCE_LABELS } from '@/components/customer-edit-modal'
import { fetchCustomer } from '@/lib/api'
import { formatCurrencyFromNumber, formatDateTime } from '@/lib/utils'
import type { CustomerDetail } from '@/lib/types'

const dateOnly = (iso: string | null, lang: string) =>
  iso ? new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

export default function CustomerDetailPage({ customerId }: { customerId: string }) {
  const { lang, getOrderStatusLabel } = useLocale()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCustomer(customerId)
      .then((result) => !cancelled && setCustomer(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không tải được khách hàng'))
    return () => {
      cancelled = true
    }
  }, [customerId])

  return (
    <div className="space-y-6 p-4 pb-24 md:p-8 md:pb-12">
      <Link href={`/${lang}/customers`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Khách hàng
      </Link>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!customer && !error && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {customer && (
        <>
          <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{customer.name}</h1>
              <p className="text-muted-foreground">
                {customer.phone}
                {customer.source ? ` · ${SOURCE_LABELS[customer.source] ?? customer.source}` : ''}
                {customer.marketingConsent ? ' · Đồng ý nhận ưu đãi' : ''}
              </p>
              {customer.notes && <p className="mt-2 max-w-2xl italic text-muted-foreground">“{customer.notes}”</p>}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Pencil className="h-4 w-4" /> Sửa thông tin
            </button>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Tổng chi tiêu" value={formatCurrencyFromNumber(customer.totalSpend)} />
            <Stat label="Số đơn" value={String(customer.orderCount)} />
            <Stat label="Đơn đầu tiên" value={dateOnly(customer.firstOrderAt, lang)} />
            <Stat label="Mua gần nhất" value={dateOnly(customer.lastOrderAt, lang)} />
          </div>

          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-3 font-semibold text-foreground">Người nhận ({customer.receivers.length})</h2>
            {customer.receivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {customer.receivers.map((r) => (
                  <li key={`${r.receiverName}|${r.receiverPhone}`} className="flex flex-col gap-1 py-2 md:flex-row md:items-center md:justify-between">
                    <span>
                      <span className="font-medium text-foreground">{r.receiverName}</span>
                      <span className="text-muted-foreground"> · {r.receiverPhone}</span>
                      {r.deliveryAddress && <span className="text-muted-foreground"> · {r.deliveryAddress}</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {r.count} lần · gần nhất {dateOnly(r.lastAt, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-3 font-semibold text-foreground">Lịch sử đơn ({customer.orders.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Đơn</th>
                    <th className="py-2 pr-3">Ngày nhận</th>
                    <th className="py-2 pr-3">Sản phẩm</th>
                    <th className="py-2 pr-3">Người nhận</th>
                    <th className="py-2 pr-3">Sale</th>
                    <th className="py-2 pr-3">Trạng thái</th>
                    <th className="py-2 text-right">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((o) => (
                    <tr key={o.id} className={`border-t border-border ${o.status === 'CANCELLED' ? 'text-muted-foreground line-through' : ''}`}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Link href={`/${lang}/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.code}</Link>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(o.receiveTime, lang)}</td>
                      <td className="py-2 pr-3">{o.bouquetName}</td>
                      <td className="py-2 pr-3">{o.receiverName}</td>
                      <td className="py-2 pr-3">{o.salespersonName ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{o.status === 'CANCELLED' ? 'Đã huỷ' : getOrderStatusLabel(o.status)}</td>
                      <td className="py-2 text-right whitespace-nowrap">{formatCurrencyFromNumber(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {editing && (
            <EditCustomerModal
              customer={customer}
              onClose={() => setEditing(false)}
              onSaved={(updated) => {
                setCustomer((current) => (current ? { ...current, ...updated } : current))
                setEditing(false)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
