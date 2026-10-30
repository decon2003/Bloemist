// Devtest on this computer: `npm run devtest`.
//
// Starts a private Postgres in .devtest/ (never the real database), brings it
// to the latest migration, creates sample accounts the first time, then runs
// the app in development mode on http://localhost:3000 - and on this
// computer's Wi-Fi address, for trying it on a phone on the same network.
// Photos are stored in the local database (R2 is left unset). Ctrl+C stops all.
//
//   npm run devtest            start (data is kept between runs)
//   npm run devtest -- --reset start again from an empty database
import EmbeddedPostgres from 'embedded-postgres'
import { spawn, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const dir = join(root, '.devtest')
const PORT_DB = 54330
const PORT_APP = 3000

if (process.argv.includes('--reset')) rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })

// A key that survives restarts, so sign-ins do too.
const secretFile = join(dir, 'auth-secret')
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('base64url'))

const pg = new EmbeddedPostgres({
  databaseDir: join(dir, 'pg'),
  user: 'postgres',
  password: 'postgres',
  port: PORT_DB,
  persistent: true,
  // UTF-8 whatever the computer's language: Windows would default to WIN1252.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
})
if (!existsSync(join(dir, 'pg', 'PG_VERSION'))) {
  console.log('Tạo database devtest lần đầu…')
  await pg.initialise()
}
await pg.start()
const fresh = !existsSync(join(dir, 'seeded'))
if (fresh) {
  const client = pg.getPgClient()
  await client.connect()
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'bloemist'")
  if (!exists.rowCount) await client.query("CREATE DATABASE bloemist ENCODING 'UTF8' TEMPLATE template0")
  await client.end()
}

const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT_DB}/bloemist`
const lan = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address)
// Variables set here win over .env, which must never be used by devtest.
const env = {
  ...process.env,
  DATABASE_URL,
  DIRECT_URL: DATABASE_URL,
  AUTH_SECRET: readFileSync(secretFile, 'utf8'),
  CRON_SECRET: 'devtest',
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_BUCKET: '',
  R2_BUCKET_NAME: '',
  R2_PUBLIC_URL: '',
  DEVTEST_ORIGINS: lan.join(','),
}

execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'inherit' })

const ACCOUNTS = [
  { email: 'admin@devtest.local', name: 'Admin', role: 'admin', password: 'Admin12345' },
  { email: 'sale@devtest.local', name: 'Sale Thử', role: 'sales', password: 'Sale12345' },
  { email: 'tho@devtest.local', name: 'Thợ Thử', role: 'florist', password: 'Tho12345' },
  { email: 'tho2@devtest.local', name: 'Thợ Thử 2', role: 'florist', password: 'Tho12345' },
]
if (fresh) {
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  // Same hash format as scripts/set-password.mjs.
  const hash = (password) => {
    const salt = randomBytes(16)
    const h = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`
  }
  for (const a of ACCOUNTS) {
    await db.user.upsert({
      where: { email: a.email },
      update: {},
      create: { email: a.email, name: a.name, role: a.role, phone: '0900000000', status: 'active', passwordHash: hash(a.password) },
    })
  }
  await db.storeLocation.upsert({
    where: { id: 'store-main' },
    update: {},
    create: { id: 'store-main', label: 'Bloemist (devtest)', address: '', lat: 10.762622, lng: 106.660172 },
  })
  await db.$disconnect()
  writeFileSync(join(dir, 'seeded'), new Date().toISOString())
}

console.log(`
  Devtest (dữ liệu thử, không phải dữ liệu thật)
  Máy này:     http://localhost:${PORT_APP}
${lan.map((ip) => `  Điện thoại: http://${ip}:${PORT_APP}   (cùng Wi-Fi)`).join('\n')}
  Tài khoản:
${ACCOUNTS.map((a) => `    ${a.role.padEnd(8)} ${a.email.padEnd(22)} ${a.password}`).join('\n')}
  Ctrl+C để dừng. Xoá sạch làm lại: npm run devtest -- --reset
`)

const app = spawn(`npx next dev -H 0.0.0.0 -p ${PORT_APP}`, { cwd: root, env, stdio: 'inherit', shell: true })
let stopping = false
const stop = async () => {
  if (stopping) return
  stopping = true
  app.kill()
  await pg.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
app.on('exit', stop)
