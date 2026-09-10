import { ResultItem, ScraperResult } from "../types"

function normalizarSlug(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export class ClickBusSession {
  private browser: any = null
  private context: any = null

  async init() {
    if (!this.browser) {
      try {
        const isServerless = Boolean(process.env.VERCEL)
        const { chromium: playwrightChromium } = await import("playwright-core")
        const chromium = isServerless ? (await import("@sparticuz/chromium")).default : null
        const launchOptions = isServerless
          ? {
              args: chromium!.args,
              executablePath: await chromium!.executablePath(),
              headless: true,
            }
          : {
              args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
              headless: true,
            }

        this.browser = await playwrightChromium.launch(launchOptions)
        this.context = await this.browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          viewport: { width: 1280, height: 800 },
        })
        // Bloqueia assets pesados para máxima performance
        await this.context.route("**/*", (route: any) => {
          const type = route.request().resourceType()
          if (["image", "font", "media", "stylesheet"].includes(type)) {
            return route.abort()
          }
          return route.continue()
        })
      } catch (err) {
        console.error("[ClickBus] Não foi possível iniciar o navegador de coleta:", err)
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
    const fromSlug = `${normalizarSlug(origem)}-${origemUF.toLowerCase()}`
    const toSlug = `${normalizarSlug(destino)}-${destinoUF.toLowerCase()}`
    const siteUrl = `https://www.clickbus.com.br/onibus/${fromSlug}/${toSlug}?departureDate=${dataIso}${idJovem ? "&gratuity=true" : ""}`

    await this.init()

    if (!this.context) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "ClickBus indisponível para consulta automática neste ambiente.",
        siteUrl,
        provedor: "ClickBus",
        empresa: "ClickBus",
        dataConsultada: dataIso,
        resultados: [],
        error: "BROWSER_INIT_FAILED",
      }
    }

    const page = await this.context.newPage()
    let capturedBff: any = null

    const responseHandler = async (res: any) => {
      const url = res.url()
      if (url.includes("bff.clickbus.com") && (url.includes("/v5/trips") || url.includes("/v6/trips"))) {
        try {
          capturedBff = await res.json()
        } catch (e) {}
      }
    }

    page.on("response", responseHandler)

    try {
      await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 35000 })

      for (let i = 0; i < 12; i++) {
        if (capturedBff && capturedBff.departures) break
        await page.waitForTimeout(400)
      }

      page.off("response", responseHandler)
      await page.close()

      const departures = capturedBff?.departures || []
      const resultados: ResultItem[] = []
      let totalVagasIdJovem = 0

      for (const trip of departures) {
        const companyName = trip.travelCompany?.name || trip.company?.name || "Viação"
        const priceNum = trip.price != null ? Number(trip.price) : undefined
        const isLowFare = trip.isLowFare === true
        const anttClass = trip.anttServiceClass?.name || ""
        const isConvencional = anttClass.toLowerCase().includes("convencional")
        const availableSeats = trip.availableSeats ?? 0

        // No modo ID Jovem: filtra tarifas low fare ou viagens convencionais com assentos livres
        const temBeneficioIdJovem = isLowFare || (isConvencional && availableSeats > 0)

        if (idJovem && !temBeneficioIdJovem) {
          continue
        }

        if (temBeneficioIdJovem) {
          totalVagasIdJovem++
        }

        const horarioPartida = trip.departure?.schedule?.time?.slice(0, 5) || "N/A"
        const horarioChegada = trip.arrival?.schedule?.time?.slice(0, 5) || "N/A"
        const duracao =
          typeof trip.duration?.hours === "string"
            ? trip.duration.hours
            : trip.duration?.hours
            ? `${trip.duration.hours}h`
            : "N/A"

        resultados.push({
          empresa: companyName,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: idJovem && temBeneficioIdJovem ? "R$ 0,00" : priceNum != null ? `R$ ${priceNum.toFixed(2).replace(".", ",")}` : undefined,
          valorNumerico: idJovem && temBeneficioIdJovem ? 0 : priceNum,
          classe: trip.serviceClass?.name || anttClass || "Convencional",
          tipoGratuidade: temBeneficioIdJovem ? "id_jovem_100" : "nenhuma",
          vagasIdJovem: temBeneficioIdJovem ? 2 : 0,
          poltronasLivres: availableSeats,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data: dataIso,
          linkCompra: siteUrl,
        })
      }

      return {
        disponivel: resultados.length > 0,
        vagasIdJovem: totalVagasIdJovem,
        detalhes: `${resultados.length} viagem(ns) encontrada(s) na ClickBus para ${dataIso}`,
        siteUrl,
        empresa: "ClickBus",
        provedor: "ClickBus",
        dataConsultada: dataIso,
        resultados,
      }
    } catch (err: any) {
      page.off("response", responseHandler)
      await page.close().catch(() => {})
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: `Falha na consulta ClickBus: ${err?.message || err}`,
        siteUrl,
        provedor: "ClickBus",
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

// Instância singleton para reuso em consultas de intervalo
let globalSession: ClickBusSession | null = null

export async function getClickBusSession(): Promise<ClickBusSession> {
  if (!globalSession) {
    globalSession = new ClickBusSession()
  }
  return globalSession
}
