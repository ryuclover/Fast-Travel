import { ResultItem, ScraperResult } from "../types"
import { fetchWithRetry } from "../../http-client"

function normalizarSlugEmbarca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export async function scrapeEmbarca(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  idJovem = false
): Promise<ScraperResult> {
  const origemParam = `${origem} - ${origemUF}`
  const destinoParam = `${destino} - ${destinoUF}`
  const siteUrl = `https://www.embarca.ai/busca?origem=${encodeURIComponent(
    origemParam
  )}&destino=${encodeURIComponent(destinoParam)}&dataIda=${dataIso}${idJovem ? "&beneficio=id_jovem" : ""}`

  try {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Embarca.ai ainda não possui consulta automática implementada para esta rota.",
      siteUrl,
      empresa: "Embarca.ai",
      provedor: "Embarca.ai",
      dataConsultada: dataIso,
      resultados: [],
      error: "COVERAGE_NOT_IMPLEMENTED",
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
