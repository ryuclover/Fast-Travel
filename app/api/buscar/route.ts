import { NextRequest, NextResponse } from "next/server"
import type { Browser, Page } from "puppeteer"
import { cidadesSugeridas } from "@/lib/cidades-sugeridas"
import { scrapeClickBus, type ClickBusScrapeResult } from "@/lib/scrapers/clickbus"

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

function inferirQuantidadeVagas(textoPagina: string): number {
  const texto = normalizarTexto(textoPagina)
  const semVagaRegex = /(sem\s+vagas?|esgotad[oa]s?|indisponivel|nao\s+ha\s+vagas?)/
  if (semVagaRegex.test(texto)) return 0

  const encontrouIdJovem100 = /id\s*jovem[\s\S]{0,80}100%/.test(texto)
  if (!encontrouIdJovem100) return 0

  const matchQuantidade = texto.match(/(\d{1,2})\s*dispon(?:ivel|iveis)/)
  if (matchQuantidade) {
    const quantidade = Number.parseInt(matchQuantidade[1], 10)
    if (Number.isFinite(quantidade) && quantidade > 0) return Math.min(quantidade, 2)
  }

  return 0
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
    if (Number.isFinite(vagas) && vagas >= 0) return Math.min(vagas, 2)
  }

  const regexAlternativo = new RegExp(
    `(\\d{1,2})\\s*dispon(?:ivel|iveis)[\\s\\S]{0,220}?id\\s*jovem\\s*\\(\\s*${valorPercentual}\\s*%\\s*\\)`
  )
  const matchAlternativo = texto.match(regexAlternativo)
  if (matchAlternativo?.[1]) {
    const vagas = Number.parseInt(matchAlternativo[1], 10)
    if (Number.isFinite(vagas) && vagas >= 0) return Math.min(vagas, 2)
  }

  return 0
}

function extrairVagasIdJovem100DoTexto(textoPagina: string): number {
  return extrairVagasCategoriaIdJovem(textoPagina, "100%")
}

function extrairVagasIdJovemDoTexto(textoPagina: string): number {
  const vagas100 = extrairVagasCategoriaIdJovem(textoPagina, "100%")
  const vagas50 = extrairVagasCategoriaIdJovem(textoPagina, "50%")
  return vagas100 + vagas50
}

async function extrairVagasIdJovemDoBotaoCardClickBus(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const elementos = Array.from(document.querySelectorAll("button, [role='button'], div, span"))
      .filter((el) => {
        const texto = (el.textContent || "").toLowerCase()
        return texto.includes("id jovem") && texto.includes("100%")
      })

    for (const elemento of elementos) {
      const texto = (elemento.textContent || "").toLowerCase()
      const matchDisponiveis = texto.match(/(\d{1,2})\s*dispon(?:ivel|iveis)/)
      if (matchDisponiveis) {
        const vagas = Number.parseInt(matchDisponiveis[1], 10)
        if (Number.isFinite(vagas)) return Math.min(vagas, 2)
      }

      const matchCategoria = texto.match(/id\s*jovem\s*\(\s*100%\s*\)[^\d]*(\d{1,2})/)
      if (matchCategoria) {
        const vagas = Number.parseInt(matchCategoria[1], 10)
        if (Number.isFinite(vagas)) return Math.min(vagas, 2)
      }
    }

    return null
  })
}

function paginaExigeLogin(textoPagina: string): boolean {
  const texto = normalizarTexto(textoPagina)
  return /(faca\s+login|fa(c|ç)a\s+login|entrar\s+com|acessar\s+conta|minha\s+conta|cadastre-se|cadastre\s+se|login\s+obrigatorio)/.test(texto)
}

// Gera links de busca para cada site
function gerarLinksBusca(origem: string, destino: string, data: string, origemUF: string, destinoUF: string, idJovem: boolean) {
  const origemSlug = formatarSlug(origem)
  const destinoSlug = formatarSlug(destino)
  
  const clickbusUrl = new URL(
    `https://www.clickbus.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}-todos`
  )
  clickbusUrl.searchParams.set("departureDate", data)
  if (idJovem) {
    clickbusUrl.searchParams.set("gratuity", "true")
  }

  return {
    clickbus: clickbusUrl.toString(),
    embarca: `https://www.embarca.ai/passagem-de-onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}?departure_at=${data}&round_trip=`,
    gontijo: `https://www.gontijo.com.br`,
    jca: `https://vendas.jcaholding.com.br/busca`,
    guanabara: `https://viajeguanabara.com.br/onibus/${origemSlug.replace(/-/g, "_")}-${origemUF.toLowerCase()}-todos/${destinoSlug.replace(/-/g, "_")}-${destinoUF.toLowerCase()}?idPassengerType=1&departureDate=${formatarData(data, "brTraco")}&seats=1&passengers=13:1`,
    aguiaBranca: `https://www.aguiabranca.com.br/gratuidade`,
  }
}

function atualizarDepartureDateClickBusUrl(url: string, data: string): string {
  const clickbusUrl = new URL(url)
  clickbusUrl.searchParams.set("departureDate", data)
  return clickbusUrl.toString()
}

async function extrairTextoPaginaComFrames(page: Page): Promise<string> {
  const textos: string[] = []
  try {
    const mainText = await page.evaluate(() => document.body?.innerText || "")
    textos.push(mainText)
  } catch {
    textos.push("")
  }

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    try {
      const frameText = await frame.evaluate(() => document.body?.innerText || "")
      if (frameText) textos.push(frameText)
    } catch {
      // Ignorar frames cross-origin ou restritos
    }
  }

  return textos.join("\n").slice(0, 30000)
}

async function extrairTextoDaPagina(page: Page, url: string): Promise<string> {
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 7000,
  })

  return extrairTextoPaginaComFrames(page)
}

async function abrirPaginaClickBusEInteragirBotoes(page: Page, url: string): Promise<string> {
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 20000,
  })

  await esperar(1200)
  await page.waitForSelector("button[data-testid='select-result-item'], #open-seatmap-action-area", { timeout: 20000 }).catch(() => null)
  await clicarTodosBotoesRoxosClickBus(page)
  await esperar(1200)
  await clicarTodosBotoesRoxosClickBus(page)
  await esperar(600)

  return extrairTextoPaginaComFrames(page)
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function tentarScrapeClickBusComRetry(page: Page, url: string, tentativas = 3): Promise<ClickBusScrapeResult> {
  if (page.url() !== url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null)
  }

  let ultimoResultado: ClickBusScrapeResult | null = null

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resultado = await scrapeClickBus(page, url, true)
    ultimoResultado = resultado

    if (resultado.disponivel && resultado.resultados?.length > 0) {
      return resultado
    }

    if (tentativa < tentativas) {
      await esperar(800)
    }
  }

  return (
    ultimoResultado || {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Nenhuma tentativa produziu resultado válido",
      siteUrl: url,
      resultados: [],
    }
  )
}

async function extrairTextoAtualDaPagina(page: Page): Promise<string> {
  return extrairTextoPaginaComFrames(page)
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

async function clicarTodosBotoesRoxosClickBus(page: Page): Promise<number> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button[data-testid='select-result-item']"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null) as HTMLElement[]

    const areas = Array.from(document.querySelectorAll("#open-seatmap-action-area"))
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null) as HTMLElement[]

    const targets = buttons.length > 0 ? buttons : areas
    targets.forEach((elemento) => {
      if (elemento.tagName.toLowerCase() === "button") {
        elemento.click()
      } else {
        const botaoInterno = elemento.querySelector("button, a, [role='button']")
        if (botaoInterno instanceof HTMLElement) {
          botaoInterno.click()
        } else if (elemento instanceof HTMLElement) {
          elemento.click()
        }
      }
    })

    return targets.length
  })
}

async function aguardarModalBeneficiosClickBus(page: Page, timeoutMs = 20000): Promise<boolean> {
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
    return ""
  })

  if (textoModal.trim()) {
    return textoModal
  }

  return extrairTextoPaginaComFrames(page)
}

async function consultarClickBusIdJovem(page: Page, url: string): Promise<number> {
  const textoInicial = await abrirPaginaClickBusEInteragirBotoes(page, url)
  const vagasDireto = extrairVagasIdJovem100DoTexto(textoInicial)
  if (vagasDireto > 0) return vagasDireto

  const vagasBotaoCardDireto = await extrairVagasIdJovemDoBotaoCardClickBus(page)
  if (vagasBotaoCardDireto !== null) return vagasBotaoCardDireto

  const totalSelecionar = await contarBotoesPorTexto(page, "selecionar")
  const totalBotoesRoxos = await contarBotoesRoxosSetaClickBus(page)
  const maximoTentativas = Math.min(Math.max(totalSelecionar, totalBotoesRoxos), 2)

  for (let indicePassagem = 0; indicePassagem < maximoTentativas; indicePassagem++) {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20000,
    })

    const clicouSelecionar = await clicarBotaoPorTexto(page, "selecionar", indicePassagem)
    const clicouSetaRoxa = clicouSelecionar ? false : await clicarBotaoRoxoSetaClickBus(page, indicePassagem)
    if (!clicouSelecionar && !clicouSetaRoxa) continue

    await esperar(1200)

    const totalClicados = await clicarTodosBotoesRoxosClickBus(page)
    if (totalClicados > 0) {
      await esperar(1200)
    }

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

    const vagasBotaoCardAposInteracao = await extrairVagasIdJovemDoBotaoCardClickBus(page)
    const vagas = vagasBotaoCardAposInteracao !== null ? vagasBotaoCardAposInteracao : extrairVagasIdJovemDoTexto(textoAposInteracao)
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
  destinoUF: string,
  idJovem: boolean
): Promise<Passagem[] | null> {
  const page = await browser.newPage()
  const manterPaginaAberta = process.env.PUPPETEER_KEEP_OPEN !== "false"

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )

    const textoPagina = await extrairTextoDaPagina(page, fonte.siteUrl)
    if (paginaExigeLogin(textoPagina)) return null

    let vagasIdJovem = 0
    let empresaPassagem = fonte.empresa
    let disponivel = false

    let valorPassagem: string | undefined
    let horarioPartida = "N/A"
    let horarioChegada = "N/A"
    let duracaoPassagem = "Somente confirmacao de disponibilidade"

    if (fonte.site === "ClickBus") {
      const resultadoClickBus = await tentarScrapeClickBusComRetry(page, fonte.siteUrl, 3)
      let vagasIdJovem100 = 0

      if (idJovem) {
        vagasIdJovem100 = await consultarClickBusIdJovem(page, fonte.siteUrl)
        vagasIdJovem = vagasIdJovem100
      } else {
        vagasIdJovem = resultadoClickBus.vagasIdJovem
      }

      if (resultadoClickBus.empresa) {
        empresaPassagem = resultadoClickBus.empresa
      }

      disponivel = idJovem ? vagasIdJovem100 > 0 && resultadoClickBus.resultados.length > 0 : resultadoClickBus.disponivel

      if (!disponivel || resultadoClickBus.resultados.length === 0) {
        return null
      }

      return resultadoClickBus.resultados.map((item) => ({
        id: `${fonte.site}-${data}-${Math.random().toString(36).slice(2, 11)}`,
        empresa: item.empresa || empresaPassagem,
        site: fonte.site,
        siteUrl: fonte.siteUrl,
        origem: `${origem} - ${origemUF}`,
        destino: `${destino} - ${destinoUF}`,
        data,
        partida: item.horario || "N/A",
        chegada: item.chegada || "N/A",
        duracao: item.duracao || duracaoPassagem,
        valor: item.valor,
        vagasIdJovem,
        vagasIdJovem100,
        linkCompra: fonte.siteUrl,
      }))
    } else {
      vagasIdJovem = inferirQuantidadeVagas(textoPagina)
      disponivel = vagasIdJovem > 0
    }

    if (!disponivel) return null

    return [
      {
        id: `${fonte.site}-${data}-${Math.random().toString(36).slice(2, 11)}`,
        empresa: empresaPassagem,
        site: fonte.site,
        siteUrl: fonte.siteUrl,
        origem: `${origem} - ${origemUF}`,
        destino: `${destino} - ${destinoUF}`,
        data,
        partida: horarioPartida,
        chegada: horarioChegada,
        duracao: duracaoPassagem,
        valor: valorPassagem,
        vagasIdJovem,
        vagasIdJovem100: vagasIdJovem,
        linkCompra: fonte.siteUrl,
      },
    ]
  } catch {
    return null
  } finally {
    if (!manterPaginaAberta) {
      await page.close()
    }
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

async function buscarPassagens(
  origem: string,
  destino: string,
  dataInicio: string,
  dataFim: string,
  origemUF: string,
  destinoUF: string,
  idJovem: boolean
): Promise<Passagem[]> {
  const concorrenciaMaxima = 1
  const tempoMaximoExecucao = 60000

  const datasParaPesquisar = gerarDatasIntervalo(dataInicio, dataFim)

  const puppeteer = await import("puppeteer")
  const headless = process.env.PUPPETEER_HEADLESS === "true"
  const slowMo = process.env.PUPPETEER_SLOW_MO ? Number(process.env.PUPPETEER_SLOW_MO) : 0
  // Garantir que o navegador seja fechado após o uso
  const manterAberto = false

  let browser: Browser | null = null
  let browserFechado = false
  const fecharBrowser = async () => {
    if (browserFechado) return
    browserFechado = true
    if (browser) {
      await browser.close().catch(() => null)
      browser = null
    }
  }

  const criarBrowser = async (): Promise<Browser> => {
    const novoBrowser = await puppeteer.launch({
      headless,
      slowMo,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
    browser = novoBrowser
    browserFechado = false
    return novoBrowser
  }

  const buscarComBrowser = async (
    browserInstance: Browser,
    dataFormatada: string
  ): Promise<Passagem[]> => {
    const resultadosPorData: Passagem[] = []

    const links = gerarLinksBusca(origem, destino, dataFormatada, origemUF, destinoUF, idJovem)
    const clickbusUrl = atualizarDepartureDateClickBusUrl(links.clickbus, dataFormatada)
    const fontes: FonteBusca[] = [
      { site: "ClickBus", empresa: "ClickBus", siteUrl: clickbusUrl },
    ]

    const fontesSemLogin = fontes.filter((fonte) => !fonte.requerLogin)
    for (const fonte of fontesSemLogin) {
      const passagensFonte = await consultarFonteComPuppeteer(
        browserInstance,
        fonte,
        origem,
        destino,
        dataFormatada,
        origemUF,
        destinoUF,
        idJovem
      )
      if (passagensFonte) resultadosPorData.push(...passagensFonte)
    }

    return resultadosPorData.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data)
      return a.site.localeCompare(b.site)
    })
  }

  const maxBrowserRestarts = 3
  const timeoutFecharNavegador = setTimeout(() => {
    void fecharBrowser()
  }, tempoMaximoExecucao - 1000)

  try {
    const buscarData = async (dataFormatada: string): Promise<Passagem[]> => {
      let resultadosFinal: Passagem[] = []

      for (let ciclo = 1; ciclo <= maxBrowserRestarts; ciclo++) {
        const browserInstance = await criarBrowser()
        const resultados = await buscarComBrowser(browserInstance, dataFormatada)
        await fecharBrowser()

        if (resultados.length > 0) {
          resultadosFinal = resultados
          break
        }

        if (ciclo < maxBrowserRestarts) {
          await esperar(1000)
        }
      }

      return resultadosFinal
    }

    const resultadosPorData: Passagem[] = []

    for (const dataFormatada of datasParaPesquisar) {
      const resultados = await buscarData(dataFormatada)
      if (resultados.length > 0) {
        resultadosPorData.push(...resultados)
      }

      if (dataFormatada !== datasParaPesquisar[datasParaPesquisar.length - 1]) {
        await esperar(1000)
      }
    }

    return resultadosPorData.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data)
      return a.site.localeCompare(b.site)
    })
  } finally {
    clearTimeout(timeoutFecharNavegador)
    if (!manterAberto) {
      await fecharBrowser()
    }
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
    return NextResponse.json({ error: "Parâmetros obrigatórios: origem, destino, dataInicio e dataFim ou data" }, { status: 400 })
  }
  if (dataFim && !dataInicio) {
    return NextResponse.json({ error: "dataInicio precisa ser enviada quando dataFim for usada." }, { status: 400 })
  }
  if (dataInicio && !dataFim) {
    return NextResponse.json({ error: "dataFim precisa ser enviada quando dataInicio for usada." }, { status: 400 })
  }

  if (!validarDataBusca(data)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD e uma data entre hoje e 1 ano no futuro." },
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
  } catch {
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
  const fontesIgnoradas = ["Embarca.ai", "Guanabara", "JCA", "Gontijo", "Águia Branca"]
  
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
