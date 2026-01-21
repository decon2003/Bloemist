/** @type {import('next').NextConfig} */
// Redeploy trigger to ensure Prisma Client is regenerated
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

}

export default nextConfig
