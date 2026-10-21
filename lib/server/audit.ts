import type { Prisma } from '@prisma/client'
import db from './db'

export type AuditActor = { id: string; name: string } | null

type AuditEntry = {
  action: string
  entity: 'order' | 'task' | 'user' | 'customer' | 'auth' | 'checkin' | 'settings'
  entityId?: string | null
  summary?: string
  changes?: Record<string, [unknown, unknown]> | null
}

// Fields whose values must never be copied into the log.
const SECRET_FIELDS = new Set(['passwordHash', 'sessionVersion', 'failedLoginCount', 'lockedUntil'])

/** Record an action. Auditing must never break the action it describes, so a
 *  failed write is logged to the console and swallowed. */
export async function audit(actor: AuditActor, entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        userName: actor?.name ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary?.slice(0, 500) ?? null,
        changes: entry.changes ? (entry.changes as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (error) {
    console.error('Audit write failed', entry.action, error)
  }
}

const comparable = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value === undefined ? null : value

/** {field: [before, after]} for the fields that actually changed. Large
 *  values (inline photos) are summarised rather than copied. */
export function diff(beforeValue: object, afterValue: object, fields?: readonly string[]) {
  const before = beforeValue as Record<string, unknown>
  const after = afterValue as Record<string, unknown>
  const keys = fields ?? Object.keys(after)
  const changes: Record<string, [unknown, unknown]> = {}
  for (const key of keys) {
    if (SECRET_FIELDS.has(key)) continue
    const a = comparable(before[key])
    const b = comparable(after[key])
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    const shrink = (v: unknown) => (typeof v === 'string' && v.length > 300 ? `${v.slice(0, 60)}… (${v.length} chars)` : v)
    changes[key] = [shrink(a), shrink(b)]
  }
  return Object.keys(changes).length ? changes : null
}

export async function listAudit(filter: { entity?: string; entityId?: string; take?: number }) {
  const rows = await db.auditLog.findMany({
    where: { ...(filter.entity ? { entity: filter.entity } : {}), ...(filter.entityId ? { entityId: filter.entityId } : {}) },
    orderBy: { at: 'desc' },
    take: Math.min(filter.take ?? 100, 500),
  })
  return rows.map((row) => ({ ...row, at: row.at.toISOString() }))
}
