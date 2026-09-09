import { chromium } from "playwright"
import fs from "fs"
import path from "path"

/**
 * Script Playwright para mapear e registrar as requisições de rede da ClickBus.
 * Execução: npx tsx lib/scrapers/clickbus/mapper.ts
 */
export async function mapClickbus(
  origem = "rio-de-janeiro-rj-todos",
  destino = "sao-paulo-sp-todos",
  data = "2026-09-25",
  idJovem = true
) {
  console.log(`[ClickBus Mapper] Iniciando mapeamento para ${origem} -> ${destino} em ${data} (ID Jovem: ${idJovem})...`)
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  })

  const page = await context.newPage()

  let bffUrl: string | null = null
  let bffHeaders: Record<string, string> = {}
  let bffSampleData: any = null

  // Interceptar todas as requisições
  page.on("request", (req) => {
    const url = req.url()
    if (url.includes("bff.clickbus.com") || url.includes("/web/api/v5/trips")) {
      bffUrl = url
      bffHeaders = req.headers()
      console.log(`\n🎯 [ClickBus Mapper] Detectada chamada BFF:\nURL: ${url}`)
    }
  })

  // Interceptar respostas JSON
  page.on("response", async (res) => {
    const url = res.url()
    if (url.includes("bff.clickbus.com") || url.includes("/web/api/v5/trips")) {
      try {
        const json = await res.json()
        bffSampleData = json
        const totalTrips = json?.departures?.length || 0
        console.log(`📦 [ClickBus Mapper] Resposta da API recebida com ${totalTrips} viagens!`)
      } catch (e) {
        console.error("[ClickBus Mapper] Erro ao decodificar JSON:", e)
      }
    }
  })

  const targetUrl = `https://www.clickbus.com.br/onibus/${origem}/${destino}?departureDate=${data}${idJovem ? "&gratuity=true" : ""}`
  console.log(`🌐 Navegando para: ${targetUrl}`)

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 })

    // Aguarda um momento para chamadas assíncronas serem concluídas
    for (let i = 0; i < 15; i++) {
      if (bffSampleData) break
      await page.waitForTimeout(1000)
    }

    // Salvar configuração mapeada para uso pelo client HTTP
    const outputDir = path.resolve(process.cwd(), "lib/scrapers/clickbus")
    const outputFile = path.join(outputDir, "mapped-api.json")

    const mappingResult = {
      capturedAt: new Date().toISOString(),
      sampleUrl: bffUrl,
      headers: bffHeaders,
      totalTripsFound: bffSampleData?.departures?.length || 0,
      sampleFirstTrip: bffSampleData?.departures?.[0] || null,
    }

    fs.writeFileSync(outputFile, JSON.stringify(mappingResult, null, 2))
    console.log(`\n✅ [ClickBus Mapper] Mapeamento concluído e salvo em: ${outputFile}`)
  } catch (error) {
    console.error("❌ [ClickBus Mapper] Falha durante a navegação:", error)
  } finally {
    await browser.close()
  }
}

// Executa se chamado diretamente
if (require.main === module || process.argv[1]?.includes("mapper.ts")) {
  mapClickbus().catch(console.error)
}
