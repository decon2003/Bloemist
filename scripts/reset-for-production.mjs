// Turn the test database into production: delete every test record, keep the
// shop's set-up (staff accounts with their pay profiles, settings, KPI,
// holidays, store location).
//
//   node scripts/reset-for-production.mjs           dry run: counts only
//   node scripts/reset-for-production.mjs --apply   delete (after a local copy)
//
// DATABASE_URL must be set in the terminal (it is never read from .env here).
// Test accounts (e-mail ending "@x.vn" or name starting "PENTEST") are removed;
// every other account is signed out everywhere and unlocked. Each staff member
// (not the admin) gets a new temporary password and must choose their own at
// the first sign-in. The temporary passwords are written to a file in
// .devtest/ (never printed, never committed) for the owner to hand out.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes, randomInt, scryptSync } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

// Same hash format as scripts/set-password.mjs.
const hash = (password) => {
  const salt = randomBytes(16)
  const h = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`
}
// Easy to read out and type on a phone: no 0/O or 1/l/I.
const tempPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return 'Bloemist-' + Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('')
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL in this terminal first.')
  process.exit(1)
}
const apply = process.argv.includes('--apply')
const db = new PrismaClient({ datasources: { db: { url } } })

// Tables holding activity; all of it is test data. Children before parents.
const WIPE = ['OrderPayment', 'Task', 'Order', 'Customer', 'StaffCheckIn', 'PayrollLine', 'Payroll', 'AuditLog', 'LoginFailure', 'OrderCounter', 'Message', 'InventoryItem']
const testUser = { OR: [{ email: { endsWith: '@x.vn' } }, { name: { startsWith: 'PENTEST' } }] }

try {
  console.log(`Database: ${new URL(url).host}${apply ? '' : '   (dry run: nothing is changed)'}\n`)
  for (const table of WIPE) {
    const [{ n }] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`)
    console.log(`  delete ${table.padEnd(14)} ${n}`)
  }
  const removed = await db.user.findMany({ where: testUser, select: { email: true } })
  const kept = await db.user.findMany({ where: { NOT: testUser }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } })
  console.log(`  delete test accounts   ${removed.length}`)
  console.log(`\n  keep ${kept.length} accounts (signed out, unlocked):`)
  for (const u of kept) {
    console.log(`    ${u.role.padEnd(8)} ${u.name} <${u.email}>   ${u.role === 'admin' ? 'password unchanged' : 'new temporary password'}`)
  }
  console.log('  keep settings, KPI, holidays, store location, pay profiles')

  if (!apply) {
    console.log('\nRun again with --apply to delete.')
  } else {
    // A copy of everything first, in case something should have been kept.
    const dir = resolve(import.meta.dirname, '..', '.devtest')
    mkdirSync(dir, { recursive: true })
    const copy = {}
    for (const table of [...WIPE, 'User', 'ShopSettings', 'StoreLocation']) {
      copy[table] = await db.$queryRawUnsafe(`SELECT * FROM "${table}"`)
    }
    const file = join(dir, `before-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(copy, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
    console.log(`\nCopy saved: ${file}`)

    const staff = kept.filter((u) => u.role !== 'admin').map((u) => ({ ...u, password: tempPassword() }))
    await db.$transaction(async (tx) => {
      for (const table of WIPE) await tx.$executeRawUnsafe(`DELETE FROM "${table}"`)
      await tx.user.deleteMany({ where: testUser })
      await tx.user.updateMany({ data: { sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } })
      for (const u of staff) {
        await tx.user.update({ where: { id: u.id }, data: { passwordHash: hash(u.password), mustChangePassword: true } })
      }
    })
    const list = join(dir, 'staff-temporary-passwords.txt')
    writeFileSync(list, [
      'Mật khẩu tạm của nhân viên: đưa trực tiếp cho từng người; họ phải đổi ở lần đăng nhập đầu.',
      'Xoá file này sau khi đã đưa xong.',
      '',
      ...staff.map((u) => `${u.name}\t${u.email}\t${u.password}`),
    ].join('\n'))
    console.log('Done: test data deleted, set-up kept, everyone signed out.')
    console.log(`Staff temporary passwords (${staff.length}): ${list}`)
  }
} finally {
  await db.$disconnect()
}
