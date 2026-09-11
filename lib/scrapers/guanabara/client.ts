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
  const siteUrl = `${siteUrlBase}&passengers=${idJovem ? "13:1" : "1"}`

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
      // Consulta oficial ID Jovem Guanabara (Beneficiários ID Jovem = passenger_classification_id: 13)
      // O endpoint passengers=13:1 retorna tanto vagas com 100% de gratuidade (fare = 0)
      // quanto vagas com 50% de desconto estatutário (fare > 0).
      const resp = await fetchWithRetry(
        `https://viajeguanabara.com.br/api/search/services/?departure_date=${data}&destination=${encodeURIComponent(
          destinoApi
        )}&origin=${encodeURIComponent(origemApi)}&passengers=13:1`,
        { headers, timeoutMs: 6000 } as any,
        1
      ).catch(() => null)

      if (resp && resp.ok) {
        try {
          const json = await resp.json()
          const trips = (json.trips || []) as GuanabaraTrip[]

          for (const t of trips) {
            const empresa = t.company || t.routes?.[0]?.company_name || "Guanabara"
            const classe = t.class_of_service || t.routes?.[0]?.class_of_service_name || "Convencional"
            const vagas = t.routes?.[0]?.available_seats ?? 2

            const horarioPartida = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
            const horarioChegada = t.destination?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
            const duracao = t.route_duration ? t.route_duration.slice(0, 5).replace(":", "h ") + "m" : "Direto"

            // Verifica se a tarifa é gratuita (100% ID Jovem)
            // Em viagens 100% gratuitas, fare = 0 (o usuário paga no máximo a taxa de embarque se houver)
            const is100 = t.fare === 0 || (t.sub_total ?? 0) <= (t.boarding_fee ?? 0) || t.total === 0

            totalVagasIdJovem += vagas

            if (is100) {
              const valorNum = t.total && t.total > 0 ? t.total : 0
              const valorStr = valorNum > 0 ? `R$ ${valorNum.toFixed(2).replace(".", ",")}` : "R$ 0,00"

              resultados.push({
                empresa,
                horario: horarioPartida,
                chegada: horarioChegada,
                duracao,
                valor: valorStr,
                valorNumerico: valorNum,
                classe,
                tipoGratuidade: "id_jovem_100",
                vagasIdJovem: Math.min(vagas, 2),
                poltronasLivres: vagas,
                origem: `${origem} - ${origemUF}`,
                destino: `${destino} - ${destinoUF}`,
                data,
                linkCompra: `${siteUrlBase}&passengers=13:1`,
              })
            } else {
              const precoFinal = t.total ?? t.sub_total ?? (t.original_price ? t.original_price * 0.5 : 78.47)

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
          }
        } catch {
          // Erro ao parsear JSON
        }
      }
    } else {
      // Modo Geral: Consulta normal com passengers=1
      const resp = await fetchWithRetry(
        `https://viajeguanabara.com.br/api/search/services/?departure_date=${data}&destination=${encodeURIComponent(
          destinoApi
        )}&origin=${encodeURIComponent(origemApi)}&passengers=1`,
        { headers, timeoutMs: 5000 } as any,
        1
      ).catch(() => null)

      if (resp && resp.ok) {
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
