'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { fetchBouquets } from '@/lib/api'
import type { BouquetSuggestion, CreateOrderInput, Florist, Order } from '@/lib/types'
import { formatCurrencyInput } from '@/lib/utils'

const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`
type Line = { name: string; quantity: string; unitPrice: string }
const blankLine = (): Line => ({ name: '', quantity: '1', unitPrice: '' })

/** "Bán tại quầy": a customer at the counter pays and takes the flowers at
 *  once. Saved as an order that is paid in full and delivered now; the
 *  florist who made the bouquet earns the making commission as usual. */
export function WalkInDialog({
  florists,
  onCreate,
  onClose,
  onDone,
}: {
  florists: Florist[]
  onCreate: (input: CreateOrderInput) => Promise<Order>
  onClose: () => void
  onDone: (order: Order) => void
}) {
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [makerId, setMakerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [suggestions, setSuggestions] = useState<BouquetSuggestion[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // One id per sale: a retried "Lưu" never records the sale twice.
  const [requestId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    fetchBouquets().then(setSuggestions).catch(() => setSuggestions([]))
  }, [])

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.unitPrice || 0) * Math.max(Number(l.quantity) || 0, 0), 0),
    [lines],
  )
  const setLine = (index: number, patch: Partial<Line>) => {
    setError('')
    setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const save = async () => {
    setError('')
    const filled = lines.filter((l) => l.name.trim())
    if (!filled.length) return setError('Nhập tên sản phẩm')
    if (filled.some((l) => Number(l.unitPrice || 0) < 1000)) return setError('Nhập đơn giá cho từng sản phẩm (từ 1.000 ₫)')
    if (filled.some((l) => !(Number(l.quantity) >= 1))) return setError('Số lượng phải từ 1')
    if (!makerId) return setError('Chọn thợ đã làm bó hoa')
    setSaving(true)
    try {
      // The server sets the time, pickup, the price from the products and "paid in full".
      const order = await onCreate({
        walkIn: true,
        requestId,
        assigneeId: makerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        receiverName: '',
        receiverPhone: '',
        bouquetName: filled[0].name.trim(),
        receiveTime: new Date().toISOString(),
        deliveryType: 'PICKUP',
        listedPrice: total,
        products: filled.map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      })
      onDone(order)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setSaving(false)
    }
  }

  const field = 'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Bán tại quầy</h2>
            <p className="text-sm text-muted-foreground">Khách trả tiền và lấy hoa luôn. Đơn được ghi là đã thanh toán đủ, đã giao.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <datalist id="walk-in-bouquets">
          {suggestions.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-muted/20 p-3">
              <label className="col-span-2 space-y-1 text-sm font-medium">
                <span>Sản phẩm</span>
                <input
                  list="walk-in-bouquets"
                  aria-label={`Sản phẩm ${index + 1}`}
                  value={line.name}
                  onChange={(e) => setLine(index, { name: e.target.value })}
                  className={field}
                />
              </label>
              <div className="col-span-2 grid grid-cols-[5rem_1fr_auto] items-end gap-2">
                <label className="space-y-1 text-sm font-medium">
                  <span>Số lượng</span>
                  <input
                    type="number"
                    min={1}
                    aria-label={`Số lượng ${index + 1}`}
                    value={line.quantity}
                    onChange={(e) => setLine(index, { quantity: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Đơn giá</span>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Đơn giá ${index + 1}`}
                    value={formatCurrencyInput(line.unitPrice)}
                    onChange={(e) => setLine(index, { unitPrice: e.target.value.replace(/\D/g, '') })}
                    className={field}
                  />
                </label>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Bỏ sản phẩm"
                    onClick={() => setLines((list) => list.filter((_, i) => i !== index))}
                    className="mb-0.5 rounded-lg border border-border p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((list) => [...list, blankLine()])}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Thêm sản phẩm
          </button>
        </div>

        <label className="block space-y-1 text-sm font-medium">
          <span>Thợ đã làm bó hoa</span>
          <select aria-label="Thợ đã làm bó hoa" value={makerId} onChange={(e) => { setError(''); setMakerId(e.target.value) }} className={field}>
            <option value="">Chọn thợ</option>
            {florists.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <span className="block text-xs font-normal text-muted-foreground">Thợ này được tính hoa hồng làm đơn như đơn thường.</span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm font-medium">
            <span>Tên khách (tuỳ chọn)</span>
            <input value={customerName} placeholder="Khách lẻ" onChange={(e) => setCustomerName(e.target.value)} className={field} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>SĐT (tuỳ chọn)</span>
            <input inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={field} />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">Khách trả</span>
          <span className="text-2xl font-bold text-foreground">{money(total)}</span>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
            Huỷ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="flex-[2] rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Đang lưu…' : 'Lưu đơn bán tại quầy'}
          </button>
        </div>
      </div>
    </div>
  )
}
