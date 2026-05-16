import { NextRequest, NextResponse } from "next/server"
import type { Browser, Page } from "puppeteer"
import { cidadesSugeridas } from "@/lib/cidades-sugeridas"

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
  vagasIdJovem: number
  linkCompra: string
}

interface FonteBusca {
  site: string
  empresa: string
  siteUrl: string
  requerLogin?: boolean
}

interface RegistroRateLimit {
  count: number
  resetAt: number
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const registrosRateLimit = new Map<string, RegistroRateLimit>()

// Função para formatar slug de cidade
function formatarSlug(cidade: string): string {
  return cidade
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

// Função para formatar data em diferentes formatos
function formatarData(data: string, formato: "iso" | "br" | "brTraco") {
  const [ano, mes, dia] = data.split("-")
  if (formato === "iso") return data
  if (formato === "br") return `${dia}-${mes}-${ano}`
  if (formato === "brTraco") return `${dia}-${parseInt(mes)}-${ano}`
  return data
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

function obterIpDaRequisicao(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const primeiroIp = forwardedFor.split(",")[0]?.trim()
    if (primeiroIp) return primeiroIp
  }

  return request.headers.get("x-real-ip") || "unknown"
}

function validarRateLimit(ip: string): boolean {
  const agora = Date.now()

  for (const [chave, registro] of registrosRateLimit.entries()) {
    if (registro.resetAt <= agora) registrosRateLimit.delete(chave)
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

  const [ano, mes, dia] = data.split("-").map((parte) => Number.parseInt(parte, 10))
  if (
    dataSolicitada.getUTCFullYear() !== ano ||
    dataSolicitada.getUTCMonth() + 1 !== mes ||
    dataSolicitada.getUTCDate() !== dia
  ) {
    return false
  }

  const hoje = new Date()
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  const maxUtc = hojeUtc + 365 * 24 * 60 * 60 * 1000
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

function inferirQuantidadeVagas(textoPagina: string): number {
  const texto = normalizarTexto(textoPagina)
  const semVagaRegex = /(sem\s+vagas?|esgotad[oa]s?|indisponivel|nao\s+ha\s+vagas?)/
  if (semVagaRegex.test(texto)) return 0

  const matchQuantidade = texto.match(/(\d{1,2})\s+vagas?/)
  if (matchQuantidade) {
    const quantidade = Number.parseInt(matchQuantidade[1], 10)
    if (Number.isFinite(quantidade) && quantidade > 0) return Math.min(quantidade, 3)
  }

  const encontrouSinalPositivo = /(id\s*jovem|gratuidade|gratuity|vaga\s+gratuita|beneficio)/.test(texto)
  return encontrouSinalPositivo ? 1 : 0
}

function extrairVagasCategoriaIdJovem(textoPagina: string, percentual: "100%" | "50%"): number {
  const texto = normalizarTexto(textoPagina)

  const valorPercentual = percentual.replace("%", "")
  const regexPrincipal = new RegExp(
    `id\\s*jovem\\s*\\(\\s*${valorPercentual}\\s*%\\s*\\)[\\s\\S]{0,220}?(\\d{1,2})\\s*dispon(?:ivel|iveis)`
  )
  const matchPrincipal = texto.match(regexPrincipal)
  if (matchPrincipal?.[1]) {
    const vagas = Number.parseInt(matchPrincipal[1], 10)
    if (Number.isFinite(vagas) && vagas >= 0) return vagas
  }

  const regexAlternativo = new RegExp(
    `(\\d{1,2})\\s*dispon(?:ivel|iveis)[\\s\\S]{0,220}?id\\s*jovem\\s*\\(\\s*${valorPercentual}\\s*%\\s*\\)`
  )
  const matchAlternativo = texto.match(regexAlternativo)
  if (matchAlternativo?.[1]) {
    const vagas = Number.parseInt(matchAlternativo[1], 10)
    if (Number.isFinite(vagas) && vagas >= 0) return vagas
  }

  return 0
}

function extrairVagasIdJovemDoTexto(textoPagina: string): number {
  const vagas100 = extrairVagasCategoriaIdJovem(textoPagina, "100%")
  const vagas50 = extrairVagasCategoriaIdJovem(textoPagina, "50%")
  return vagas100 + vagas50
}

function paginaExigeLogin(textoPagina: string): boolean {
  const texto = normalizarTexto(textoPagina)
  return /(faca\s+login|fa(c|ç)a\s+login|entrar\s+com|acessar\s+conta|minha\s+conta|cadastre-se|cadastre\s+se|login\s+obrigatorio)/.test(texto)
}

// Gera links de busca para cada site
function gerarLinksBusca(origem: string, destino: string, data: string, origemUF: string, destinoUF: string) {
  const origemSlug = formatarSlug(origem)
  const destinoSlug = formatarSlug(destino)
  
  return {
    clickbus: `https://www.clickbus.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}?departureDate=${data}&gratuity=true`,
    embarca: `https://www.embarca.ai/passagem-de-onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}?departure_at=${data}&round_trip=`,
    gontijo: `https://www.gontijo.com.br`,
    jca: `https://vendas.jcaholding.com.br/busca`,
    guanabara: `https://viajeguanabara.com.br/onibus/${origemSlug.replace(/-/g, "_")}-${origemUF.toLowerCase()}-todos/${destinoSlug.replace(/-/g, "_")}-${destinoUF.toLowerCase()}?idPassengerType=1&departureDate=${formatarData(data, "brTraco")}&seats=1&passengers=13:1`,
    aguiaBranca: `https://www.aguiabranca.com.br/gratuidade`,
  }
}

async function extrairTextoDaPagina(page: Page, url: string): Promise<string> {
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  })

  const texto = await page.evaluate(() => {
    const titulo = document.title || ""
    const h1 = Array.from(document.querySelectorAll("h1")).map((el) => el.textContent || "")
    const h2 = Array.from(document.querySelectorAll("h2")).map((el) => el.textContent || "")
    const corpo = document.body?.innerText || ""
    return `${titulo}\n${h1.join("\n")}\n${h2.join("\n")}\n${corpo}`
  })

  return texto.slice(0, 30000)
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function extrairTextoAtualDaPagina(page: Page): Promise<string> {
  return page.evaluate(() => {
    const titulo = document.title || ""
    const corpo = document.body?.innerText || ""
    return `${titulo}\n${corpo}`
  })
}

async function clicarAssentosDisponiveisClickBus(page: Page, maxCliques = 2): Promise<number> {
  return page.evaluate((maximo) => {
    const seletorBase = "button, [role='button'], div"
    const elementos = Array.from(document.querySelectorAll(seletorBase))

    const assentos = elementos.filter((el) => {
      const texto = (el.textContent || "").toLowerCase()
      const classes = (el.className || "").toString().toLowerCase()
      const aria = (el.getAttribute("aria-label") || "").toLowerCase()
      const disabled = (el.getAttribute("aria-disabled") || "").toLowerCase()

      const pareceAssento =
        texto.includes("assento") ||
        texto.includes("poltrona") ||
        aria.includes("assento") ||
        aria.includes("poltrona") ||
        classes.includes("seat") ||
        classes.includes("poltrona") ||
        classes.includes("assento")

      const bloqueado =
        disabled === "true" ||
        classes.includes("disabled") ||
        classes.includes("ocupad") ||
        classes.includes("indispon") ||
        classes.includes("blocked") ||
        classes.includes("unavailable")

      const visivel = el instanceof HTMLElement && el.offsetParent !== null

      return pareceAssento && !bloqueado && visivel
    })

    let cliques = 0
    for (const assento of assentos) {
      if (!(assento instanceof HTMLElement)) continue
      assento.click()
      cliques += 1
      if (cliques >= maximo) break
    }

    return cliques
  }, maxCliques)
}

async function tentarInteracoesClickBus(page: Page): Promise<void> {
  const gatilhos = [
    "escolher poltrona",
    "ver poltronas",
    "beneficios",
    "beneficios",
    "passagens com beneficios",
    "id jovem",
    "continuar reserva",
  ]

  for (const gatilho of gatilhos) {
    await page.evaluate((textoBusca) => {
      const elementos = Array.from(document.querySelectorAll("button, a, [role='button']"))
      const alvo = elementos.find((el) => (el.textContent || "").toLowerCase().includes(textoBusca))
      if (alvo instanceof HTMLElement) alvo.click()
    }, gatilho)

    await new Promise((resolve) => setTimeout(resolve, 900))
  }
}

async function clicarBotaoPorTexto(page: Page, textoBusca: string, indice = 0): Promise<boolean> {
  return page.evaluate(
    ({ textoBuscaInterno, indiceInterno }) => {
      const elementos = Array.from(document.querySelectorAll("button, a, [role='button']"))
      const candidatos = elementos.filter((el) => (el.textContent || "").toLowerCase().includes(textoBuscaInterno))
      const alvo = candidatos[indiceInterno]
      if (alvo instanceof HTMLElement) {
        alvo.click()
        return true
      }
      return false
    },
    { textoBuscaInterno: textoBusca.toLowerCase(), indiceInterno: indice }
  )
}

async function contarBotoesPorTexto(page: Page, textoBusca: string): Promise<number> {
  return page.evaluate((textoBuscaInterno) => {
    const elementos = Array.from(document.querySelectorAll("button, a, [role='button']"))
    return elementos.filter((el) => (el.textContent || "").toLowerCase().includes(textoBuscaInterno)).length
  }, textoBusca.toLowerCase())
}

async function contarBotoesRoxosSetaClickBus(page: Page): Promise<number> {
  return page.evaluate(() => {
    const botoes = Array.from(document.querySelectorAll("button[data-testid='select-result-item']"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null)
    if (botoes.length > 0) return botoes.length

    const areas = Array.from(document.querySelectorAll("#open-seatmap-action-area"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null)
    return areas.length
  })
}

async function clicarBotaoRoxoSetaClickBus(page: Page, indice = 0): Promise<boolean> {
  return page.evaluate((indiceInterno) => {
    const botoesDiretos = Array.from(document.querySelectorAll("button[data-testid='select-result-item']"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null)

    const botaoDireto = botoesDiretos[indiceInterno]
    if (botaoDireto instanceof HTMLElement) {
      botaoDireto.click()
      return true
    }

    const areas = Array.from(document.querySelectorAll("#open-seatmap-action-area"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null)
    const area = areas[indiceInterno]
    if (area instanceof HTMLElement) {
      const botaoInterno = area.querySelector("button, a, [role='button']")
      if (botaoInterno instanceof HTMLElement) {
        botaoInterno.click()
        return true
      }

      area.click()
      return true
    }

    return false
  }, indice)
}

async function aguardarModalBeneficiosClickBus(page: Page, timeoutMs = 7000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const texto = (document.body?.innerText || "").toLowerCase()
        return texto.includes("passagens com beneficios") || texto.includes("passagens com benefícios")
      },
      { timeout: timeoutMs }
    )
    return true
  } catch {
    return false
  }
}

async function extrairTextoModalBeneficiosClickBus(page: Page): Promise<string> {
  const textoModal = await page.evaluate(() => {
    const candidatos = Array.from(
      document.querySelectorAll("[role='dialog'], .modal, .MuiDialog-root, .MuiModal-root, [data-testid*='modal']")
    )

    const alvo = candidatos.find((el) => {
      const texto = (el.textContent || "").toLowerCase()
      return texto.includes("passagens com beneficios") || texto.includes("passagens com benefícios")
    })

    if (alvo) return alvo.textContent || ""
    return document.body?.innerText || ""
  })

  return textoModal
}

async function consultarClickBusIdJovem(page: Page, url: string): Promise<number> {
  const textoInicial = await extrairTextoDaPagina(page, url)
  const vagasDireto = extrairVagasIdJovemDoTexto(textoInicial)
  if (vagasDireto > 0) return vagasDireto

  const totalSelecionar = await contarBotoesPorTexto(page, "selecionar")
  const totalBotoesRoxos = await contarBotoesRoxosSetaClickBus(page)
  const maximoTentativas = Math.min(Math.max(totalSelecionar, totalBotoesRoxos), 4)

  for (let indicePassagem = 0; indicePassagem < maximoTentativas; indicePassagem++) {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })

    const clicouSelecionar = await clicarBotaoPorTexto(page, "selecionar", indicePassagem)
    const clicouSetaRoxa = clicouSelecionar ? false : await clicarBotaoRoxoSetaClickBus(page, indicePassagem)
    if (!clicouSelecionar && !clicouSetaRoxa) continue

    await esperar(1200)

    const modalApareceu = await aguardarModalBeneficiosClickBus(page)
    let textoAposInteracao = ""

    if (modalApareceu) {
      textoAposInteracao = await extrairTextoModalBeneficiosClickBus(page)
    } else {
      const cliquesEmAssentos = await clicarAssentosDisponiveisClickBus(page, 2)
      if (cliquesEmAssentos > 0) await esperar(1200)

      await tentarInteracoesClickBus(page)
      await esperar(900)

      const modalApareceuAposFallback = await aguardarModalBeneficiosClickBus(page, 2500)
      textoAposInteracao = modalApareceuAposFallback
        ? await extrairTextoModalBeneficiosClickBus(page)
        : await extrairTextoAtualDaPagina(page)
    }

    const vagas = extrairVagasIdJovemDoTexto(textoAposInteracao)
    if (vagas > 0) return vagas
  }

  return 0
}

async function consultarFonteComPuppeteer(
  browser: Browser,
  fonte: FonteBusca,
  origem: string,
  destino: string,
  data: string,
  origemUF: string,
  destinoUF: string
): Promise<Passagem | null> {
  const page = await browser.newPage()

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )

    const textoPagina = await extrairTextoDaPagina(page, fonte.siteUrl)
    if (paginaExigeLogin(textoPagina)) return null

    let vagasIdJovem = 0
    if (fonte.site === "ClickBus") {
      vagasIdJovem = await consultarClickBusIdJovem(page, fonte.siteUrl)
    } else {
      vagasIdJovem = inferirQuantidadeVagas(textoPagina)
    }

    if (vagasIdJovem <= 0) return null

    return {
      id: `${fonte.site}-${data}-${Math.random().toString(36).slice(2, 11)}`,
      empresa: fonte.empresa,
      site: fonte.site,
      siteUrl: fonte.siteUrl,
      origem: `${origem} - ${origemUF}`,
      destino: `${destino} - ${destinoUF}`,
      data,
      partida: "N/A",
      chegada: "N/A",
      duracao: "Somente confirmacao de disponibilidade",
      vagasIdJovem,
      linkCompra: fonte.siteUrl,
    }
  } catch {
    return null
  } finally {
    await page.close()
  }
}

async function executarEmLotes<T, R>(
  itens: T[],
  tamanhoLote: number,
  tarefa: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = []

  for (let i = 0; i < itens.length; i += tamanhoLote) {
    const lote = itens.slice(i, i + tamanhoLote)
    const resultadoLote = await Promise.all(lote.map((item) => tarefa(item)))
    resultados.push(...resultadoLote)
  }

  return resultados
}

async function buscarPassagens(origem: string, destino: string, data: string, origemUF: string, destinoUF: string): Promise<Passagem[]> {
  const dataBase = new Date(`${data}T00:00:00`)
  const diasParaConsultar = 3
  const concorrenciaMaxima = 3

  const puppeteer = await import("puppeteer")
  const desabilitarSandbox = process.env.PUPPETEER_DISABLE_SANDBOX === "true"
  const argsChromium = desabilitarSandbox
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    : ["--disable-dev-shm-usage"]
  const browser = await puppeteer.launch({
    headless: true,
    args: argsChromium,
  })

  try {
    const datasParaConsultar: string[] = []
    for (let deslocamentoDias = 0; deslocamentoDias <= diasParaConsultar; deslocamentoDias++) {
      const dataConsulta = new Date(dataBase)
      dataConsulta.setDate(dataConsulta.getDate() + deslocamentoDias)
      datasParaConsultar.push(dataConsulta.toISOString().split("T")[0])
    }

    const resultadosPorData = await executarEmLotes(datasParaConsultar, concorrenciaMaxima, async (dataFormatada) => {
      const resultadosData: Passagem[] = []

      const links = gerarLinksBusca(origem, destino, dataFormatada, origemUF, destinoUF)
      const fontes: FonteBusca[] = [
        { site: "ClickBus", empresa: "ClickBus", siteUrl: links.clickbus },
      ]

      const fontesSemLogin = fontes.filter((fonte) => !fonte.requerLogin)

      for (const fonte of fontesSemLogin) {
        const passagem = await consultarFonteComPuppeteer(
          browser,
          fonte,
          origem,
          destino,
          dataFormatada,
          origemUF,
          destinoUF
        )
        if (passagem) resultadosData.push(passagem)
      }
      return resultadosData
    })

    const resultados = resultadosPorData.flat()

    return resultados.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data)
      return a.site.localeCompare(b.site)
    })
  } finally {
    await browser.close()
  }
}

export async function GET(request: NextRequest) {
  const ip = obterIpDaRequisicao(request)
  if (!validarRateLimit(ip)) {
    return NextResponse.json(
      { error: "Muitas consultas em pouco tempo. Aguarde e tente novamente." },
      { status: 429 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const origem = searchParams.get("origem")
  const destino = searchParams.get("destino")
  const data = searchParams.get("data")
  const origemUF = searchParams.get("origemUF") || "RJ"
  const destinoUF = searchParams.get("destinoUF") || "SP"
  
  if (!origem || !destino || !data) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: origem, destino, data" }, { status: 400 })
  }

  if (!validarDataBusca(data)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD e uma data entre hoje e 1 ano." },
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
  
  let passagens: Passagem[] = []

  try {
    passagens = await buscarPassagens(origem, destino, data, origemUF, destinoUF)
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel consultar os sites no momento. Tente novamente em alguns minutos." },
      { status: 502 }
    )
  }

  const dataFormatada = new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
  
  // Separa a data solicitada das datas seguintes com vaga
  const passagensNaData = passagens.filter(p => p.data === data)
  const passagensProximas = passagens.filter(p => p.data !== data)
  const dataTemIdJovem = passagensNaData.length > 0
  const fontesIgnoradas = ["Embarca.ai", "Guanabara", "JCA", "Gontijo", "Águia Branca"]
  
  return NextResponse.json({
    buscadoEm: new Date().toISOString(),
    origem: `${origem} - ${origemUF}`,
    destino: `${destino} - ${destinoUF}`,
    dataSolicitada: dataFormatada,
    dataTemIdJovem,
    fontesIgnoradas,
    passagensNaData,
    passagensProximas,
    totalEncontrado: passagens.length,
  })
}
