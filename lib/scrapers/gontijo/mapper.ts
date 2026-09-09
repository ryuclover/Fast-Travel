import { chromium } from "playwright"
import fs from "fs"
import path from "path"

/**
 * Script Playwright para mapear o fluxo de busca e gratuidade da Gontijo.
 * Execução: npx tsx lib/scrapers/gontijo/mapper.ts
 */
export async function mapGontijo(
  origem = "RIO DE JANEIRO",
  destino = "BELO HORIZONTE",
  data = "20/09/2026",
  tipoGratuidade: "JVVN" | "NORMAL" = "JVVN" // JVVN = Jovem de baixa renda (ID Jovem)
) {
  console.log(`[Gontijo Mapper] Iniciando mapeamento Gontijo (${origem} -> ${destino} em ${data}, Tipo: ${tipoGratuidade})...`)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  })

  const page = await context.newPage()

  const capturedRequests: any[] = []

  // Monitorar requisições
  page.on("request", (req) => {
    const url = req.url()
    if (
      url.includes("gontijo.com.br") &&
      (url.includes("pesquisa") ||
        url.includes("viagem") ||
        url.includes("vpi") ||
        url.includes("servico") ||
        url.includes("ajax") ||
        req.method() === "POST")
    ) {
      console.log(`📡 [Gontijo Request] ${req.method()} ${url}`)
      capturedRequests.push({
        method: req.method(),
        url,
        postData: req.postData(),
        headers: req.headers(),
      })
    }
  })

  page.on("response", async (res) => {
    const url = res.url()
    if (url.includes("gontijo.com.br") && (url.includes("pesquisa") || url.includes("viagem") || url.includes("vpi"))) {
      try {
        const text = await res.text()
        if (text.includes("poltrona") || text.includes("R$") || text.includes("horario") || text.includes("convencional")) {
          console.log(`📦 [Gontijo Response] Detectado conteúdo de viagens em: ${url.slice(0, 80)} (${text.length} bytes)`)
        }
      } catch (e) {}
    }
  })

  try {
    console.log("🌐 Acessando home da Gontijo...")
    await page.goto("https://www.gontijo.com.br/", { waitUntil: "domcontentloaded", timeout: 30000 })

    if (tipoGratuidade === "JVVN") {
      console.log("🎯 Preenchendo formulário de Gratuidade (ID Jovem)...")
      // Seleciona tipo de gratuidade
      await page.selectOption("#grat-tipo", "JVVN").catch(() => {})

      // Preenche origem e destino
      await page.fill("#grat-embarque", origem).catch(() => {})
      await page.waitForTimeout(500)
      // Clica na primeira sugestão de autocompleto se houver
      const firstSugOrigem = page.locator(".ui-autocomplete li, .autocomplete-suggestion").first()
      if (await firstSugOrigem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstSugOrigem.click()
      }

      await page.fill("#grat-desembarque", destino).catch(() => {})
      await page.waitForTimeout(500)
      const firstSugDestino = page.locator(".ui-autocomplete li, .autocomplete-suggestion").first()
      if (await firstSugDestino.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstSugDestino.click()
      }

      await page.fill("#grat_data_ida", data).catch(() => {})
      
      console.log("🚀 Disparando pesquisaGratuidade()...")
      await page.evaluate(() => {
        // @ts-ignore
        if (typeof pesquisarGratuidade === "function") {
          // @ts-ignore
          pesquisarGratuidade()
        }
      })
    } else {
      console.log("🎯 Preenchendo formulário de Pesquisa Normal...")
      await page.fill("#vpw-embarque", origem).catch(() => {})
      await page.fill("#vpw-desembarque", destino).catch(() => {})
      await page.fill("#vpw_data_ida", data).catch(() => {})
      await page.evaluate(() => {
        // @ts-ignore
        if (typeof pesquisarViagem === "function") {
          // @ts-ignore
          pesquisarViagem()
        }
      })
    }

    await page.waitForTimeout(5000)

    const outputDir = path.resolve(process.cwd(), "lib/scrapers/gontijo")
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
    const outputFile = path.join(outputDir, "mapped-api.json")

    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          tipoGratuidade,
          totalCapturedRequests: capturedRequests.length,
          requests: capturedRequests,
        },
        null,
        2
      )
    )

    console.log(`\n✅ [Gontijo Mapper] Mapeamento concluído e salvo em: ${outputFile}`)
  } catch (error) {
    console.error("❌ [Gontijo Mapper] Erro:", error)
  } finally {
    await browser.close()
  }
}

if (require.main === module || process.argv[1]?.includes("mapper.ts")) {
  mapGontijo().catch(console.error)
}
