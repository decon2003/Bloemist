'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Merge, Pencil, X } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { EditCustomerModal, SOURCE_LABELS, inputClass } from '@/components/customer-edit-modal'
import { fetchCustomer, fetchCustomers, mergeCustomer } from '@/lib/api'
import { formatCurrencyFromNumber, formatDateTime } from '@/lib/utils'
import type { CustomerDetail, CustomerSummary } from '@/lib/types'

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

/** Merge this (duplicate) customer into another one found by name or phone. */
function MergeModal({ customer, onClose, onMerge }: {
  customer: CustomerDetail
  onClose: () => void
  onMerge: (target: { id: string; name: string; phone: string }) => void
}) {
  const [query, setQuery] = useState(customer.name)
  const [results, setResults] = useState<CustomerSummary[]>([])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!query.trim()) return setResults([])
      fetchCustomers({ q: query.trim() })
        .then((page) => !cancelled && setResults(page.items.filter((c) => c.id !== customer.id)))
        .catch(() => !cancelled && setResults([]))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, customer.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">Gộp khách</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Chọn khách đúng. {customer.orders.length} đơn của <b>{customer.name} · {customer.phone}</b> sẽ chuyển sang khách đó
          (SĐT trên các đơn đổi theo), ghi chú được gộp lại, khách này bị xoá.
        </p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên hoặc SĐT" className={inputClass} />
        <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
          {results.map((c) => (
            <li key={c.id}>
              <button onClick={() => onMerge(c)} className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-muted">
                <span>
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-muted-foreground"> · {c.phone}</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.orderCount} đơn</span>
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && <li className="py-2 text-muted-foreground">Không tìm thấy khách khác.</li>}
        </ul>
      </div>
    </div>
  )
}

export default function CustomerDetailPage({ customerId }: { customerId: string }) {
  const { lang, getOrderStatusLabel } = useLocale()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [merging, setMerging] = useState(false)
  const router = useRouter()

  const mergeInto = async (target: { id: string; name: string; phone: string }) => {
    if (!customer) return
    if (!window.confirm(`Gộp ${customer.name} · ${customer.phone} vào ${target.name} · ${target.phone}? Không hoàn tác được.`)) return
    try {
      await mergeCustomer(customer.id, target.id)
      router.push(`/${lang}/customers/${target.id}`)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không gộp được')
    }
  }

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
            <div className="flex gap-2 self-start">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <Pencil className="h-4 w-4" /> Sửa thông tin
              </button>
              <button
                onClick={() => setMerging(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <Merge className="h-4 w-4" /> Gộp khách
              </button>
            </div>
          </header>

          {customer.possibleDuplicates.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Có thể trùng khách (cùng tên, khác SĐT). Nếu là một người, gộp vào số đúng:</p>
              <div className="flex flex-wrap gap-2">
                {customer.possibleDuplicates.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2 py-1">
                    <Link href={`/${lang}/customers/${d.id}`} className="font-medium hover:underline">{d.name} · {d.phone}</Link>
                    <button onClick={() => mergeInto(d)} className="text-xs font-semibold text-primary hover:underline">
                      Gộp vào số này
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

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

          {merging && <MergeModal customer={customer} onClose={() => setMerging(false)} onMerge={mergeInto} />}
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
