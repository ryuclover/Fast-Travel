import { ResultItem, ScraperResult } from "../types"

/**
 * Cliente para busca e direcionamento de passagens na Gontijo.
 * Como o backend de vendas da Gontijo é protegido por Cloudflare Turnstile interativo
 * e encriptação de ações proprietárias, o sistema valida a cobertura da rota e gera
 * links parametrizados para o portal oficial de gratuidade JVVN (Jovem de Baixa Renda).
 */

const ESTADOS_COBERTURA_GONTIJO = new Set([
  "MG", "SP", "RJ", "BA", "ES", "GO", "DF", "TO", "PE", "CE", "PB", "RN", "AL", "SE", "PI", "MA"
])

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
  const origemCoberta = ESTADOS_COBERTURA_GONTIJO.has(origemUF.toUpperCase())
  const destinoCoberto = ESTADOS_COBERTURA_GONTIJO.has(destinoUF.toUpperCase())

  const siteUrl = idJovem
    ? `https://www.gontijo.com.br/gratuidade?trajeto=IDA&tipoVenda=JVVN&cidadeOrigem=${encodeURIComponent(
        origem
      )}&cidadeDestino=${encodeURIComponent(destino)}&dataIda=${encodeURIComponent(dataBr)}`
    : `https://www.gontijo.com.br/`

  if (!origemCoberta || !destinoCoberto) {
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: `A rota ${origemUF} -> ${destinoUF} não faz parte da malha interestadual da Gontijo.`,
      siteUrl,
      empresa: "Gontijo",
      provedor: "Gontijo",
      dataConsultada: dataIso,
      resultados: [],
      error: "COVERAGE_NOT_IMPLEMENTED",
    }
  }

  // Rota coberta pela malha da Gontijo
  return {
    disponivel: false,
    vagasIdJovem: 0,
    detalhes: idJovem
      ? "Linha convencional operada pela Gontijo. Emissão de ID Jovem disponível via Portal JVVN oficial ou guichê rodoviário."
      : "Linha operada pela Gontijo. Consulte valores e poltronas diretamente no portal oficial.",
    siteUrl,
    empresa: "Gontijo",
    provedor: "Gontijo",
    dataConsultada: dataIso,
    resultados: [],
    // Sem erro de cobertura, mas orienta o link oficial
  }
}
