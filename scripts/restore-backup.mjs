// Restore a backup written by /api/cron/backup into an EMPTY, migrated database.
//
//   node scripts/restore-backup.mjs --list                    # backups in R2
//   node scripts/restore-backup.mjs --latest                  # dry run: show what would be restored
//   node scripts/restore-backup.mjs --date 2026-10-21 --apply # restore that day's backup
//   node scripts/restore-backup.mjs ./bloemist-2026-10-21.json.gz --apply
//
// Target: DATABASE_URL (from .env or the environment). Prepare it first with
// `npx prisma migrate deploy`. The script refuses to write into a database
// that already has rows, so it can never merge into or overwrite live data.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { AwsClient } from 'aws4fetch'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile()
} catch {
  // no .env file - rely on the environment
}

// Foreign-key order; must match BACKUP_TABLES in lib/server/backup.ts.
const TABLES = ['User', 'StoreLocation', 'Customer', 'Order', 'Task', 'StaffCheckIn', 'Message', 'InventoryItem', 'OrderCounter', 'AuditLog', 'ShopSettings']
// Single-row settings tables that migrations seed with defaults: replaced, not required to be empty.
const SEEDED = new Set(['ShopSettings'])

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null
const fileArg = args.find((a) => !a.startsWith('--') && a !== dateArg)

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const r2 =
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
    ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' })
    : null
const bucketUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`

async function listBackups() {
  if (!r2) throw new Error('R2_* environment variables are missing')
  const response = await r2.fetch(`${bucketUrl}?list-type=2&prefix=backups/`)
  if (!response.ok) throw new Error(`Listing backups failed: ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>/g)]
    .map(([, key, size]) => ({ key, size: Number(size) }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

async function loadBackup() {
  if (fileArg) return { source: fileArg, buffer: readFileSync(fileArg) }
  if (!r2) throw new Error('R2_* environment variables are missing')
  let key
  if (dateArg) key = `backups/bloemist-${dateArg}.json.gz`
  else if (args.includes('--latest')) key = (await listBackups()).at(-1)?.key
  if (!key) throw new Error('Choose a backup: a file path, --date YYYY-MM-DD or --latest')
  const response = await r2.fetch(`${bucketUrl}/${key}`)
  if (!response.ok) throw new Error(`Download of ${key} failed: ${response.status}`)
  return { source: key, buffer: Buffer.from(await response.arrayBuffer()) }
}

if (args.includes('--list')) {
  for (const { key, size } of await listBackups()) console.log(`${key}  ${(size / 1024).toFixed(1)} KB`)
  process.exit(0)
}

const prisma = new PrismaClient()
try {
  const { source, buffer } = await loadBackup()
  const backup = JSON.parse(gunzipSync(buffer).toString('utf8'))
  if (backup.format !== 'bloemist-backup') throw new Error(`${source} is not a Bloemist backup`)

  console.log(`Backup ${source} taken ${backup.createdAt} at migration ${backup.migration ?? 'unknown'}`)
  for (const table of TABLES) console.log(`  ${table.padEnd(14)} ${(backup.tables[table] ?? []).length} rows`)

  const [latest] = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`,
  )
  if (backup.migration && latest?.migration_name !== backup.migration) {
    throw new Error(
      `Target database is at migration ${latest?.migration_name ?? 'none'}, backup was taken at ${backup.migration}. ` +
        'Migrate the target to the same point first.',
    )
  }

  for (const table of TABLES.filter((t) => !SEEDED.has(t))) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`)
    if (n > 0) throw new Error(`Target table "${table}" already has ${n} rows - restore only into an empty database`)
  }

  if (!apply) {
    console.log('\nDry run - nothing written. Re-run with --apply to restore.')
  } else {
    await prisma.$transaction(
      TABLES.flatMap((table) => [
        // Replace migration defaults only when the backup has the table's rows.
        ...(SEEDED.has(table) && (backup.tables[table] ?? []).length ? [prisma.$executeRawUnsafe(`DELETE FROM "${table}"`)] : []),
        prisma.$executeRawUnsafe(
          `INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)`,
          JSON.stringify(backup.tables[table] ?? []),
        ),
      ]),
    )
    console.log('\nRestored.')
  }
} catch (error) {
  console.error(error.message ?? error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
