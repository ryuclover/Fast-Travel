import { NextRequest, NextResponse } from "next/server"
import { cidadesSugeridas } from "@/lib/cidades-sugeridas"
import { scrapeClickBus } from "@/lib/scrapers/clickbus"
import { scrapeGuanabara } from "@/lib/scrapers/guanabara"
import { ScraperResult } from "@/lib/scrapers/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  vagasIdJovem: number
  vagasIdJovem100: number
  linkCompra: string
}

interface RegistroRateLimit {
  count: number
  resetAt: number
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const MAX_DATA_BUSCA_DIAS = 365
const MAX_USER_AGENT_LENGTH = 120
const MS_POR_DIA = 24 * 60 * 60 * 1000
const registrosRateLimit = new Map<string, RegistroRateLimit>()
let proximaLimpezaRateLimit = 0

// Função para formatar slug de cidade
function formatarSlug(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

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

// Gera links de busca para cada site
function gerarLinkClickbus(origem: string, destino: string, data: string, origemUF: string, destinoUF: string, idJovem: boolean) {
  const origemSlug = formatarSlug(origem)
  const destinoSlug = formatarSlug(destino)
  
  const clickbusUrl = new URL(
    `https://www.clickbus.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}-todos`
  )
  clickbusUrl.searchParams.set("departureDate", data)
  if (idJovem) {
    clickbusUrl.searchParams.set("gratuity", "true")
  }

  return clickbusUrl.toString()
}

function gerarLinkGuanabara(origem: string, destino: string, data: string, origemUF: string, destinoUF: string, idJovem: boolean) {
  const origemSlug = formatarSlug(origem)
  const destinoSlug = formatarSlug(destino)
  
  // Exemplo: https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-07-20&passengers=13:1
  const guanabaraUrl = new URL(
    `https://viajeguanabara.com.br/onibus/${origemSlug.replace(/-/g, "_")}-${origemUF.toLowerCase()}-todos/${destinoSlug.replace(/-/g, "_")}-${destinoUF.toLowerCase()}-todos/`
  )
  guanabaraUrl.searchParams.set("departure_date", data)
  if (idJovem) {
    guanabaraUrl.searchParams.set("passengers", "13:1")
  } else {
    guanabaraUrl.searchParams.set("passengers", "1")
  }

  return guanabaraUrl.toString()
}


function gerarDatasParaConsulta(data: string, diasAdicionais: number): string[] {
  const dataBase = new Date(`${data}T00:00:00`)
  const quantidadeDias = Math.max(0, diasAdicionais) + 1

  return Array.from({ length: quantidadeDias }, (_, indice) => {
    const dataConsulta = new Date(dataBase)
    dataConsulta.setDate(dataConsulta.getDate() + indice)
    return dataConsulta.toISOString().split("T")[0]
  })
}

function gerarDatasIntervalo(dataInicio: string, dataFim: string): string[] {
  const inicio = new Date(`${dataInicio}T00:00:00`)
  const fim = new Date(`${dataFim}T00:00:00`)
  const datas: string[] = []

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || inicio > fim) {
    return datas
  }

  const atual = new Date(inicio)
  while (atual <= fim) {
    datas.push(atual.toISOString().split("T")[0])
    atual.setDate(atual.getDate() + 1)
  }

  return datas
}


async function processarScraperResultParaPassagens(
  scraperResult: ScraperResult,
  origem: string,
  destino: string,
  data: string,
  origemUF: string,
  destinoUF: string,
  siteName: string,
): Promise<Passagem[]> {
    if (!scraperResult.disponivel || scraperResult.resultados.length === 0) {
        return [];
    }
    
    return scraperResult.resultados.map(item => ({
        id: `${siteName}-${data}-${Math.random().toString(36).slice(2, 11)}`,
        empresa: item.empresa || scraperResult.empresa || siteName,
        site: siteName,
        siteUrl: scraperResult.siteUrl,
        origem: `${origem} - ${origemUF}`,
        destino: `${destino} - ${destinoUF}`,
        data,
        partida: item.horario || "N/A",
        chegada: item.chegada || "N/A",
        duracao: item.duracao || "Somente confirmacao de disponibilidade",
        valor: item.valor,
        vagasIdJovem: scraperResult.vagasIdJovem,
        vagasIdJovem100: scraperResult.vagasIdJovem,
        linkCompra: scraperResult.siteUrl,
    }));
}


async function buscarPassagens(
  origem: string,
  destino: string,
  dataInicio: string,
  dataFim: string,
  origemUF: string,
  destinoUF: string,
  idJovem: boolean
): Promise<Passagem[]> {
  const datasParaPesquisar = gerarDatasIntervalo(dataInicio, dataFim)

  const fetchPassagensParaData = async (dataFormatada: string): Promise<Passagem[]> => {
      const clickbusUrl = gerarLinkClickbus(origem, destino, dataFormatada, origemUF, destinoUF, idJovem);
      const guanabaraUrl = gerarLinkGuanabara(origem, destino, dataFormatada, origemUF, destinoUF, idJovem);
      
      const [clickbusResult, guanabaraResult] = await Promise.all([
          scrapeClickBus(clickbusUrl),
          scrapeGuanabara(guanabaraUrl)
      ]);
      
      const clickbusPassagens = await processarScraperResultParaPassagens(clickbusResult, origem, destino, dataFormatada, origemUF, destinoUF, "ClickBus");
      const guanabaraPassagens = await processarScraperResultParaPassagens(guanabaraResult, origem, destino, dataFormatada, origemUF, destinoUF, "Guanabara");
      
      return [...clickbusPassagens, ...guanabaraPassagens];
  };

  // Run in parallel for all dates
  const promessas = datasParaPesquisar.map(data => fetchPassagensParaData(data));
  const resultadosPorDataNested = await Promise.all(promessas);
  
  const resultadosPorData = resultadosPorDataNested.flat();

  return resultadosPorData.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data)
    return a.site.localeCompare(b.site)
  })
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
    return NextResponse.json({ error: "Parâmetros obrigatórios: origem, destino, dataInicio e dataFim ou data" }, { status: 400 })
  }
  if (dataFim && !dataInicio) {
    return NextResponse.json({ error: "dataInicio precisa ser enviada quando dataFim for usada." }, { status: 400 })
  }
  if (dataInicio && !dataFim) {
    return NextResponse.json({ error: "dataFim precisa ser enviada quando dataInicio for usada." }, { status: 400 })
  }

  // Valida a data correta dependendo do modo de busca (intervalo ou data única)
  const dataParaValidar = dataInicio ?? data
  if (!dataParaValidar || !validarDataBusca(dataParaValidar)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD e uma data entre hoje e 1 ano no futuro." },
      { status: 400 }
    )
  }
  if (dataFim && !validarDataBusca(dataFim)) {
    return NextResponse.json(
      { error: "Data final inválida. Use o formato YYYY-MM-DD e uma data entre hoje e 1 ano no futuro." },
      { status: 400 }
    )
  }

  if (!validarCidadePermitida(origem, origemUF) || !validarCidadePermitida(destino, destinoUF)) {
    return NextResponse.json(
      { error: "Origem e destino devem ser selecionados na lista de sugestoes." },
      { status: 400 }
    )
  }

  if (montarChaveCidade(origem, origemUF) === montarChaveCidade(destino, destinoUF)) {
    return NextResponse.json(
      { error: "Origem e destino devem ser diferentes." },
      { status: 400 }
    )
  }
  
  const idJovem = searchParams.get("idJovem") === "true"
  const diasAdicionais = Number(searchParams.get("diasAdicionais") || "0")

  let passagens: Passagem[] = []
  let dataSolicitada = ""
  let datasConsultadasISO: string[] = []

  try {
    if (dataInicio && dataFim) {
      passagens = await buscarPassagens(origem, destino, dataInicio, dataFim, origemUF, destinoUF, idJovem)
      datasConsultadasISO = gerarDatasIntervalo(dataInicio, dataFim)
      dataSolicitada = dataInicio
    } else {
      const ultimoDia = gerarDatasParaConsulta(data!, diasAdicionais).slice(-1)[0]
      passagens = await buscarPassagens(origem, destino, data!, ultimoDia, origemUF, destinoUF, idJovem)
      datasConsultadasISO = gerarDatasParaConsulta(data!, diasAdicionais)
      dataSolicitada = data!
    }

    if (idJovem) {
      passagens = passagens.filter((passagem) => passagem.vagasIdJovem > 0)
    }
  } catch (error) {
    console.error("Erro na busca de passagens", error);
    return NextResponse.json(
      { error: "Nao foi possivel consultar os sites no momento. Tente novamente em alguns minutos." },
      { status: 502 }
    )
  }

  const [ano, mes, dia] = dataSolicitada.split("-")
  const dataFormatada = `${dia}/${mes}`
  const datasConsultadas = datasConsultadasISO.map((dataIso) => {
    const [consultaAno, consultaMes, consultaDia] = dataIso.split("-")
    return `${consultaDia}/${consultaMes}`
  })
  
  // Separa a data solicitada das datas seguintes com vaga
  const passagensNaData = passagens.filter((p) => p.data === dataSolicitada)
  const passagensProximas = passagens.filter((p) => p.data !== dataSolicitada)
  const dataTemIdJovem = passagensNaData.length > 0
  const fontesIgnoradas = ["Embarca.ai", "JCA", "Gontijo", "Águia Branca"]
  
  return NextResponse.json({
    buscadoEm: new Date().toISOString(),
    origem: `${origem} - ${origemUF}`,
    destino: `${destino} - ${destinoUF}`,
    dataSolicitada: dataFormatada,
    datasConsultadas,
    dataTemIdJovem,
    fontesIgnoradas,
    passagensNaData,
    passagensProximas,
    totalEncontrado: passagens.length,
  })
}
