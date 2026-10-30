/** @type {import('next').NextConfig} */
// Redeploy trigger to ensure Prisma Client is regenerated
const nextConfig = {
  // typescript.ignoreBuildErrors was previously true, which let type errors ship
  // to production - including a data-store writing Order columns that do not
  // exist in the Prisma schema, which made every order creation fail at runtime.
  // Keep type checking on: it is the cheapest guard this project has.
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  // npm run devtest: let a phone on the same Wi-Fi load the dev build.
  allowedDevOrigins: process.env.DEVTEST_ORIGINS ? process.env.DEVTEST_ORIGINS.split(',') : [],
  // Browser-side hardening for every page and API response: no framing by
  // other sites (clickjacking), no MIME sniffing, no full URLs sent to other
  // sites, and no camera/mic/location access from scripts (photos are taken
  // through the file picker, which these do not affect).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ]
  },
}

export default nextConfig
