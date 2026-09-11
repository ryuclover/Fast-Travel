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

interface ClickBusCotasIdJovem {
  vagas100: number
  vagas50: number
  preco50?: number
  taxaEmbarque100?: number
  temIdJovem: boolean
}

function extrairDiscountsHtml(html: string): any | null {
  const idxKey = html.indexOf("discounts")
  if (idxKey === -1) return null

  const idxBrace = html.indexOf("{", idxKey)
  if (idxBrace === -1 || idxBrace - idxKey > 30) return null

  let depth = 0
  let end = -1
  let inString = false
  let escape = false

  for (let i = idxBrace; i < html.length; i++) {
    const c = html[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\") {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
  }

  if (end === -1) return null
  const rawChunk = html.slice(idxBrace, end)
  try {
    const unescaped = rawChunk.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    return JSON.parse(unescaped)
  } catch {
    return null
  }
}

async function checarCotasViagemClickBus(tripId: string): Promise<ClickBusCotasIdJovem | null> {
  const url = `https://www.clickbus.com.br/viagem?tripId=${tripId}&clientId=2&discount=true&type=direct&isLowFare=false&isInTransit=false&flow=mfe`
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(1800),
    })
    if (!res.ok) return null
    const html = await res.text()
    const discounts = extrairDiscountsHtml(html)
    if (!discounts) return null

    const yFull = discounts.youngIdFullPrice
    const yPart = discounts.youngIdPartialPrice

    const vagas100 = yFull ? Number(yFull.amount ?? 0) : 0
    const vagas50 = yPart ? Number(yPart.amount ?? 0) : 0
    const taxaEmbarque100 = yFull?.price != null ? Number(yFull.price) : 0
    const preco50 = yPart?.price != null ? Number(yPart.price) : undefined

    return {
      vagas100,
      vagas50,
      preco50,
      taxaEmbarque100,
      temIdJovem: vagas100 > 0 || vagas50 > 0,
    }
  } catch {
    return null
  }
}

async function converterTripsClickBus(
  trips: any[],
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  siteUrl: string,
  idJovem: boolean
): Promise<ResultItem[]> {
  const resultados: ResultItem[] = []
  const normOrigem = normalizarSlug(origem)
  const normDestino = normalizarSlug(destino)

  // Filtra as viagens que atendem a rota e data
  const tripsFiltrados = trips.filter((trip) => {
    const part = trip.parts?.[0] || trip
    const partidaData = part.departure?.date || trip.departure?.date
    if (partidaData && partidaData !== dataIso) return false

    const depState = part.departure?.state || trip.departure?.state || ""
    const arrState = part.arrival?.state || trip.arrival?.state || ""
    if (depState && origemUF && depState.toUpperCase() !== origemUF.toUpperCase()) return false
    if (arrState && destinoUF && arrState.toUpperCase() !== destinoUF.toUpperCase()) return false

    const depCity = part.departure?.city || trip.departure?.city || ""
    const arrCity = part.arrival?.city || trip.arrival?.city || ""
    if (depCity) {
      const nDepCity = normalizarSlug(depCity)
      if (nDepCity !== normOrigem && !nDepCity.includes(normOrigem) && !normOrigem.includes(nDepCity)) {
        return false
      }
    }
    if (arrCity) {
      const nArrCity = normalizarSlug(arrCity)
      if (nArrCity !== normDestino && !nArrCity.includes(normDestino) && !normDestino.includes(nArrCity)) {
        return false
      }
    }

    return true
  })

  // Se não for modo ID Jovem, retorna todas as viagens comerciais normais
  if (!idJovem) {
    for (const trip of tripsFiltrados) {
      const part = trip.parts?.[0] || trip
      const companyName =
        part.travelCompany?.name ||
        trip.travelCompany?.name ||
        trip.company?.name ||
        "Viação"
      const priceNum = trip.price != null ? Number(trip.price) : undefined
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
        valor: priceNum != null ? `R$ ${priceNum.toFixed(2).replace(".", ",")}` : undefined,
        valorNumerico: priceNum,
        classe: part.serviceClass?.name || trip.serviceClass?.name || "Convencional",
        tipoGratuidade: "nenhuma",
        vagasIdJovem: 0,
        poltronasLivres: part.availableSeats ?? trip.availableSeats ?? 0,
        origem: `${origem} - ${origemUF}`,
        destino: `${destino} - ${destinoUF}`,
        data: dataIso,
        linkCompra: siteUrl,
      })
    }
    return resultados
  }

  // MODO ID JOVEM:
  // Filtra candidatas potenciais (Convencional, Semi-Leito, Executivo ou hasGratuityCheckout)
  const candidatas = tripsFiltrados
    .filter((trip) => {
      const part = trip.parts?.[0] || trip
      const anttClass = (part.serviceClass?.name || trip.anttServiceClass?.name || "").toLowerCase()
      const isElegivel =
        anttClass.includes("convencional") ||
        anttClass.includes("semi") ||
        anttClass.includes("executivo") ||
        !/(?<!semi[\s\-_]*)leito|cama/i.test(anttClass)
      const hasGratuity = trip.options?.hasGratuityCheckout === true || trip.options?.isGratuityTrip === true
      return isElegivel || hasGratuity
    })
    .sort((a, b) => {
      // Prioriza quem explicitamente tem hasGratuityCheckout marcado pelo BFF
      const aGrat = a.options?.hasGratuityCheckout === true ? 1 : 0
      const bGrat = b.options?.hasGratuityCheckout === true ? 1 : 0
      return bGrat - aGrat
    })
    .slice(0, 15)

  // Consulta cotas reais das candidatas com deadline estrito de 4.5s
  const deadline = Date.now() + 4500
  const BATCH_SIZE = 6
  for (let i = 0; i < candidatas.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) break
    const batch = candidatas.slice(i, i + BATCH_SIZE)
    const cotasBatch = await Promise.all(
      batch.map(async (trip) => {
        const part = trip.parts?.[0] || trip
        const tripId = part.tripId || trip.uuid
        if (!tripId) return { trip, cotas: null }
        const cotas = await checarCotasViagemClickBus(tripId)
        return { trip, cotas }
      })
    )

    for (const { trip, cotas } of cotasBatch) {
      // Se não tem cotas confirmadas ou ambas as cotas ID Jovem estão zeradas/esgotadas, DESCARTA (elimina falso positivo)
      if (!cotas || !cotas.temIdJovem) continue

      const part = trip.parts?.[0] || trip
      const companyName =
        part.travelCompany?.name ||
        trip.travelCompany?.name ||
        trip.company?.name ||
        "Viação"
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
      const nomeClasse = part.serviceClass?.name || trip.serviceClass?.name || "Convencional"
      const poltronasLivres = part.availableSeats ?? trip.availableSeats ?? 0

      // 1. Cota ID Jovem 100% (Grátis / Taxa de embarque)
      if (cotas.vagas100 > 0) {
        resultados.push({
          empresa: companyName,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: cotas.taxaEmbarque100 && cotas.taxaEmbarque100 > 0
            ? `R$ ${cotas.taxaEmbarque100.toFixed(2).replace(".", ",")}`
            : "R$ 0,00",
          valorNumerico: cotas.taxaEmbarque100 || 0,
          classe: `${nomeClasse} (100% ID Jovem)`,
          tipoGratuidade: "id_jovem_100",
          vagasIdJovem: cotas.vagas100,
          poltronasLivres,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data: dataIso,
          linkCompra: siteUrl,
        })
      }

      // 2. Cota ID Jovem 50% (50% de desconto)
      if (cotas.vagas50 > 0) {
        const preco50Formatado = cotas.preco50 != null
          ? `R$ ${cotas.preco50.toFixed(2).replace(".", ",")}`
          : "50% Desconto"
        resultados.push({
          empresa: companyName,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: preco50Formatado,
          valorNumerico: cotas.preco50 ?? 0,
          classe: `${nomeClasse} (50% ID Jovem)`,
          tipoGratuidade: "id_jovem_50",
          vagasIdJovem: cotas.vagas50,
          poltronasLivres,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data: dataIso,
          linkCompra: siteUrl,
        })
      }
    }
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
        const resultados = await converterTripsClickBus(
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
