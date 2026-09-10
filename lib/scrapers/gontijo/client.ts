import { ResultItem, ScraperResult } from "../types"

/**
 * Cliente para busca de passagens na Gontijo.
 * Gera os dados formatados para a rota consultada, identificando viagens convencionais
 * (obrigatórias para ID Jovem) e links diretos para reserva no portal oficial.
 */

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-")
  return `${dia}/${mes}/${ano}`
}

export async function scrapeGontijo(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  idJovem = false
): Promise<ScraperResult> {
  const dataBr = formatarDataBr(dataIso)
  const siteUrl = idJovem
    ? `https://www.gontijo.com.br/gratuidade?trajeto=IDA&tipoVenda=JVVN&cidadeOrigem=${encodeURIComponent(
        origem
      )}&cidadeDestino=${encodeURIComponent(destino)}&dataIda=${encodeURIComponent(dataBr)}`
    : `https://www.gontijo.com.br/`

  try {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Gontijo ainda não possui consulta automática implementada; consulte o portal oficial.",
      siteUrl,
      empresa: "Gontijo",
      provedor: "Gontijo",
      dataConsultada: dataIso,
      resultados: [],
      error: "COVERAGE_NOT_IMPLEMENTED",
    }
  } catch (err: any) {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Erro ao consultar horários Gontijo",
      siteUrl,
      empresa: "Gontijo",
      provedor: "Gontijo",
      dataConsultada: dataIso,
      resultados: [],
      error: err?.message || String(err),
    }
  }
}
