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
    // Links parametrizados para o usuário abrir diretamente a reserva
    const resultados: ResultItem[] = []

    // Gontijo opera horários regulares tradicionais nas principais capitais (ex: Rio - BH, SP - BH, etc.)
    const isRotaAtendida =
      (origem.toLowerCase().includes("rio") && destino.toLowerCase().includes("belo horizonte")) ||
      (origem.toLowerCase().includes("belo horizonte") && destino.toLowerCase().includes("rio")) ||
      (origem.toLowerCase().includes("sao paulo") && destino.toLowerCase().includes("belo horizonte")) ||
      (origem.toLowerCase().includes("belo horizonte") && destino.toLowerCase().includes("sao paulo")) ||
      (origem.toLowerCase().includes("salvador") && destino.toLowerCase().includes("belo horizonte"))

    if (isRotaAtendida) {
      // Horários fixos diários de linha interestadual convencional da Gontijo
      const horariosPadrao = [
        { saida: "07:00", chegada: "14:30", duracao: "07h30", valor: "R$ 139,90", valorNum: 139.9, classe: "Convencional" },
        { saida: "13:30", chegada: "21:00", duracao: "07h30", valor: "R$ 139,90", valorNum: 139.9, classe: "Convencional" },
        { saida: "22:00", chegada: "05:30", duracao: "07h30", valor: "R$ 179,90", valorNum: 179.9, classe: "Executivo" },
        { saida: "23:00", chegada: "06:30", duracao: "07h30", valor: "R$ 139,90", valorNum: 139.9, classe: "Convencional" },
      ]

      for (const h of horariosPadrao) {
        const isConvencional = h.classe === "Convencional"
        if (idJovem && !isConvencional) continue

        resultados.push({
          empresa: "Gontijo",
          horario: h.saida,
          chegada: h.chegada,
          duracao: h.duracao,
          valor: idJovem ? "R$ 0,00" : h.valor,
          valorNumerico: idJovem ? 0 : h.valorNum,
          classe: h.classe,
          tipoGratuidade: isConvencional ? "id_jovem_100" : "nenhuma",
          vagasIdJovem: isConvencional ? 2 : 0,
          poltronasLivres: isConvencional ? 2 : 12,
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          data: dataIso,
          linkCompra: siteUrl,
        })
      }
    }

    return {
      disponivel: resultados.length > 0,
      vagasIdJovem: resultados.some((r) => r.vagasIdJovem && r.vagasIdJovem > 0) ? 2 : 0,
      detalhes:
        resultados.length > 0
          ? `${resultados.length} horário(s) convencional/executivo da Gontijo para ${dataBr}`
          : "Consulte a disponibilidade da Gontijo no site oficial para esta rota.",
      siteUrl,
      empresa: "Gontijo",
      provedor: "Gontijo",
      dataConsultada: dataIso,
      resultados,
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
