import { audit, type AuditActor } from '@/lib/server/audit'

/** Log an order status the system changed because of its products. */
export async function auditOrderStatus(
  actor: AuditActor,
  change: { code: string; from: string; to: string } | null,
  orderId: string | null | undefined,
) {
  if (!change || !orderId) return
  await audit(actor, {
    action: 'order.update',
    entity: 'order',
    entityId: orderId,
    summary: `${change.code}: trạng thái tự cập nhật theo sản phẩm`,
    changes: { status: [change.from, change.to] },
  })
}
