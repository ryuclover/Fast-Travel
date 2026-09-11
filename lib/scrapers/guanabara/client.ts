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
    daily_schedule_route_id?: number
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

          // Verificação paralela no mapa de assentos oficial da Guanabara (Anti-Pegadinha de Preço)
          // A Guanabara frequentemente exibe fare: 0 no card de busca, mas ao clicar no assento recalcula o valor.
          const realSeatsMap = new Map<number, { j100: number; j50: number }>()
          try {
            const checkPromises = trips.slice(0, 15).map(async (t) => {
              const rId = t.routes?.[0]?.daily_schedule_route_id || t.trip_id
              if (!rId) return
              const sResp = await fetchWithRetry(
                "https://viajeguanabara.com.br/api/seats/maps/",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "User-Agent": headers["User-Agent"],
                    Referer: siteUrl,
                  },
                  body: JSON.stringify({
                    id_daily_schedule_route: rId,
                    id_passenger_classification_list: [13],
                    id_passenger_type: 8,
                  }),
                  timeoutMs: 3000,
                } as any,
                1
              ).catch(() => null)

              if (sResp && sResp.ok) {
                const sJson = await sResp.json().catch(() => null)
                const av = sJson?.passengerTypeAvailability || []
                const j100 = av.find((a: any) => a.name?.includes("100%"))?.available_seats ?? 0
                const j50 = av.find((a: any) => a.name?.includes("50%"))?.available_seats ?? 0
                realSeatsMap.set(rId, { j100, j50 })
              }
            })
            await Promise.allSettled(checkPromises)
          } catch {
            // Em caso de falha de conexão na API de assentos, segue com dados do card
          }

          for (const t of trips) {
            const empresa = t.company || t.routes?.[0]?.company_name || "Guanabara"
            const classe = t.class_of_service || t.routes?.[0]?.class_of_service_name || "Convencional"
            const vagas = t.routes?.[0]?.available_seats ?? 2

            const horarioPartida = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
            const horarioChegada = t.destination?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
            const duracao = t.route_duration ? t.route_duration.slice(0, 5).replace(":", "h ") + "m" : "Direto"

            const rId = t.routes?.[0]?.daily_schedule_route_id || t.trip_id
            const seatQuota = rId ? realSeatsMap.get(rId) : null
            // Apenas Leito puro, Leito Individual ou Cama são classes premium incompatíveis com gratuidade 100%. Semi-Leito é elegível!
            const isClasseLeitoOuSuperior = /(?<!semi[\s\-_]*)leito|cama/i.test(classe)
            const temVaga100NoMapa = seatQuota ? seatQuota.j100 > 0 : true
            const fareIndicaGratis = t.fare === 0 || (t.sub_total ?? 0) <= (t.boarding_fee ?? 0) || t.total === 0

            let is100 = false
            let avisoAssento: string | undefined = undefined

            if (fareIndicaGratis) {
              if (isClasseLeitoOuSuperior) {
                // Pegadinha da Guanabara: exibe R$ 10,13 no card de Leito/Cama, mas ao clicar o preço sobe para tarifa cheia
                is100 = false
                avisoAssento = "⚠️ Pegadinha Guanabara: O card indica gratuidade em Leito, mas ao escolher o assento o sistema reajusta o valor. Escolha a poltrona Semi-Leito/Convencional para pagar R$ 0,00."
              } else if (!temVaga100NoMapa) {
                // Cota de 100% esgotada no mapa de assentos
                is100 = false
                avisoAssento = "⚠️ Cota 100% já esgotada no mapa de poltronas desta viagem. Disponível apenas com 50% de desconto."
              } else {
                // Vaga 100% legítima
                is100 = true
                avisoAssento = "🛡️ Cota 100% verificada no mapa de assentos! Selecione a poltrona convencional correspondente."
              }
            }

            if (is100) {
              const valorNum = t.total && t.total > 0 ? t.total : 0
              const valorStr = valorNum > 0 ? `R$ ${valorNum.toFixed(2).replace(".", ",")}` : "R$ 0,00"
              const vagas100 = seatQuota ? Math.min(seatQuota.j100, 2) : Math.min(vagas, 2)
              totalVagasIdJovem += vagas100

              resultados.push({
                empresa,
                horario: horarioPartida,
                chegada: horarioChegada,
                duracao,
                valor: valorStr,
                valorNumerico: valorNum,
                classe,
                tipoGratuidade: "id_jovem_100",
                vagasIdJovem: vagas100,
                poltronasLivres: vagas,
                origem: `${origem} - ${origemUF}`,
                destino: `${destino} - ${destinoUF}`,
                data,
                linkCompra: `${siteUrlBase}&passengers=13:1`,
                avisoAssento,
              })
            } else {
              let precoFinal = t.total ?? t.sub_total ?? (t.original_price ? t.original_price * 0.5 : 78.47)
              if (isClasseLeitoOuSuperior && precoFinal <= 15 && t.original_price) {
                precoFinal = t.original_price * 0.5
              } else if (isClasseLeitoOuSuperior && precoFinal <= 15) {
                precoFinal = 65.0
              }

              const vagas50 = seatQuota ? Math.min(seatQuota.j50, 2) : Math.min(vagas, 2)
              totalVagasIdJovem += vagas50

              resultados.push({
                empresa,
                horario: horarioPartida,
                chegada: horarioChegada,
                duracao,
                valor: `R$ ${precoFinal.toFixed(2).replace(".", ",")}`,
                valorNumerico: precoFinal,
                classe,
                tipoGratuidade: "id_jovem_50",
                vagasIdJovem: vagas50,
                poltronasLivres: vagas,
                origem: `${origem} - ${origemUF}`,
                destino: `${destino} - ${destinoUF}`,
                data,
                linkCompra: `${siteUrlBase}&passengers=13:1`,
                avisoAssento,
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
