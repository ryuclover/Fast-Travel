import { chromium } from "playwright"

async function inspectFrontendLogic() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto("https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-09-19&passengers=13:1", {
    waitUntil: "networkidle"
  })

  // Search inside loaded scripts for "preço da viagem foi atualizado"
  const scriptContents = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
    const matches: any[] = []
    for (const src of scripts) {
      if (!src.includes("_next/static")) continue
      try {
        const res = await fetch(src)
        const text = await res.text()
        if (text.includes("preço da viagem foi atualizado") || text.includes("corrigido automaticamente")) {
          matches.push({
            src,
            snippet: text.slice(Math.max(0, text.indexOf("preço da viagem foi atualizado") - 200), text.indexOf("preço da viagem foi atualizado") + 400)
          })
        }
      } catch {}
    }
    return matches
  })

  console.log("Matches found in JS bundles:", scriptContents.length)
  for (const m of scriptContents) {
    console.log("\nSource:", m.src)
    console.log("Code snippet:\n", m.snippet)
  }

  await browser.close()
}

inspectFrontendLogic().catch(console.error)
