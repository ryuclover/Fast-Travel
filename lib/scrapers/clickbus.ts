import type { Page } from "puppeteer"

export interface ClickBusResultItem {
  empresa: string
  horario?: string
  chegada?: string
  duracao?: string
  valor?: string
}

export interface ClickBusScrapeResult {
  disponivel: boolean
  vagasIdJovem: number
  detalhes: string
  siteUrl: string
  empresa?: string
  resultados: ClickBusResultItem[]
}

export async function scrapeClickBus(page: Page, url: string, skipNavigationIfAlreadyLoaded = false): Promise<ClickBusScrapeResult> {
  if (!skipNavigationIfAlreadyLoaded || page.url() !== url) {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    })
  }

  await page.waitForFunction(
    () => {
      const body = document.body?.innerText.toLowerCase() || ""
      return (
        body.includes("viaje com") ||
        body.includes("poltrona") ||
        body.includes("passagens") ||
        !!document.querySelector('div[itemprop="Provider"]') ||
        !!document.querySelector('[data-testid="search-item-logo-img"]')
      )
    },
    { timeout: 2500 }
  ).catch(() => null)

  const pageText = await page.evaluate(() => {
    return document.body?.innerText || ""
  })

  const texto = pageText.toLowerCase()
  const encontrouIdJovem = /id\s*jovem/.test(texto)
  const encontrouGratuidade = /gratuidade|vagas gratuitas|passagens gratuitas|beneficio|benefício/.test(texto)
  const encontrouDisponibilidade = /dispon[ií]vel|disponibilidade|vaga(s)? disponível(s)?/.test(texto)

  const pageData = await page.evaluate(() => {
    const normalizeText = (el: Element | null) => {
      if (!el) return ""
      return (el.textContent || "").trim().replace(/\s+/g, " ")
    }

    const resultados = Array.from(document.querySelectorAll('div[data-testid="search-item-container"]')).map((item) => {
      const empresa = normalizeText(item.querySelector('span[data-testid="sortedby-lowfare"]') || item.querySelector('div[itemprop="Provider"]'))
      const horario = normalizeText(item.querySelector('time.departure-time'))
      const chegada = normalizeText(item.querySelector('time.return-time'))
      const duracao = normalizeText(item.querySelector('[data-testid="price-container"] time.duration') || item.querySelector('time.duration'))
      const valor = normalizeText(
        item.querySelector('span[data-testid="is-not-promotion"]') ||
        item.querySelector('span[data-testid="is-promotion"]') ||
        item.querySelector('.price')
      )

      return {
        empresa,
        horario,
        chegada,
        duracao,
        valor,
      }
    }).filter((entry) => entry.empresa || entry.horario || entry.valor)

    return {
      resultados,
      empresa: resultados[0]?.empresa || "",
      temResultado: resultados.length > 0,
    }
  })

  const disponivel = encontrouIdJovem || encontrouGratuidade || encontrouDisponibilidade || pageData.temResultado
  const detalhes = disponivel
    ? pageData.resultados.length > 0
      ? "Passagens visíveis na página do ClickBus"
      : "Passagens visíveis na página do ClickBus"
    : "Nenhum resultado visível no ClickBus"

  return {
    disponivel,
    vagasIdJovem: encontrouIdJovem ? 1 : 0,
    detalhes,
    siteUrl: url,
    empresa: pageData.empresa || undefined,
    resultados: pageData.resultados,
  }
}
