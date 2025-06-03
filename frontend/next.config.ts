/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    turbo: false,  // Disable turbopack to fix the module error
  },
  images: {
    unoptimized: true,  // Fix image optimization issues
  }
}

module.exports = nextConfig