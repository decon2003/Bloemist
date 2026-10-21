import { gzipSync } from 'zlib'
import db from './db'
import { putObject } from './storage'

// Tables in foreign-key order: a restore inserts them top to bottom.
// Keep in step with prisma/schema.prisma and scripts/restore-backup.mjs.
export const BACKUP_TABLES = [
  'User',
  'StoreLocation',
  'Customer',
  'Order',
  'Task',
  'StaffCheckIn',
  'Message',
  'InventoryItem',
  'OrderCounter',
  'AuditLog',
] as const

export type BackupFile = {
  format: 'bloemist-backup'
  version: 1
  createdAt: string
  /** Last applied Prisma migration; restore into a database migrated to the same point. */
  migration: string | null
  tables: Record<string, unknown[]>
}

/** Every row of every table, as JSON. Rows go through Postgres' own JSON
 *  encoding (row_to_json), so a restore with json_populate_recordset gets the
 *  exact column types back without per-model code. The data is small (text
 *  only; photos live in R2), so one in-memory snapshot is fine. */
export async function createBackup(): Promise<BackupFile> {
  // A table added to the schema but not to BACKUP_TABLES would silently be
  // left out of every backup; refuse instead so the gap is noticed.
  const existing = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`,
  )
  const missing = existing.map((t) => t.table_name).filter((name) => !(BACKUP_TABLES as readonly string[]).includes(name))
  if (missing.length) throw new Error(`Tables not covered by the backup: ${missing.join(', ')} - add them to BACKUP_TABLES`)

  const tables: Record<string, unknown[]> = {}
  for (const table of BACKUP_TABLES) {
    const [row] = await db.$queryRawUnsafe<{ rows: unknown[] | null }[]>(
      `SELECT json_agg(row_to_json(t)) AS rows FROM "${table}" t`,
    )
    tables[table] = row?.rows ?? []
  }

  const [latest] = await db.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`,
  ).catch(() => [])

  return {
    format: 'bloemist-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    migration: latest?.migration_name ?? null,
    tables,
  }
}

/** Snapshot the database to R2 at backups/bloemist-YYYY-MM-DD.json.gz.
 *  Old copies are removed by the bucket's lifecycle rule on "backups/". */
export async function backupToR2() {
  const backup = await createBackup()
  const body = gzipSync(Buffer.from(JSON.stringify(backup)))
  const key = `backups/bloemist-${backup.createdAt.slice(0, 10)}.json.gz`
  await putObject(key, body, 'application/gzip')
  return {
    key,
    bytes: body.length,
    rows: Object.fromEntries(Object.entries(backup.tables).map(([name, rows]) => [name, rows.length])),
  }
}
