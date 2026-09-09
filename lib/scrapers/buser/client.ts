import { ResultItem, ScraperResult } from "../types"

function normalizarSlugBuser(cidade: string, uf: string): string {
  const clean = cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  return `${clean}-${uf.toLowerCase()}`
}

export class BuserSession {
  private browser: any = null
  private context: any = null

  async init() {
    if (!this.browser) {
      try {
        const { chromium } = await import("playwright")
        this.browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        })
        this.context = await this.browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          viewport: { width: 1280, height: 800 },
        })
        await this.context.route("**/*", (route: any) => {
          const type = route.request().resourceType()
          if (["image", "font", "media"].includes(type)) {
            return route.abort()
          }
          return route.continue()
        })
      } catch (err) {
        console.warn("[Buser] Playwright indisponível neste ambiente (ex: Serverless / Vercel). Modo link direto ativado.")
        this.browser = null
        this.context = null
      }
    }
  }

  async buscarData(
    origem: string,
    origemUF: string,
    destino: string,
    destinoUF: string,
    dataIso: string,
    idJovem = false
  ): Promise<ScraperResult> {
    // Buser é fretamento colaborativo / marketplace de fretados, logo não possui gratuidade governamental ID Jovem
    if (idJovem) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "Buser opera por fretamento colaborativo e não emite ID Jovem governamental.",
        siteUrl: "https://www.buser.com.br",
        provedor: "Buser",
        empresa: "Buser",
        dataConsultada: dataIso,
        resultados: [],
      }
    }

    const fromSlug = normalizarSlugBuser(origem, origemUF)
    const toSlug = normalizarSlugBuser(destino, destinoUF)
    const siteUrl = `https://www.buser.com.br/onibus/${fromSlug}/${toSlug}?ida=${dataIso}`

    await this.init()

    if (!this.context) {
      return {
        disponivel: true,
        vagasIdJovem: 0,
        detalhes: "Consulta direta disponível no portal oficial da Buser.",
        siteUrl,
        provedor: "Buser",
        empresa: "Buser",
        dataConsultada: dataIso,
        resultados: [],
      }
    }

    const page = await this.context!.newPage()

    try {
      await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 35000 })
      await page.waitForTimeout(4000)

      const trips = await page.evaluate((urlCompra: string) => {
        const results: any[] = []
        const cardElements = document.querySelectorAll(".grupo-novo-card, .itinerario-resumido-novo-card")

        cardElements.forEach((el) => {
          const text = (el as HTMLElement).innerText || ""
          if (!text.includes("R$")) return

          const times = text.match(/\b\d{2}:\d{2}\b/g) || []
          const priceMatch = text.match(/R\$\s*(\d+[.,]\d{2})/)
          const classeMatch = text.match(/\b(Leito Individual|Leito|Semileito|Semi-Leito|Executivo|Cama)\b/i)
          const durationMatch = text.match(/\b\d+h\d*m*(?:in)?\b/i)

          if (times.length >= 2 && priceMatch) {
            const rawPrice = priceMatch[1].replace(",", ".")
            const priceNum = parseFloat(rawPrice)

            results.push({
              empresa: "Buser",
              horario: times[0],
              chegada: times[1],
              duracao: durationMatch ? durationMatch[0] : "Direto",
              valor: `R$ ${rawPrice.replace(".", ",")}`,
              valorNumerico: priceNum,
              classe: classeMatch ? classeMatch[0] : "Semi-leito",
              linkCompra: urlCompra,
            })
          }
        })

        const uniqueMap = new Map()
        for (const r of results) {
          const key = `${r.horario}-${r.chegada}-${r.valorNumerico}-${r.classe}`
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, r)
          }
        }
        return Array.from(uniqueMap.values())
      }, siteUrl)

      await page.close()

      const resultados: ResultItem[] = trips.map((t: any) => ({
        empresa: "Buser",
        horario: t.horario,
        chegada: t.chegada,
        duracao: t.duracao,
        valor: t.valor,
        valorNumerico: t.valorNumerico,
        classe: t.classe,
        tipoGratuidade: "nenhuma",
        vagasIdJovem: 0,
        origem: `${origem} - ${origemUF}`,
        destino: `${destino} - ${destinoUF}`,
        data: dataIso,
        linkCompra: siteUrl,
      }))

      return {
        disponivel: resultados.length > 0,
        vagasIdJovem: 0,
        detalhes: `${resultados.length} opção(ões) de fretamento encontradas na Buser para ${dataIso}`,
        siteUrl,
        empresa: "Buser",
        provedor: "Buser",
        dataConsultada: dataIso,
        resultados,
      }
    } catch (err: any) {
      await page.close().catch(() => {})
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: `Falha na consulta Buser: ${err?.message || err}`,
        siteUrl,
        empresa: "Buser",
        provedor: "Buser",
        dataConsultada: dataIso,
        resultados: [],
        error: err?.message || String(err),
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.context = null
    }
  }
}

let globalBuserSession: BuserSession | null = null

export async function getBuserSession(): Promise<BuserSession> {
  if (!globalBuserSession) {
    globalBuserSession = new BuserSession()
  }
  return globalBuserSession
}

export async function scrapeBuser(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  idJovem = false
): Promise<ScraperResult> {
  const session = await getBuserSession()
  return session.buscarData(origem, origemUF, destino, destinoUF, dataIso, idJovem)
}
