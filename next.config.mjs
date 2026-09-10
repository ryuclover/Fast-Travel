/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["puppeteer", "playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/buscar": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-core/package.json",
      "./node_modules/playwright-core/lib/**/*",
    ],
    "/api/**/*": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/playwright-core/**/*",
    ],
  },
  images: {
    unoptimized: false,
  },
}

export default nextConfig
