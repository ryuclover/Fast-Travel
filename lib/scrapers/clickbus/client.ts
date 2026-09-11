import { ResultItem, ScraperResult } from "../types"
import { createHash, randomUUID } from "node:crypto"

const CLICKBUS_SECRET = "2a8e4222-9c42-342e-efa5-9132c8ode00e"
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

// Mapeamento de grandes regiões metropolitanas e capitais onde a ClickBus adota o slug agregador "-todos"
const METROPOLITAN_SLUGS: Record<string, string> = {
  "sao-paulo-sp": "sao-paulo-sp-todos",
  "rio-de-janeiro-rj": "rio-de-janeiro-rj-todos",
  "belo-horizonte-mg": "belo-horizonte-mg-todos",
  "curitiba-pr": "curitiba-pr-todos",
  "campinas-sp": "campinas-sp-todos",
  "brasilia-df": "brasilia-df-todos",
  "salvador-ba": "salvador-ba-todos",
  "florianopolis-sc": "florianopolis-sc-todos",
  "porto-alegre-rs": "porto-alegre-rs-todos",
  "goiania-go": "goiania-go-todos",
  "vitoria-es": "vitoria-es-todos",
  "recife-pe": "recife-pe-todos",
  "fortaleza-ce": "fortaleza-ce-todos",
  "natal-rn": "natal-rn-todos",
  "maceio-al": "maceio-al-todos",
  "joao-pessoa-pb": "joao-pessoa-pb-todos",
  "aracaju-se": "aracaju-se-todos",
  "campo-grande-ms": "campo-grande-ms-todos",
  "cuiaba-mt": "cuiaba-mt-todos",
  "manaus-am": "manaus-am-todos",
  "belem-pa": "belem-pa-todos",
  "sao-luis-ma": "sao-luis-ma-todos",
  "teresina-pi": "teresina-pi-todos",
}

// Cache de slugs dinâmicos consultados no endpoint /web/api/v4/places
const slugCache = new Map<string, string>()

function normalizarSlug(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function gerarSecureToken(relativeUrl: string, userAgent = DEFAULT_USER_AGENT): string {
  const payload = {
    "fp-cb": "",
    "user-agent": userAgent,
  }
  const obj = {
    s: CLICKBUS_SECRET,
    u: relativeUrl,
    e: payload,
  }
  return createHash("sha1").update(JSON.stringify(obj)).digest("hex")
}

async function resolverSlugClickBus(cidade: string, uf: string): Promise<string> {
  const baseKey = `${normalizarSlug(cidade)}-${uf.toLowerCase()}`
  if (METROPOLITAN_SLUGS[baseKey]) {
    return METROPOLITAN_SLUGS[baseKey]
  }
  if (slugCache.has(baseKey)) {
    return slugCache.get(baseKey)!
  }

  // Tenta consultar a API pública de lugares da ClickBus
  try {
    const relativeUrl = `/web/api/v4/places?name=${encodeURIComponent(cidade)}&clientId=2`
    const token = gerarSecureToken(relativeUrl)
    const response = await fetch(`https://bff.clickbus.com${relativeUrl}`, {
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        "st-cb-px": token,
        accept: "application/json",
        referer: "https://www.clickbus.com.br/",
      },
      signal: AbortSignal.timeout(3500),
    })

    if (response.ok) {
      const places = await response.json()
      if (Array.isArray(places) && places.length > 0) {
        // Encontra o melhor match para o estado correspondente
        const matchUf = places.find(
          (p) =>
            p.state?.code?.toLowerCase() === uf.toLowerCase() ||
            p.state?.name?.toLowerCase() === uf.toLowerCase()
        )
        const chosen = matchUf || places[0]
        if (chosen?.slug) {
          slugCache.set(baseKey, chosen.slug)
          return chosen.slug
        }
      }
    }
  } catch {
    // Ignora erro de resolução dinâmica e segue para o slug padrão
  }

  slugCache.set(baseKey, baseKey)
  return baseKey
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
  const normOrigem = normalizarSlug(origem)
  const normDestino = normalizarSlug(destino)

  for (const trip of trips) {
    const part = trip.parts?.[0] || trip
    const partidaData = part.departure?.date || trip.departure?.date
    if (partidaData && partidaData !== dataIso) continue

    const depState = part.departure?.state || trip.departure?.state || ""
    const arrState = part.arrival?.state || trip.arrival?.state || ""
    if (depState && origemUF && depState.toUpperCase() !== origemUF.toUpperCase()) continue
    if (arrState && destinoUF && arrState.toUpperCase() !== destinoUF.toUpperCase()) continue

    const depCity = part.departure?.city || trip.departure?.city || ""
    const arrCity = part.arrival?.city || trip.arrival?.city || ""
    if (depCity) {
      const nDepCity = normalizarSlug(depCity)
      if (nDepCity !== normOrigem && !nDepCity.includes(normOrigem) && !normOrigem.includes(nDepCity)) {
        continue
      }
    }
    if (arrCity) {
      const nArrCity = normalizarSlug(arrCity)
      if (nArrCity !== normDestino && !nArrCity.includes(normDestino) && !normDestino.includes(nArrCity)) {
        continue
      }
    }

    const companyName =
      part.travelCompany?.name ||
      trip.travelCompany?.name ||
      trip.company?.name ||
      "Viação"
    const priceNum = trip.price != null ? Number(trip.price) : undefined
    const isLowFare = part.isLowFare === true || trip.isLowFare === true
    const anttClass = part.serviceClass?.name || trip.anttServiceClass?.name || ""
    const isConvencional = anttClass.toLowerCase().includes("convencional")
    const availableSeats = part.availableSeats ?? trip.availableSeats ?? 0
    const temBeneficioIdJovem = isLowFare || (isConvencional && availableSeats > 0)

    if (idJovem && !temBeneficioIdJovem) continue

    const horarioPartida =
      part.departure?.time?.slice(0, 5) ||
      trip.departure?.schedule?.time?.slice(0, 5) ||
      "N/A"
    const horarioChegada =
      part.arrival?.time?.slice(0, 5) ||
      trip.arrival?.schedule?.time?.slice(0, 5) ||
      "N/A"

    const duracao =
      typeof trip.duration === "string"
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
      valor:
        idJovem && temBeneficioIdJovem
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
  async init() {
    // Modo HTTP nativo com assinatura de Secure Token — sem necessidade de navegador
  }

  async buscarData(
    origem: string,
    origemUF: string,
    destino: string,
    destinoUF: string,
    dataIso: string,
    idJovem = false
  ): Promise<ScraperResult> {
    const fromSlug = await resolverSlugClickBus(origem, origemUF)
    const toSlug = await resolverSlugClickBus(destino, destinoUF)
    const siteUrl = `https://www.clickbus.com.br/onibus/${fromSlug}/${toSlug}?departureDate=${dataIso}${idJovem ? "&gratuity=true" : ""}`

    const relativeUrl = `/web/api/v6/trips?from=${fromSlug}&to=${toSlug}&departureDate=${dataIso}&clientId=2`
    const fullUrl = `https://bff.clickbus.com${relativeUrl}`

    try {
      const token = gerarSecureToken(relativeUrl)
      const response = await fetch(fullUrl, {
        headers: {
          "user-agent": DEFAULT_USER_AGENT,
          "st-cb-px": token,
          accept: "application/json, text/plain, */*",
          referer: "https://www.clickbus.com.br/",
          "cb-front-version": "0.15.108",
          "content-type": "application/json",
          "x-transaction-id": `SEARCH-MFE-${randomUUID()}`,
          "x-customer-session-id": `Web-${randomUUID()}`,
        },
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        // Se a rota não existe no ClickBus ou retornou 404 (ex: Place not found), tratamos sem erro
        if (response.status === 404) {
          return {
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Nenhuma linha operada pela ClickBus encontrada para este trecho.",
            siteUrl,
            empresa: "ClickBus",
            provedor: "ClickBus",
            dataConsultada: dataIso,
            resultados: [],
          }
        }

        console.warn(`[ClickBus] Resposta HTTP ${response.status} para ${relativeUrl}`)
        return {
          disponivel: false,
          vagasIdJovem: 0,
          detalhes: "Consulte o portal oficial da ClickBus para disponibilidade nesta rota.",
          siteUrl,
          empresa: "ClickBus",
          provedor: "ClickBus",
          dataConsultada: dataIso,
          resultados: [],
        }
      }

      const json = await response.json()
      const trips = Array.isArray(json.trips) ? json.trips : []

      if (trips.length > 0) {
        const resultados = converterTripsClickBus(
          trips,
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

      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "Nenhuma viagem disponível na ClickBus para esta data.",
        siteUrl,
        empresa: "ClickBus",
        provedor: "ClickBus",
        dataConsultada: dataIso,
        resultados: [],
      }
    } catch (err: any) {
      console.warn(`[ClickBus] Erro ao consultar ${relativeUrl}:`, err?.message || err)
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "Consulte o portal oficial da ClickBus para disponibilidade nesta rota.",
        siteUrl,
        empresa: "ClickBus",
        provedor: "ClickBus",
        dataConsultada: dataIso,
        resultados: [],
      }
    }
  }

  async close() {
    // Sem necessidade de fechamento de navegador
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
