import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"

chromium.use(StealthPlugin())

async function testHeaded() {
  console.log("[Headed Test] Iniciando navegador HEADED...")

  // HEADED = false → headless. Vamos testar com headed real
  const browser = await chromium.launch({
    headless: false, // ← HEADED MODE
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
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

  try {
    console.log("[Headed Test] Acessando Gontijo...")
    await page.goto("https://www.gontijo.com.br/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })

    console.log("[Headed Test] Aguardando 15s para Turnstile resolver...")
    await page.waitForTimeout(15000)

    // Verificar Turnstile
    const turnstileStatus = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe[src*="turnstile"]')
      const widgets = document.querySelectorAll('.cf-turnstile, [data-sitekey]')
      const inputs = document.querySelectorAll('input')
      const tokenInputs = Array.from(inputs).filter(
        (i) =>
          i.name &&
          (i.name.includes("turnstile") || i.name.includes("cf-") || i.name.includes("token"))
      )
      return {
        iframes: iframes.length,
        widgets: widgets.length,
        tokenInputs: tokenInputs.map((i) => ({
          name: i.name,
          value: i.value ? i.value.slice(0, 80) : "empty",
        })),
      }
    })
    console.log("[Headed Test] Turnstile:", JSON.stringify(turnstileStatus, null, 2))

    // Tentar API de busca
    const result = await page.evaluate(async () => {
      const fd = new URLSearchParams()
      fd.append("trajeto", "IDA")
      fd.append("cidadeOrigem", "RIO DE JANEIRO")
      fd.append("id-embarque", "")
      fd.append("cidadeDestino", "BELO HORIZONTE")
      fd.append("id-desembarque", "")
      fd.append("dataIda", "11/09/2026")
      fd.append("pesquisaDireta", "false")
      fd.append("containerId", "content")

      const r = await fetch(
        "https://www.gontijo.com.br/action?name=usc001PesquisarViagens&containerId=content",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: fd.toString(),
        }
      )
      const t = await r.text()
      return { status: r.status, len: t.length, preview: t.slice(0, 1000) }
    })
    console.log("[Headed Test] Resultado:", JSON.stringify(result, null, 2))

    // Se funcionou, tentar extrair viagens
    if (result.len > 100 && !result.preview.includes("location.reload")) {
      console.log("[Headed Test] ✅ SUCESSO! Buscando viagens...")
      // Navegar para resultados
      await page.goto(
        "https://www.gontijo.com.br/?trajeto=IDA&cidadeOrigem=RIO+DE+JANEIRO&cidadeDestino=BELO+HORIZONTE&dataIda=11/09/2026",
        { waitUntil: "networkidle", timeout: 30000 }
      )
      await page.waitForTimeout(5000)
      const trips = await page.evaluate(() => document.body.innerText.slice(0, 3000))
      console.log("[Headed Test] Viagens:", trips.slice(0, 1500))
    }
  } catch (e) {
    console.error("[Headed Test] Erro:", e)
  } finally {
    await browser.close()
  }
}

testHeaded()
