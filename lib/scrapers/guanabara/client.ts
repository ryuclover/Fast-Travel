import { ResultItem, ScraperResult } from "../types"
import { fetchWithRetry } from "../../http-client"

function formatarSlugGuanabara(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

function formatarCidadeGuanabaraApi(cidade: string, uf: string): string {
  const limpo = cidade
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
  return `${limpo} - ${uf.toUpperCase()} - TODOS`
}

interface GuanabaraTrip {
  trip_id: number
  company?: string
  class_of_service?: string
  route_duration?: string
  fare?: number
  boarding_fee?: number
  sub_total?: number
  total?: number
  original_price?: number
  passenger_classification_id?: number
  origin?: {
    location?: string
    date_time?: string
    address?: string
  }
  destination?: {
    location?: string
    date_time?: string
    address?: string
  }
  routes?: Array<{
    available_seats?: number
    class_of_service_name?: string
    company_name?: string
  }>
}

export async function fetchGuanabaraDirect(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  data: string, // YYYY-MM-DD
  idJovem = false
): Promise<ScraperResult> {
  const origemSlug = formatarSlugGuanabara(origem)
  const destinoSlug = formatarSlugGuanabara(destino)
  const origemApi = formatarCidadeGuanabaraApi(origem, origemUF)
  const destinoApi = formatarCidadeGuanabaraApi(destino, destinoUF)

  const siteUrlBase = `https://viajeguanabara.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}-todos/?departure_date=${data}`
  const siteUrl = `${siteUrlBase}&passengers=${idJovem ? "12:1" : "1"}`

  const headers = {
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Referer: siteUrl,
  }

  try {
    const resultados: ResultItem[] = []
    let totalVagasIdJovem = 0

    if (idJovem) {
      // Consulta simultaneamente:
      // passengers=12:1 -> 100% de gratuidade integral (Tarifa R$ 0,00)
      // passengers=13:1 -> 50% de desconto estatutário ID Jovem
      const [resp100, resp50] = await Promise.all([
        fetchWithRetry(
          `https://viajeguanabara.com.br/api/search/services/?departure_date=${data}&destination=${encodeURIComponent(
            destinoApi
          )}&origin=${encodeURIComponent(origemApi)}&passengers=12:1`,
          { headers }
        ).catch(() => null),
        fetchWithRetry(
          `https://viajeguanabara.com.br/api/search/services/?departure_date=${data}&destination=${encodeURIComponent(
            destinoApi
          )}&origin=${encodeURIComponent(origemApi)}&passengers=13:1`,
          { headers }
        ).catch(() => null),
      ])

      const parseTrips = async (resp: Response | null, is100: boolean) => {
        if (!resp || !resp.ok) return []
        try {
          const json = await resp.json()
          return (json.trips || []) as GuanabaraTrip[]
        } catch {
          return []
        }
      }

      const [trips100, trips50] = await Promise.all([
        parseTrips(resp100, true),
        parseTrips(resp50, false),
      ])

      const tripIdsVistos = new Set<string>()

      // 1. Processa viagens 100% gratuitas primeiro (R$ 0,00)
      for (const t of trips100) {
        const idKey = `${t.trip_id}-${t.origin?.date_time}`
        tripIdsVistos.add(idKey)
        const empresa = t.company || t.routes?.[0]?.company_name || "Guanabara"
        const classe = t.class_of_service || t.routes?.[0]?.class_of_service_name || "Convencional"
        const vagas = t.routes?.[0]?.available_seats ?? 2

        const horarioPartida = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
        const horarioChegada = t.destination?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
        const duracao = t.route_duration ? t.route_duration.slice(0, 5).replace(":", "h ") + "m" : "Direto"

        totalVagasIdJovem += vagas

        resultados.push({
          empresa,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: "R$ 0,00",
          valorNumerico: 0,
          classe,
          tipoGratuidade: "id_jovem_100",
          vagasIdJovem: Math.min(vagas, 2),
          poltronasLivres: vagas,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data,
          linkCompra: `${siteUrlBase}&passengers=12:1`,
        })
      }

      // 2. Processa viagens com 50% de desconto
      for (const t of trips50) {
        const idKey = `${t.trip_id}-${t.origin?.date_time}`
        if (tripIdsVistos.has(idKey)) continue // Já tem 100% de desconto
        tripIdsVistos.add(idKey)

        const empresa = t.company || t.routes?.[0]?.company_name || "Guanabara"
        const classe = t.class_of_service || t.routes?.[0]?.class_of_service_name || "Semi-Leito"
        const vagas = t.routes?.[0]?.available_seats ?? 2

        const horarioPartida = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
        const horarioChegada = t.destination?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
        const duracao = t.route_duration ? t.route_duration.slice(0, 5).replace(":", "h ") + "m" : "Direto"

        const precoFinal = t.total ?? t.sub_total ?? 78.47
        totalVagasIdJovem += vagas

        resultados.push({
          empresa,
          horario: horarioPartida,
          chegada: horarioChegada,
          duracao,
          valor: `R$ ${precoFinal.toFixed(2).replace(".", ",")}`,
          valorNumerico: precoFinal,
          classe,
          tipoGratuidade: "id_jovem_50",
          vagasIdJovem: Math.min(vagas, 2),
          poltronasLivres: vagas,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data,
          linkCompra: `${siteUrlBase}&passengers=13:1`,
        })
      }
    } else {
      // Modo Geral: Consulta normal com passengers=1
      const resp = await fetchWithRetry(
        `https://viajeguanabara.com.br/api/search/services/?departure_date=${data}&destination=${encodeURIComponent(
          destinoApi
        )}&origin=${encodeURIComponent(origemApi)}&passengers=1`,
        { headers }
      )

      if (resp.ok) {
        const json = await resp.json()
        const trips = (json.trips || []) as GuanabaraTrip[]

        for (const t of trips) {
          const empresa = t.company || t.routes?.[0]?.company_name || "Guanabara"
          const classe = t.class_of_service || t.routes?.[0]?.class_of_service_name || "Convencional"
          const vagas = t.routes?.[0]?.available_seats ?? 0

          const horarioPartida = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
          const horarioChegada = t.destination?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
          const duracao = t.route_duration ? t.route_duration.slice(0, 5).replace(":", "h ") + "m" : "Direto"
          const preco = t.total ?? t.sub_total ?? t.original_price ?? 99.9

          resultados.push({
            empresa,
            horario: horarioPartida,
            chegada: horarioChegada,
            duracao,
            valor: `R$ ${preco.toFixed(2).replace(".", ",")}`,
            valorNumerico: preco,
            classe,
            tipoGratuidade: "nenhuma",
            vagasIdJovem: 0,
            poltronasLivres: vagas,
            origem: `${origem} - ${origemUF}`,
            destino: `${destino} - ${destinoUF}`,
            data,
            linkCompra: `${siteUrlBase}&passengers=1`,
          })
        }
      }
    }

    const disponivel = resultados.length > 0

    return {
      disponivel,
      vagasIdJovem: totalVagasIdJovem,
      detalhes: disponivel
        ? `${resultados.length} opção(ões) na plataforma Guanabara (${resultados.map((r) => r.empresa).join(", ")})`
        : "Nenhuma viagem disponível na Guanabara para esta data.",
      siteUrl,
      empresa: "Guanabara",
      provedor: "Guanabara",
      dataConsultada: data,
      resultados,
    }
  } catch (error: any) {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: `Erro ao consultar Guanabara: ${error?.message || error}`,
      siteUrl,
      empresa: "Guanabara",
      provedor: "Guanabara",
      dataConsultada: data,
      resultados: [],
      error: error?.message || String(error),
    }
  }
}
