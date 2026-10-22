// Runs `prisma migrate deploy` during the Vercel production build only.
//
// Preview deployments share the production database on the free plan, so they
// must never migrate it - a half-finished branch would change the live schema.
// If a migration fails the build fails, and Vercel keeps serving the previous
// deployment, which is the safe outcome.
import { execSync } from 'node:child_process'

// Migrations take a Postgres advisory lock, which does not work reliably
// through Neon's connection pooler (a build once timed out on it), so they use
// the direct host - the pooled one without "-pooler" - unless DIRECT_URL is set.
const directUrl = process.env.DIRECT_URL || (process.env.DATABASE_URL ?? '').replace('-pooler.', '.')

if (process.env.VERCEL_ENV === 'production') {
  console.log('[migrate] production build: applying pending migrations')
  for (let attempt = 1; ; attempt++) {
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: directUrl } })
      break
    } catch (error) {
      // Another build migrating at the same moment holds the lock; wait and retry.
      if (attempt >= 3) throw error
      console.log(`[migrate] attempt ${attempt} failed, retrying in 15s`)
      execSync('sleep 15')
    }
  }
} else {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`)
}
