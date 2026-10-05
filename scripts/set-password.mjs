// Set a user's password from the command line. Used once to give the first
// boss/admin a password; after that, managers issue temporary passwords from
// Settings.
//
//   node scripts/set-password.mjs <email> <password> [--temporary]
//
// --temporary forces a password change at the next login.
// Needs DATABASE_URL in .env (or the environment).
//
// Hash format must match lib/server/password.ts.
import { randomBytes, scryptSync } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile()
} catch {
  // no .env file - rely on the environment
}

const [email, password, flag] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/set-password.mjs <email> <password> [--temporary]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters')
  process.exit(1)
}

const N = 16384, R = 8, P = 1
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
const passwordHash = `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`

const prisma = new PrismaClient()
try {
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: {
      passwordHash,
      mustChangePassword: flag === '--temporary',
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
    select: { name: true, email: true, role: true },
  })
  console.log(`Password set for ${user.name} <${user.email}> (${user.role})`)
} catch (error) {
  console.error(error.code === 'P2025' ? `No user with email ${email}` : error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
