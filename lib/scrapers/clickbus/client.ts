import { ResultItem, ScraperResult } from "../types"
import { fetchWithRetry } from "../../http-client"
import { randomUUID } from "node:crypto"

function normalizarSlug(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function converterTripsClickBus(
  trips: any[],
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  siteUrl: string,
  idJovem: boolean
): ResultItem[] {
  const resultados: ResultItem[] = []

  for (const trip of trips) {
    const part = trip.parts?.[0] || trip
    const companyName = part.travelCompany?.name || trip.travelCompany?.name || trip.company?.name || "Viação"
    const priceNum = trip.price != null ? Number(trip.price) : undefined
    const isLowFare = part.isLowFare === true || trip.isLowFare === true
    const anttClass = part.serviceClass?.name || trip.anttServiceClass?.name || ""
    const isConvencional = anttClass.toLowerCase().includes("convencional")
    const availableSeats = part.availableSeats ?? trip.availableSeats ?? 0
    const temBeneficioIdJovem = isLowFare || (isConvencional && availableSeats > 0)

    if (idJovem && !temBeneficioIdJovem) continue

    resultados.push({
      empresa: companyName,
      horario: part.departure?.time?.slice(0, 5) || trip.departure?.schedule?.time?.slice(0, 5) || "N/A",
      chegada: part.arrival?.time?.slice(0, 5) || trip.arrival?.schedule?.time?.slice(0, 5) || "N/A",
      duracao: typeof trip.duration === "string"
        ? trip.duration
        : typeof trip.duration?.hours === "string"
          ? trip.duration.hours
          : part.duration || "N/A",
      valor: idJovem && temBeneficioIdJovem
        ? "R$ 0,00"
        : priceNum != null
          ? `R$ ${priceNum.toFixed(2).replace(".", ",")}`
          : undefined,
      valorNumerico: idJovem && temBeneficioIdJovem ? 0 : priceNum,
      classe: part.serviceClass?.name || trip.serviceClass?.name || anttClass || "Convencional",
      tipoGratuidade: temBeneficioIdJovem ? "id_jovem_100" : "nenhuma",
      vagasIdJovem: temBeneficioIdJovem ? 2 : 0,
      poltronasLivres: availableSeats,
      origem: `${origem} - ${origemUF}`,
      destino: `${destino} - ${destinoUF}`,
      data: dataIso,
      linkCompra: siteUrl,
    })
  }

  return resultados
}

export class ClickBusSession {
  private browser: any = null
  private context: any = null
  private browserInitError = ""

  async init() {
    if (!this.browser) {
      try {
        const isServerless = process.platform === "linux"
        const { chromium: playwrightChromium } = isServerless
          ? await import("playwright-core")
          : await import("playwright")
        const chromium = isServerless ? (await import("@sparticuz/chromium")).default : null
        if (chromium) chromium.setGraphicsMode = false
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
        this.browserInitError = err instanceof Error ? err.message : String(err)
        console.error("[ClickBus] Não foi possível iniciar o navegador de coleta:", {
          node: process.version,
          platform: process.platform,
          vercel: process.env.VERCEL,
          error: err instanceof Error ? err.message : String(err),
        })
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

    try {
      const response = await fetchWithRetry(
        `https://bff.clickbus.com/web/api/v6/trips?from=${fromSlug}&to=${toSlug}&departureDate=${dataIso}&clientId=2`,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: "https://www.clickbus.com.br/",
            "cb-front-version": "0.15.108",
            "content-type": "application/json",
            "x-transaction-id": `SEARCH-MFE-${randomUUID()}`,
            "x-customer-session-id": `Web-${randomUUID()}`,
          },
        }
      )
      const json = await response.json()
      if (Array.isArray(json.trips) && json.trips.length > 0) {
        const resultados = converterTripsClickBus(
          json.trips,
          origem,
          origemUF,
          destino,
          destinoUF,
          dataIso,
          siteUrl,
          idJovem
        )
        return {
          disponivel: resultados.length > 0,
          vagasIdJovem: resultados.reduce((total, item) => total + (item.vagasIdJovem || 0), 0),
          detalhes: `${resultados.length} viagem(ns) encontrada(s) na ClickBus para ${dataIso}`,
          siteUrl,
          empresa: "ClickBus",
          provedor: "ClickBus",
          dataConsultada: dataIso,
          resultados,
        }
      }

      if (Array.isArray(json.trips)) {
        console.warn("[ClickBus] BFF HTTP respondeu sem viagens; confirmando pela sessão do site")
      }
    } catch (error) {
      console.warn("[ClickBus] Fallback HTTP indisponível; tentando navegador:", error)
    }

    await this.init()

    if (!this.context) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: `ClickBus indisponível para consulta automática: ${this.browserInitError || "erro desconhecido"}`,
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
        if (capturedBff && (capturedBff.trips || capturedBff.departures)) break
        await page.waitForTimeout(400)
      }

      page.off("response", responseHandler)
      await page.close()

      const trips = capturedBff?.trips || capturedBff?.departures || []
      const resultados: ResultItem[] = []
      let totalVagasIdJovem = 0

      for (const trip of trips) {
        const part = trip.parts?.[0] || trip
        const companyName = part.travelCompany?.name || trip.travelCompany?.name || trip.company?.name || "Viação"
        const priceNum = trip.price != null ? Number(trip.price) : undefined
        const isLowFare = part.isLowFare === true || trip.isLowFare === true
        const anttClass = part.serviceClass?.name || trip.anttServiceClass?.name || ""
        const isConvencional = anttClass.toLowerCase().includes("convencional")
        const availableSeats = part.availableSeats ?? trip.availableSeats ?? 0

        // No modo ID Jovem: filtra tarifas low fare ou viagens convencionais com assentos livres
        const temBeneficioIdJovem = isLowFare || (isConvencional && availableSeats > 0)

        if (idJovem && !temBeneficioIdJovem) {
          continue
        }

        if (temBeneficioIdJovem) {
          totalVagasIdJovem++
        }

        const horarioPartida = part.departure?.time?.slice(0, 5) || trip.departure?.schedule?.time?.slice(0, 5) || "N/A"
        const horarioChegada = part.arrival?.time?.slice(0, 5) || trip.arrival?.schedule?.time?.slice(0, 5) || "N/A"
        const duracao = typeof trip.duration === "string"
          ? trip.duration
          : typeof trip.duration?.hours === "string"
            ? trip.duration.hours
            : trip.duration?.hours
              ? `${trip.duration.hours}h`
              : part.duration || "N/A"

        resultados.push({
          empresa: companyName,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: idJovem && temBeneficioIdJovem ? "R$ 0,00" : priceNum != null ? `R$ ${priceNum.toFixed(2).replace(".", ",")}` : undefined,
          valorNumerico: idJovem && temBeneficioIdJovem ? 0 : priceNum,
          classe: part.serviceClass?.name || trip.serviceClass?.name || anttClass || "Convencional",
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
        detalhes: capturedBff
          ? `${resultados.length} viagem(ns) confirmada(s) pela sessão ClickBus para ${dataIso}`
          : "ClickBus não entregou resposta BFF para esta consulta.",
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
