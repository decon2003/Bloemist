'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { useLocale } from '@/components/providers/locale-provider'
import { fetchCustomers } from '@/lib/api'
import { SOURCE_LABELS, inputClass } from '@/components/customer-edit-modal'
import { formatCurrencyFromNumber, formatDateTime } from '@/lib/utils'
import type { CustomerPage } from '@/lib/types'

type Sort = 'spend' | 'recent' | 'orders'

export default function CustomersPage() {
  const { lang } = useLocale()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<Sort>('spend')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CustomerPage | null>(null)
  const [error, setError] = useState('')

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
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Quan hệ khách hàng</p>
        <h1 className="text-3xl font-bold text-foreground">Khách hàng</h1>
        <p className="text-muted-foreground">
          {data ? `${data.total} khách hàng` : 'Khách mua lại nhiều nhất và bó hoa gần đây.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên, SĐT khách hoặc người nhận"
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
          <Link
            key={customer.id}
            href={`/${lang}/customers/${customer.id}`}
            className="block text-left rounded-2xl border border-border bg-white/90 p-5 shadow-sm hover:border-primary/50 transition-colors"
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
                <dt className="text-muted-foreground">Chi tiêu tích luỹ</dt>
                <dd className="text-xl font-bold text-primary">{formatCurrencyFromNumber(customer.totalSpend)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Số đơn</dt>
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
          </Link>
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

    </div>
  )
}
