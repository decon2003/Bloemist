'use client'

import { useEffect, useState } from 'react'
import { Trash2, Wallet } from 'lucide-react'
import { addOrderPayment, deleteOrderPayment, fetchOrderPayments } from '@/lib/api'
import type { Order, OrderPayment, OrderPaymentsResult } from '@/lib/types'
import { formatCurrencyInput } from '@/lib/utils'

const VN = 'Asia/Ho_Chi_Minh'
const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`
const when = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

/** Each transfer the customer made, and "Ghi nhận tiền khách chuyển". The time
 *  a payment is recorded decides the sales KPI shift, so only managers remove
 *  one. Sales and managers only. */
export function OrderPayments({
  order,
  isManager,
  onOrderChange,
}: {
  order: Order
  isManager: boolean
  onOrderChange: (order: Order) => void
}) {
  const [payments, setPayments] = useState<OrderPayment[] | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchOrderPayments(order.id)
      .then((list) => active && setPayments(list))
      .catch(() => active && setPayments([]))
    return () => {
      active = false
    }
  }, [order.id])

  const remaining = order.remainingBalance ?? 0
  const canAdd = order.status !== 'CANCELLED' && remaining > 0

  const run = async (action: () => Promise<OrderPaymentsResult>) => {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      setPayments(result.payments)
      onOrderChange(result.order)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    const value = Number(amount || 0)
    if (!value) {
      setError('Nhập số tiền khách đã chuyển')
      return
    }
    if (!window.confirm(`Ghi nhận khách đã chuyển ${money(value)}?`)) return
    if (await run(() => addOrderPayment(order.id, { amount: value, note }))) {
      setAmount('')
      setNote('')
    }
  }

  const remove = (payment: OrderPayment) => {
    if (!window.confirm(`Xoá khoản thu ${money(payment.amount)} lúc ${when(payment.paidAt)}?`)) return
    run(() => deleteOrderPayment(order.id, payment.id))
  }

  return (
    <div className="mt-5 space-y-3 border-t border-border pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Wallet className="h-4 w-4" /> Các lần khách chuyển tiền
      </h3>
      {payments === null ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa ghi nhận khoản nào.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-semibold text-foreground">{money(p.amount)}</span>
                <span className="text-muted-foreground">
                  {' '}· {when(p.paidAt)}
                  {p.recordedByName ? ` · ${p.recordedByName}` : ''}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
              {isManager && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(p)}
                  aria-label="Xoá khoản thu"
                  className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Số tiền khách chuyển"
              inputMode="numeric"
              placeholder={`Số tiền (còn ${money(remaining)})`}
              value={formatCurrencyInput(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              className="rounded-lg border border-border px-3 py-2 text-sm sm:w-48"
            />
            <input
              aria-label="Ghi chú khoản thu"
              placeholder="Ghi chú (tuỳ chọn)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={add}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Đang lưu…' : 'Ghi nhận tiền khách chuyển'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bấm ngay khi khách chuyển tiền: giờ ghi nhận được dùng để tính KPI theo ca.{' '}
            <button type="button" onClick={() => setAmount(String(remaining))} className="font-medium text-primary hover:underline">
              Điền số còn lại
            </button>
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
