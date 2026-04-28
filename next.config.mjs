/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["puppeteer"],
  images: {
    unoptimized: false,
  },
}

export default nextConfig
