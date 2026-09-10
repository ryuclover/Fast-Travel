/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["puppeteer", "playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/buscar": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  images: {
    unoptimized: false,
  },
}

export default nextConfig
