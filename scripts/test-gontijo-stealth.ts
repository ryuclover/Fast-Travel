import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"

chromium.use(StealthPlugin())

async function testGontijoStealth() {
  console.log("[Gontijo Stealth] Iniciando...")

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  })

  const page = await context.newPage()

  // Capturar respostas de busca
  const apiResponses: any[] = []
  page.on("response", async (res) => {
    const url = res.url()
    if (url.includes("action") && url.includes("usc001")) {
      try {
        const text = await res.text()
        apiResponses.push({ url: url.slice(0, 200), status: res.status(), length: text.length, preview: text.slice(0, 500) })
      } catch {}
    }
  })

  try {
    console.log("[Gontijo Stealth] Acessando home...")
    await page.goto("https://www.gontijo.com.br/", { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(3000)

    // Verificar se Turnstile resolveu
    const turnstileStatus = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe[src*="turnstile"]')
      const widgets = document.querySelectorAll('.cf-turnstile, [data-sitekey]')
      return { iframes: iframes.length, widgets: widgets.length }
    })
    console.log("[Gontijo Stealth] Turnstile:", turnstileStatus)

    // Tentar obter token do Turnstile
    const token = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name*="turnstile"], input[name*="cf-"]')
      return Array.from(inputs).map((i) => ({ name: i.getAttribute("name"), value: (i as HTMLInputElement).value?.slice(0, 50) }))
    })
    console.log("[Gontijo Stealth] Tokens:", token)

    // Tentar submeter busca via API
    console.log("[Gontijo Stealth] Tentando busca via API...")
    const searchResult = await page.evaluate(async () => {
      const formData = new URLSearchParams()
      formData.append("trajeto", "IDA")
      formData.append("cidadeOrigem", "RIO DE JANEIRO")
      formData.append("id-embarque", "")
      formData.append("cidadeDestino", "BELO HORIZONTE")
      formData.append("id-desembarque", "")
      formData.append("dataIda", "11/09/2026")
      formData.append("pesquisaDireta", "false")
      formData.append("containerId", "content")

      try {
        const response = await fetch("https://www.gontijo.com.br/action?name=usc001PesquisarViagens&containerId=content", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        })
        const text = await response.text()
        return { status: response.status, length: text.length, preview: text.slice(0, 1000) }
      } catch (e) {
        return { error: String(e) }
      }
    })
    console.log("[Gontijo Stealth] Resultado:", JSON.stringify(searchResult, null, 2))
    console.log("[Gontijo Stealth] API Responses capturadas:", apiResponses.length)
    apiResponses.forEach((r) => console.log("  ", JSON.stringify(r).slice(0, 200)))

  } catch (e) {
    console.error("[Gontijo Stealth] Erro:", e)
  } finally {
    await browser.close()
  }
}

testGontijoStealth()
