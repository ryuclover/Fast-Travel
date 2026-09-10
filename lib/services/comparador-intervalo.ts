import {
  ResultItem,
  ScraperResult,
  ResultadoComparacaoIntervalo,
  ResumoDia,
  StatusProvedorBusca,
} from "../scrapers/types"
import { scrapeClickBus } from "../scrapers/clickbus"
import { scrapeGontijo } from "../scrapers/gontijo"
import { scrapeGuanabara } from "../scrapers/guanabara"
import { scrapeBuser } from "../scrapers/buser"
import { scrapeEmbarca } from "../scrapers/embarca"

export interface CompararIntervaloParams {
  origem: string
  origemUF: string
  destino: string
  destinoUF: string
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  idJovem?: boolean
  provedores?: Array<"ClickBus" | "Gontijo" | "Guanabara" | "Buser" | "Embarca">
  maxConcorrencia?: number
}

const TIMEOUT_PROVEDOR_MS = 10_000

function gerarListaDatas(dataInicio: string, dataFim: string): string[] {
  const inicio = new Date(`${dataInicio}T00:00:00`)
  const fim = new Date(`${dataFim}T00:00:00`)
  const datas: string[] = []

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || inicio > fim) {
    return [dataInicio]
  }

  const atual = new Date(inicio)
  while (atual <= fim) {
    datas.push(atual.toISOString().split("T")[0])
    atual.setDate(atual.getDate() + 1)
  }

  return datas
}

/**
 * Utilitário para executar promessas em lotes com concorrência controlada.
 */
async function mapConcorrente<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = []
  for (let i = 0; i < itens.length; i += limite) {
    const lote = itens.slice(i, i + limite)
    const resLote = await Promise.all(lote.map(fn))
    resultados.push(...resLote)
  }
  return resultados
}

async function executarComTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function compararPrecosIntervalo(
  params: CompararIntervaloParams
): Promise<ResultadoComparacaoIntervalo> {
  const {
    origem,
    origemUF,
    destino,
    destinoUF,
    dataInicio,
    dataFim,
    idJovem = false,
    provedores = ["ClickBus", "Gontijo", "Guanabara", "Buser", "Embarca"],
    maxConcorrencia = 1,
  } = params

  const datas = gerarListaDatas(dataInicio, dataFim)
  const todasViagens: ResultItem[] = []
  const resumoPorDia: ResumoDia[] = []
  const statusPorProvedor = new Map<string, StatusProvedorBusca>()

  // Consulta por data com controle de concorrência
  const resultadosPorData = await mapConcorrente(
    datas,
    maxConcorrencia,
    async (dataIso) => {
      const tarefasProvedores: Array<() => Promise<ScraperResult>> = []

      if (provedores.includes("ClickBus")) {
        tarefasProvedores.push(() =>
          executarComTimeout(scrapeClickBus(origem, destino, dataIso, origemUF, destinoUF, idJovem), TIMEOUT_PROVEDOR_MS).catch((err) => ({
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Erro ClickBus",
            siteUrl: "",
            provedor: "ClickBus",
            dataConsultada: dataIso,
            resultados: [],
            error: String(err),
          }))
        )
      }

      if (provedores.includes("Gontijo")) {
        tarefasProvedores.push(() =>
          executarComTimeout(scrapeGontijo(origem, origemUF, destino, destinoUF, dataIso, idJovem), TIMEOUT_PROVEDOR_MS).catch((err) => ({
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Erro Gontijo",
            siteUrl: "",
            provedor: "Gontijo",
            dataConsultada: dataIso,
            resultados: [],
            error: String(err),
          }))
        )
      }

      if (provedores.includes("Guanabara")) {
        tarefasProvedores.push(() =>
          executarComTimeout(scrapeGuanabara(origem, destino, dataIso, origemUF, destinoUF, idJovem), TIMEOUT_PROVEDOR_MS).catch((err) => ({
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Erro Guanabara",
            siteUrl: "",
            provedor: "Guanabara",
            dataConsultada: dataIso,
            resultados: [],
            error: String(err),
          }))
        )
      }

      if (provedores.includes("Buser") && !idJovem) {
        tarefasProvedores.push(() =>
          executarComTimeout(scrapeBuser(origem, origemUF, destino, destinoUF, dataIso, idJovem), TIMEOUT_PROVEDOR_MS).catch((err) => ({
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Erro Buser",
            siteUrl: "",
            provedor: "Buser",
            dataConsultada: dataIso,
            resultados: [],
            error: String(err),
          }))
        )
      }

      if (provedores.includes("Embarca")) {
        tarefasProvedores.push(() =>
          executarComTimeout(scrapeEmbarca(origem, origemUF, destino, destinoUF, dataIso, idJovem), TIMEOUT_PROVEDOR_MS).catch((err) => ({
            disponivel: false,
            vagasIdJovem: 0,
            detalhes: "Erro Embarca.ai",
            siteUrl: "",
            provedor: "Embarca.ai",
            dataConsultada: dataIso,
            resultados: [],
            error: String(err),
          }))
        )
      }

      const resultadosProvedores: ScraperResult[] = []
      for (const tarefa of tarefasProvedores) {
        resultadosProvedores.push(await tarefa())
      }
      const viagensDoDia: ResultItem[] = []

      for (const res of resultadosProvedores) {
        if (res.disponivel && res.resultados.length > 0) {
          for (const item of res.resultados) {
            viagensDoDia.push({
              ...item,
              data: dataIso,
              origem: `${origem} - ${origemUF}`,
              destino: `${destino} - ${destinoUF}`,
              linkCompra: item.linkCompra || res.siteUrl,
            })
          }
        }
      }

      for (const res of resultadosProvedores) {
        const status = res.error === "COVERAGE_NOT_IMPLEMENTED"
          ? "sem_cobertura"
          : res.error
            ? "erro"
          : res.resultados.length > 0
            ? "online"
            : "sem_oferta"
        const anterior = statusPorProvedor.get(res.provedor)
        if (!anterior || status === "online" || (status === "erro" && anterior.status !== "online")) {
          statusPorProvedor.set(res.provedor, {
            provedor: res.provedor,
            status,
            detalhes: res.detalhes,
          })
        }
      }

      return { dataIso, viagensDoDia }
    }
  )

  let menorPrecoPeriodo: number | undefined = undefined
  let melhorDataPeriodo: string | undefined = undefined
  let empresaCampeaoPeriodo: string | undefined = undefined

  for (const { dataIso, viagensDoDia } of resultadosPorData) {
    todasViagens.push(...viagensDoDia)

    let menorValorDia: number | undefined = undefined
    let empresaMenorValor: string | undefined = undefined
    let horarioMenorValor: string | undefined = undefined
    let temIdJovem100 = false
    let temIdJovem50 = false

    for (const v of viagensDoDia) {
      if (v.tipoGratuidade === "id_jovem_100" || (v.vagasIdJovem && v.vagasIdJovem > 0)) {
        temIdJovem100 = true
      }
      if (v.tipoGratuidade === "id_jovem_50") {
        temIdJovem50 = true
      }

      if (v.valorNumerico !== undefined) {
        if (menorValorDia === undefined || v.valorNumerico < menorValorDia) {
          menorValorDia = v.valorNumerico
          empresaMenorValor = v.empresa
          horarioMenorValor = v.horario
        }
      }
    }

    resumoPorDia.push({
      data: dataIso,
      menorValor: menorValorDia,
      temIdJovem100,
      temIdJovem50,
      totalViagens: viagensDoDia.length,
      empresaMenorValor,
      horarioMenorValor,
    })

    // Avalia o campeão geral do período
    if (menorValorDia !== undefined) {
      if (menorPrecoPeriodo === undefined || menorValorDia < menorPrecoPeriodo) {
        menorPrecoPeriodo = menorValorDia
        melhorDataPeriodo = dataIso
        empresaCampeaoPeriodo = empresaMenorValor
      }
    } else if (temIdJovem100 && menorPrecoPeriodo === undefined) {
      menorPrecoPeriodo = 0
      melhorDataPeriodo = dataIso
      empresaCampeaoPeriodo = empresaMenorValor
    }
  }

  // Ordenação de todas as viagens: data crescente, e dentro do mesmo dia, menor valor primeiro
  todasViagens.sort((a, b) => {
    if (a.data !== b.data && a.data && b.data) {
      return a.data.localeCompare(b.data)
    }
    const valA = a.valorNumerico ?? 999999
    const valB = b.valorNumerico ?? 999999
    return valA - valB
  })

  return {
    origem: `${origem} - ${origemUF}`,
    destino: `${destino} - ${destinoUF}`,
    dataInicio,
    dataFim,
    idJovemApenas: idJovem,
    melhorDataPeriodo,
    menorPrecoPeriodo,
    empresaCampeaoPeriodo,
    resumoPorDia,
    todasViagens,
    totalViagensEncontradas: todasViagens.length,
    statusProvedores: Array.from(statusPorProvedor.values()),
  }
}
