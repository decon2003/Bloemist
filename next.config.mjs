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

}

export default nextConfig
