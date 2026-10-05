// Runs `prisma migrate deploy` during the Vercel production build only.
//
// Preview deployments share the production database on the free plan, so they
// must never migrate it - a half-finished branch would change the live schema.
// If a migration fails the build fails, and Vercel keeps serving the previous
// deployment, which is the safe outcome.
import { execSync } from 'node:child_process'

if (process.env.VERCEL_ENV === 'production') {
  console.log('[migrate] production build: applying pending migrations')
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
} else {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`)
}
