import { chromium } from "playwright"
import fs from "fs"
import path from "path"

/**
 * Script Playwright para mapear e registrar endpoints da Buser.
 * Execução: npx tsx lib/scrapers/buser/mapper.ts
 */
export async function mapBuser(
  origemSlug = "rio-de-janeiro-rj",
  destinoSlug = "sao-paulo-sp",
  data = "2026-09-16"
) {
  console.log(`[Buser Mapper] Iniciando mapeamento Buser para ${origemSlug} -> ${destinoSlug} em ${data}...`)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  })

  const page = await context.newPage()
  const capturedRequests: any[] = []

  page.on("request", (req) => {
    const url = req.url()
    if (url.includes("buser.com.br") && (url.includes("api") || url.includes("trip") || url.includes("search"))) {
      capturedRequests.push({ method: req.method(), url })
    }
  })

  const targetUrl = `https://www.buser.com.br/onibus/${origemSlug}/${destinoSlug}?ida=${data}`
  console.log(`🌐 Navegando para: ${targetUrl}`)

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 })
    await page.waitForTimeout(5000)

    const outputDir = path.resolve(process.cwd(), "lib/scrapers/buser")
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
    const outputFile = path.join(outputDir, "mapped-api.json")

    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          targetUrl,
          totalCapturedRequests: capturedRequests.length,
          requests: capturedRequests,
        },
        null,
        2
      )
    )

    console.log(`\n✅ [Buser Mapper] Mapeamento salvo em: ${outputFile}`)
  } catch (error) {
    console.error("❌ [Buser Mapper] Erro:", error)
  } finally {
    await browser.close()
  }
}

if (require.main === module || process.argv[1]?.includes("mapper.ts")) {
  mapBuser().catch(console.error)
}
