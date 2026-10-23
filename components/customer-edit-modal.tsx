'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { updateCustomer } from '@/lib/api'
import type { CustomerSource, CustomerSummary } from '@/lib/types'

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  instagram: 'Instagram',
  walk_in: 'Khách vãng lai',
  referral: 'Được giới thiệu',
  other: 'Khác',
}

export const inputClass =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

export function EditCustomerModal({
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
