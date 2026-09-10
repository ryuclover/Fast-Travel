/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["puppeteer", "playwright-core", "@sparticuz/chromium"],
  images: {
    unoptimized: false,
  },
}

export default nextConfig
