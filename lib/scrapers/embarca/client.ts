import { ResultItem, ScraperResult } from "../types"
import { fetchWithRetry } from "../../http-client"

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function montarSlugEmbarca(cidade: string, uf: string): string {
  const nomeLimpo = normalizarTexto(cidade)
  const ufLimpa = uf.toLowerCase().trim()

  // Polos metropolitanos com múltiplos terminais mapeados pela Embarca.ai
  const polosComTodos = new Set(["rio-de-janeiro", "sao-paulo", "belo-horizonte", "curitiba"])
  if (polosComTodos.has(nomeLimpo)) {
    return `${nomeLimpo}-${ufLimpa}-todos`
  }

  return `${nomeLimpo}-${ufLimpa}`
}

export async function scrapeEmbarca(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  idJovem = false
): Promise<ScraperResult> {
  const origemSlug = montarSlugEmbarca(origem, origemUF)
  const destinoSlug = montarSlugEmbarca(destino, destinoUF)
  const siteUrl = `https://www.embarca.ai/passagem-de-onibus/${origemSlug}/${destinoSlug}?departure_at=${dataIso}&round_trip=`

  try {
    const response = await fetchWithRetry(
      siteUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      },
      2
    )

    if (response.status === 404) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "Rota não operada ou sem cadastro na Embarca.ai",
        siteUrl,
        empresa: "Embarca.ai",
        provedor: "Embarca.ai",
        dataConsultada: dataIso,
        resultados: [],
        error: "COVERAGE_NOT_IMPLEMENTED",
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`)
    }

    const html = await response.text()
    const resultados: ResultItem[] = []

    // 1. Extração do streaming Next.js Server Components flight data (initialTrips)
    const matchTrips = html.match(/initialTrips\\":\[([\s\S]*?)\]/)
    if (matchTrips && matchTrips[1]) {
      try {
        const rawJson = `[${matchTrips[1].replace(/\\"/g, '"')}]`
        const trips = JSON.parse(rawJson)

        if (Array.isArray(trips)) {
          for (const t of trips) {
            const empresa = t.operator_name || t.operator?.name || "Embarca.ai"
            const partida = t.departure_at ? t.departure_at.slice(11, 16) : undefined
            const chegada = t.arrival_at ? t.arrival_at.slice(11, 16) : undefined
            const duracao =
              t.hours && t.minutes ? `${t.hours} ${t.minutes}` : t.hours ? `${t.hours}` : "Consulte site"
            const classe = t.seat_class || t.group || "Convencional"
            const precoNumerico = typeof t.price === "number" ? t.price : parseFloat(t.price) || 0
            const permiteGratuidade = t.disable_gratuity === false || t.gratuity_request_enabled === true

            if (idJovem) {
              // Se a busca é exclusiva ID Jovem e a viagem permite gratuidade
              if (permiteGratuidade) {
                resultados.push({
                  empresa,
                  horario: partida,
                  chegada,
                  duracao,
                  valor: "R$ 0,00",
                  valorNumerico: 0,
                  classe,
                  tipoGratuidade: "id_jovem_100",
                  vagasIdJovem: 2,
                  poltronasLivres: t.available_seats,
                  origem: `${origem} - ${origemUF}`,
                  destino: `${destino} - ${destinoUF}`,
                  data: dataIso,
                  linkCompra: siteUrl,
                })
              }
            } else {
              // Busca comercial padrão
              resultados.push({
                empresa,
                horario: partida,
                chegada,
                duracao,
                valor: `R$ ${precoNumerico.toFixed(2).replace(".", ",")}`,
                valorNumerico: precoNumerico,
                classe,
                tipoGratuidade: permiteGratuidade ? "id_jovem_100" : "nenhuma",
                vagasIdJovem: permiteGratuidade ? 2 : 0,
                poltronasLivres: t.available_seats,
                origem: `${origem} - ${origemUF}`,
                destino: `${destino} - ${destinoUF}`,
                data: dataIso,
                linkCompra: siteUrl,
              })
            }
          }
        }
      } catch (e) {
        console.warn("Falha ao parsear initialTrips do Embarca.ai:", e)
      }
    }

    // 2. Fallback JSON-LD BusTrip se initialTrips não foi capturado
    if (resultados.length === 0) {
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
      if (ldMatch) {
        for (const scriptTag of ldMatch) {
          try {
            const jsonText = scriptTag.replace(/<script[^>]*>/, "").replace(/<\/script>/, "")
            const data = JSON.parse(jsonText)
            if (data["@type"] === "BusTrip" && Array.isArray(data.departureTime)) {
              const offers = data.offers || {}
              const priceNum = offers.lowPrice ? parseFloat(offers.lowPrice) : undefined
              const providers = Array.isArray(data.provider) ? data.provider : []
              const defaultEmpresa = providers[0]?.name || "Embarca.ai"

              for (const time of data.departureTime) {
                resultados.push({
                  empresa: defaultEmpresa,
                  horario: time,
                  chegada: undefined,
                  duracao: data.duration?.replace("PT", "").toLowerCase() || "Consulte site",
                  valor: idJovem ? "R$ 0,00" : priceNum ? `R$ ${priceNum.toFixed(2).replace(".", ",")}` : undefined,
                  valorNumerico: idJovem ? 0 : priceNum,
                  classe: "Semi-Leito",
                  tipoGratuidade: idJovem ? "id_jovem_100" : "nenhuma",
                  vagasIdJovem: idJovem ? 2 : 0,
                  origem: `${origem} - ${origemUF}`,
                  destino: `${destino} - ${destinoUF}`,
                  data: dataIso,
                  linkCompra: siteUrl,
                })
              }
            }
          } catch {
            // continua para o próximo
          }
        }
      }
    }

    const disponivel = resultados.length > 0
    const vagasIdJovem = idJovem && disponivel ? resultados.length * 2 : 0
    const detalhes = disponivel
      ? `${resultados.length} viagem(ns) encontrada(s) na Embarca.ai`
      : idJovem
        ? "Nenhuma vaga gratuita (ID Jovem) encontrada na Embarca.ai para esta data."
        : "Nenhum horário encontrado na Embarca.ai para esta data."

    return {
      disponivel,
      vagasIdJovem,
      detalhes,
      siteUrl,
      empresa: "Embarca.ai",
      provedor: "Embarca.ai",
      dataConsultada: dataIso,
      resultados,
    }
  } catch (err: any) {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: `Erro ao consultar Embarca.ai: ${err?.message || err}`,
      siteUrl,
      empresa: "Embarca.ai",
      provedor: "Embarca.ai",
      dataConsultada: dataIso,
      resultados: [],
      error: err?.message || String(err),
    }
  }
}
