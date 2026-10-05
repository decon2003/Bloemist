'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { fetchCustomers, updateCustomer } from '@/lib/api'
import { formatCurrencyFromNumber, formatDateTime } from '@/lib/utils'
import type { CustomerPage, CustomerSource, CustomerSummary } from '@/lib/types'

type Sort = 'spend' | 'recent' | 'orders'

const SOURCE_LABELS: Record<CustomerSource, string> = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  instagram: 'Instagram',
  walk_in: 'Khách vãng lai',
  referral: 'Được giới thiệu',
  other: 'Khác',
}

const inputClass =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerSummary
  onClose: () => void
  onSaved: (updated: CustomerSummary) => void
}) {
  const [name, setName] = useState(customer.name)
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [source, setSource] = useState<CustomerSource | ''>(customer.source ?? '')
  const [marketingConsent, setMarketingConsent] = useState(customer.marketingConsent)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setIsSaving(true)
    setError('')
    try {
      onSaved(await updateCustomer(customer.id, { name, notes, source: source || null, marketingConsent }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">{customer.phone}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block space-y-1 text-sm font-medium text-foreground">
          <span>Tên khách</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium text-foreground">
          <span>Ghi chú</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Ví dụ: thích hoa trắng, không lấy hoa ly, sinh nhật vợ 12/3"
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium text-foreground">
          <span>Nguồn khách</span>
          <select value={source} onChange={(e) => setSource(e.target.value as CustomerSource | '')} className={inputClass}>
            <option value="">Chưa rõ</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1"
          />
          <span>Khách đồng ý nhận tin nhắn ưu đãi / quảng cáo</span>
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted">
            Huỷ
          </button>
          <button
            onClick={save}
            disabled={isSaving || !name.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const { t, lang } = useLocale()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<Sort>('spend')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CustomerPage | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<CustomerSummary | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setError('')
    fetchCustomers({ q: debouncedQuery, sort, page })
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không tải được danh sách khách'))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, sort, page])

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 md:pb-12">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('customers.subtitle')}</p>
        <h1 className="text-3xl font-bold text-foreground">{t('customers.title')}</h1>
        <p className="text-muted-foreground">
          {data ? `${data.total} khách hàng` : t('customers.subtitleHelper', 'Khách mua lại nhiều nhất và bó hoa gần đây.')}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc số điện thoại"
            className={`${inputClass} pl-9`}
          />
        </label>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort)
            setPage(1)
          }}
          className={`${inputClass} md:w-56`}
        >
          <option value="spend">Chi tiêu nhiều nhất</option>
          <option value="orders">Nhiều đơn nhất</option>
          <option value="recent">Mua gần đây nhất</option>
        </select>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((customer) => (
          <button
            key={customer.id}
            onClick={() => setEditing(customer)}
            className="text-left rounded-2xl border border-border bg-white/90 p-5 shadow-sm hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">{customer.name}</h2>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
              {customer.source && (
                <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {SOURCE_LABELS[customer.source] ?? customer.source}
                </span>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('customers.lifetimeSpend')}</dt>
                <dd className="text-xl font-bold text-primary">{formatCurrencyFromNumber(customer.totalSpend)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('customers.orders', 'Số đơn')}</dt>
                <dd className="text-xl font-semibold text-foreground">{customer.orderCount}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              {customer.lastOrderAt && (
                <p>
                  Mua gần nhất: <span className="text-foreground">{formatDateTime(customer.lastOrderAt, lang)}</span>
                  {customer.lastBouquet ? ` · ${customer.lastBouquet}` : ''}
                </p>
              )}
              {customer.notes && <p className="line-clamp-2 italic">“{customer.notes}”</p>}
            </div>
          </button>
        ))}
      </div>

      {data && data.items.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Không tìm thấy khách hàng nào.</p>
      )}

      {data && pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg border border-border disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-muted-foreground">
            Trang {page}/{pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="px-3 py-2 rounded-lg border border-border disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      {editing && (
        <EditCustomerModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setData((current) =>
              current ? { ...current, items: current.items.map((c) => (c.id === updated.id ? updated : c)) } : current,
            )
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
