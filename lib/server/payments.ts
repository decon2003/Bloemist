import type { Prisma } from '@prisma/client'
import db from './db'
import { ApiError } from './api-error'
import { audit } from './audit'
import { computeOrderTotals, toVnd } from './money'
import { assertPayrollOpen } from './payroll'
import { isManager, type SessionUser } from './session'

// Money a customer paid for an order, one row per transfer. Sales record a
// payment when it arrives; its time decides the KPI shift, so only a manager
// may enter another time or remove a payment. The order's `deposit` ("Đã
// thu") is always the sum of its payments.

export type OrderPaymentView = {
  id: string
  amount: number
  paidAt: string
  recordedByName: string | null
  note: string | null
}

const view = (p: { id: string; amount: number; paidAt: Date; recordedByName: string | null; note: string | null }): OrderPaymentView => ({
  id: p.id,
  amount: p.amount,
  paidAt: p.paidAt.toISOString(),
  recordedByName: p.recordedByName,
  note: p.note,
})

export async function listPayments(orderId: string) {
  const payments = await db.orderPayment.findMany({ where: { orderId }, orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] })
  return payments.map(view)
}

/** Set the order's "Đã thu" and "Còn phải thu" from its payments. */
async function syncPaid(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } })
  const sum = await tx.orderPayment.aggregate({ where: { orderId }, _sum: { amount: true } })
  const deposit = sum._sum.amount ?? 0
  const { remainingBalance } = computeOrderTotals({
    listedPrice: order.listedPrice,
    deliveryFee: order.deliveryFee,
    deliveryCoveredByShop: order.deliveryCoveredByShop ?? false,
    vatPercent: order.vatPercent,
    deposit,
  })
  await tx.order.update({ where: { id: orderId }, data: { deposit, remainingBalance } })
}

/** `paidAt` (ISO) is for managers entering a transfer recorded late. */
export async function addPayment(orderId: string, input: { amount?: unknown; note?: unknown; paidAt?: unknown }, actor: SessionUser) {
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) throw new ApiError(404, 'Không tìm thấy đơn hàng')
  if (order.status === 'CANCELLED') throw new ApiError(409, 'Đơn đã huỷ, không ghi nhận tiền được')
  const amount = toVnd(input.amount, 'amount', { required: true })!
  if (amount <= 0) throw new ApiError(400, 'Số tiền phải lớn hơn 0')
  const remaining = order.remainingBalance ?? order.total
  if (remaining <= 0) throw new ApiError(409, 'Đơn đã thu đủ tiền')
  if (amount > remaining) throw new ApiError(400, `Số tiền lớn hơn số còn phải thu (${remaining.toLocaleString('vi-VN')} ₫)`)

  let paidAt = new Date()
  if (input.paidAt !== undefined && input.paidAt !== null && input.paidAt !== '') {
    if (!isManager(actor)) throw new ApiError(403, 'Chỉ quản lý được nhập giờ nhận tiền khác')
    const at = typeof input.paidAt === 'string' ? new Date(input.paidAt) : null
    if (!at || Number.isNaN(at.getTime()) || at > new Date()) throw new ApiError(400, 'Giờ nhận tiền không hợp lệ')
    paidAt = at
  }
  await assertPayrollOpen(paidAt, 'Khoản thu này')
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 200) : null

  await db.$transaction(async (tx) => {
    await tx.orderPayment.create({ data: { orderId, amount, paidAt, note, recordedById: actor.id, recordedByName: actor.name } })
    await syncPaid(tx, orderId)
  })
  await audit(actor, {
    action: 'order.payment',
    entity: 'order',
    entityId: orderId,
    summary: `Thu ${amount.toLocaleString('vi-VN')} ₫ · ${order.code}${note ? ` · ${note}` : ''}`,
  })
}

export async function deletePayment(orderId: string, paymentId: string, actor: SessionUser) {
  const payment = await db.orderPayment.findFirst({ where: { id: paymentId, orderId }, include: { order: { select: { code: true } } } })
  if (!payment) throw new ApiError(404, 'Không tìm thấy khoản thu')
  await assertPayrollOpen(payment.paidAt, 'Khoản thu này')
  await db.$transaction(async (tx) => {
    await tx.orderPayment.delete({ where: { id: paymentId } })
    await syncPaid(tx, orderId)
  })
  await audit(actor, {
    action: 'order.payment_delete',
    entity: 'order',
    entityId: orderId,
    summary: `Xoá khoản thu ${payment.amount.toLocaleString('vi-VN')} ₫ · ${payment.order.code}`,
  })
}
