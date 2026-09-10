import { NextRequest, NextResponse } from "next/server"
import { cidadesSugeridas } from "@/lib/cidades-sugeridas"
import { compararPrecosIntervalo } from "@/lib/services/comparador-intervalo"
import { ResultItem } from "@/lib/scrapers/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Passagem {
  id: string
  empresa: string
  site: string
  siteUrl: string
  origem: string
  destino: string
  data: string
  partida: string
  chegada: string
  duracao: string
  valor?: string
  valorNumerico?: number
  classe?: string
  tipoGratuidade?: "id_jovem_100" | "id_jovem_50" | "nenhuma"
  modalidadeGratuidade?: "online" | "guiche"
  vagasIdJovem: number
  vagasIdJovem100: number
  linkCompra: string
}

interface RegistroRateLimit {
  count: number
  resetAt: number
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const MAX_DATA_BUSCA_DIAS = 365
const MAX_USER_AGENT_LENGTH = 120
const MS_POR_DIA = 24 * 60 * 60 * 1000
const registrosRateLimit = new Map<string, RegistroRateLimit>()
let proximaLimpezaRateLimit = 0

function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function montarChaveCidade(nome: string, uf: string): string {
  return `${normalizarTexto(nome)}::${uf.trim().toUpperCase()}`
}

function obterIpDaRequisicao(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const primeiroIp = forwardedFor.split(",")[0]?.trim()
    if (primeiroIp) return primeiroIp
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp

  if (process.env.NODE_ENV === "production") return null

  const userAgent = request.headers.get("user-agent")?.trim() || "sem-identificacao"
  return `dev:${userAgent.toLowerCase().slice(0, MAX_USER_AGENT_LENGTH)}`
}

function validarRateLimit(ip: string): boolean {
  const agora = Date.now()

  if (agora >= proximaLimpezaRateLimit) {
    for (const [chave, registro] of registrosRateLimit.entries()) {
      if (registro.resetAt <= agora) registrosRateLimit.delete(chave)
    }
    proximaLimpezaRateLimit = agora + RATE_LIMIT_WINDOW_MS
  }

  const atual = registrosRateLimit.get(ip)
  if (!atual || atual.resetAt <= agora) {
    registrosRateLimit.set(ip, { count: 1, resetAt: agora + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (atual.count >= RATE_LIMIT_MAX_REQUESTS) return false

  atual.count += 1
  registrosRateLimit.set(ip, atual)
  return true
}

function validarDataBusca(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false

  const dataSolicitada = new Date(`${data}T00:00:00.000Z`)
  if (Number.isNaN(dataSolicitada.getTime())) return false

  const [ano, mes, dia] = data.split("-").map((segmento) => Number.parseInt(segmento, 10))
  if (
    dataSolicitada.getUTCFullYear() !== ano ||
    dataSolicitada.getUTCMonth() + 1 !== mes ||
    dataSolicitada.getUTCDate() !== dia
  ) {
    return false
  }

  const hoje = new Date()
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  const maxUtc = hojeUtc + MAX_DATA_BUSCA_DIAS * MS_POR_DIA
  const dataUtc = Date.UTC(
    dataSolicitada.getUTCFullYear(),
    dataSolicitada.getUTCMonth(),
    dataSolicitada.getUTCDate()
  )

  return dataUtc >= hojeUtc && dataUtc <= maxUtc
}

const cidadesPermitidas = new Set(
  cidadesSugeridas.map((cidade) => montarChaveCidade(cidade.nome, cidade.uf))
)

function validarCidadePermitida(nome: string, uf: string): boolean {
  return cidadesPermitidas.has(montarChaveCidade(nome, uf))
}

function converterItemParaPassagem(item: ResultItem, siteFallback = "FastTravel"): Passagem {
  const site = item.empresa || siteFallback
  return {
    id: `${site}-${item.data}-${Math.random().toString(36).slice(2, 11)}`,
    empresa: item.empresa,
    site,
    siteUrl: item.linkCompra || "",
    origem: item.origem || "",
    destino: item.destino || "",
    data: item.data || "",
    partida: item.horario || "N/A",
    chegada: item.chegada || "N/A",
    duracao: item.duracao || "Consulte site",
    valor: item.valor,
    valorNumerico: item.valorNumerico,
    classe: item.classe,
    tipoGratuidade: item.tipoGratuidade,
    modalidadeGratuidade: (item.linkCompra?.includes("viajeguanabara") || item.linkCompra?.includes("embarca")) ? "online" : "guiche",
    vagasIdJovem: item.vagasIdJovem ?? 0,
    vagasIdJovem100: item.tipoGratuidade === "id_jovem_100" ? item.vagasIdJovem ?? 2 : 0,
    linkCompra: item.linkCompra || "",
  }
}

export async function GET(request: NextRequest) {
  const ip = obterIpDaRequisicao(request)
  if (!ip) {
    return NextResponse.json(
      { error: "Não foi possível identificar o cliente para aplicar limite de uso." },
      { status: 400 }
    )
  }

  if (!validarRateLimit(ip)) {
    return NextResponse.json(
      { error: "Muitas consultas em pouco tempo. Aguarde e tente novamente." },
      { status: 429 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const origem = searchParams.get("origem")
  const destino = searchParams.get("destino")
  const dataInicio = searchParams.get("dataInicio")
  const dataFim = searchParams.get("dataFim")
  const data = searchParams.get("data")
  const origemUF = searchParams.get("origemUF") || "RJ"
  const destinoUF = searchParams.get("destinoUF") || "SP"

  if (!origem || !destino || (!dataInicio && !data)) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: origem, destino, dataInicio e dataFim ou data" },
      { status: 400 }
    )
  }

  const inicioEfetivo = dataInicio || data!
  const fimEfetivo = dataFim || inicioEfetivo

  if (!validarDataBusca(inicioEfetivo) || !validarDataBusca(fimEfetivo)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD e uma data entre hoje e 1 ano no futuro." },
      { status: 400 }
    )
  }

  if (!validarCidadePermitida(origem, origemUF) || !validarCidadePermitida(destino, destinoUF)) {
    return NextResponse.json(
      { error: "Origem e destino devem ser selecionados na lista de sugestões." },
      { status: 400 }
    )
  }

  if (montarChaveCidade(origem, origemUF) === montarChaveCidade(destino, destinoUF)) {
    return NextResponse.json({ error: "Origem e destino devem ser diferentes." }, { status: 400 })
  }

  const idJovem = searchParams.get("idJovem") === "true"

  try {
    const resultadoIntervalo = await compararPrecosIntervalo({
      origem,
      origemUF,
      destino,
      destinoUF,
      dataInicio: inicioEfetivo,
      dataFim: fimEfetivo,
      idJovem,
      maxConcorrencia: 3,
    })

    const passagensFormatadas = resultadoIntervalo.todasViagens.map((item) =>
      converterItemParaPassagem(item)
    )

    const passagensNaData = passagensFormatadas.filter((p) => p.data === inicioEfetivo)
    const passagensProximas = passagensFormatadas.filter((p) => p.data !== inicioEfetivo)
    const dataTemIdJovem = passagensNaData.some((p) => p.vagasIdJovem > 0)

    const [ano, mes, dia] = inicioEfetivo.split("-")
    const dataFormatada = `${dia}/${mes}`
    const datasConsultadas = resultadoIntervalo.resumoPorDia.map((d) => {
      const [, m, dd] = d.data.split("-")
      return `${dd}/${m}`
    })

    return NextResponse.json({
      buscadoEm: new Date().toISOString(),
      origem: `${origem} - ${origemUF}`,
      destino: `${destino} - ${destinoUF}`,
      dataSolicitada: dataFormatada,
      datasConsultadas,
      dataTemIdJovem,
      fontesIgnoradas: ["Embarca.ai", "JCA", "Águia Branca"],
      passagensNaData,
      passagensProximas,
      totalEncontrado: passagensFormatadas.length,
      // Novos campos de inteligência de comparação
      melhorDataPeriodo: resultadoIntervalo.melhorDataPeriodo,
      menorPrecoPeriodo: resultadoIntervalo.menorPrecoPeriodo,
      empresaCampeaoPeriodo: resultadoIntervalo.empresaCampeaoPeriodo,
      resumoPorDia: resultadoIntervalo.resumoPorDia,
    })
  } catch (error) {
    console.error("Erro na busca de passagens:", error)
    return NextResponse.json(
      { error: "Não foi possível consultar as passagens no momento. Tente novamente." },
      { status: 502 }
    )
  }
}
