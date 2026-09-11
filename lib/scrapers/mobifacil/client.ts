import { ResultItem, ScraperResult } from "../types"

// Cache em memória para resolução rápida de slugs de cidades
const slugCache = new Map<string, string>()

function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-")
  return `${dia}/${mes}/${ano}`
}

/**
 * Consulta a API de localidades da Mobifácil para encontrar o slug correspondente à cidade e UF.
 */
const STATIC_SLUGS_MOBIFACIL: Record<string, string> = {
  "sao-paulo_SP": "sao-paulo-sp",
  "rio-de-janeiro_RJ": "rio-de-janeiro-rj",
  "curitiba_PR": "curitiba-pr",
  "belo-horizonte_MG": "belo-horizonte-mg",
  "campinas_SP": "campinas-sp",
  "santos_SP": "santos-sp",
  "sorocaba_SP": "sorocaba-sp",
  "londrina_PR": "londrina-pr",
  "maringa_PR": "maringa-pr",
}

async function resolverSlugMobifacil(cidade: string, uf: string, signal?: AbortSignal): Promise<string | null> {
  const chaveCache = `${normalizarNome(cidade)}_${uf.toUpperCase()}`
  if (slugCache.has(chaveCache)) {
    return slugCache.get(chaveCache)!
  }
  if (STATIC_SLUGS_MOBIFACIL[chaveCache]) {
    return STATIC_SLUGS_MOBIFACIL[chaveCache]
  }

  const url = `https://www.mobifacil.com.br/on/demandware.store/Sites-Mobifacil-Site/pt_BR/Ticket-GetOrigins?search=${encodeURIComponent(
    normalizarNome(cidade)
  )}`

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      signal,
    })

    if (!resp.ok) return null

    const data = await resp.json()
    const origins = Array.isArray(data?.origins) ? data.origins : []

    const match =
      origins.find((o: any) => o.uf?.toUpperCase() === uf.toUpperCase()) ||
      origins.find((o: any) => normalizarNome(o.name || "").includes(normalizarNome(cidade))) ||
      origins[0]

    if (match?.slug) {
      slugCache.set(chaveCache, match.slug)
      return match.slug
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extrai o array JSON lsServicos do HTML renderizado pelo Demandware da Mobifácil.
 */
function extrairServicosHtml(html: string): any[] {
  const marker = '&quot;lsServicos&quot;:'
  const markerIdx = html.indexOf(marker)
  if (markerIdx === -1) {
    return []
  }

  const startIdx = markerIdx + marker.length
  let depth = 0
  let inString = false
  let endIdx = -1

  for (let i = startIdx; i < html.length; i++) {
    const c = html[i]
    if (c === '"' && html[i - 1] !== "\\") {
      inString = !inString
    }
    if (!inString) {
      if (c === "[") depth++
      else if (c === "]") {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }
  }

  if (endIdx === -1) return []

  try {
    const rawJson = html
      .substring(startIdx, endIdx)
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")

    const parsed = JSON.parse(rawJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function scrapeMobifacil(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  dataIso: string,
  idJovem = false
): Promise<ScraperResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8500)

  const dataBr = formatarDataBr(dataIso)
  const defaultSiteUrl = "https://www.mobifacil.com.br"

  try {
    // 1. Resolver slugs de origem e destino em paralelo
    const [origemSlug, destinoSlug] = await Promise.all([
      resolverSlugMobifacil(origem, origemUF, controller.signal),
      resolverSlugMobifacil(destino, destinoUF, controller.signal),
    ])

    if (!origemSlug || !destinoSlug) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: `Trecho ${origem} (${origemUF}) -> ${destino} (${destinoUF}) não localizado na malha Mobifácil.`,
        siteUrl: defaultSiteUrl,
        empresa: "Mobifácil",
        provedor: "Mobifacil",
        dataConsultada: dataIso,
        resultados: [],
        error: "COVERAGE_NOT_IMPLEMENTED",
      }
    }

    const searchUrl = `https://www.mobifacil.com.br/passagem-de-onibus/${origemSlug}/${destinoSlug}?date=${encodeURIComponent(
      dataBr
    )}`

    // 2. Fazer requisição à página da rota
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: controller.signal,
    })

    if (resp.status === 404) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: "Rota não operada pela Mobifácil ou parceiras do Grupo Comporte.",
        siteUrl: searchUrl,
        empresa: "Mobifácil",
        provedor: "Mobifacil",
        dataConsultada: dataIso,
        resultados: [],
        error: "COVERAGE_NOT_IMPLEMENTED",
      }
    }

    if (!resp.ok) {
      throw new Error(`HTTP_${resp.status}`)
    }

    const html = await resp.text()
    const servicos = extrairServicosHtml(html)

    if (servicos.length === 0) {
      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes: `Nenhum horário encontrado na Mobifácil para ${dataBr}.`,
        siteUrl: searchUrl,
        empresa: "Mobifácil",
        provedor: "Mobifacil",
        dataConsultada: dataIso,
        resultados: [],
      }
    }

    // 3. Tratamento estrito de ID Jovem (Zero falso positivo)
    if (idJovem) {
      // Identificar se existem viagens na classe Convencional na rota
      const viagensConvencionais = servicos.filter((s: any) =>
        s.classe?.toUpperCase()?.includes("CONVENCIONAL")
      )

      return {
        disponivel: false,
        vagasIdJovem: 0,
        detalhes:
          viagensConvencionais.length > 0
            ? `A Mobifácil possui ${viagensConvencionais.length} partida(s) convencional(is) nesta rota. Conforme a política oficial, gratuidades ID Jovem devem ser emitidas presencialmente em agências ou via chat oficial.`
            : "A Mobifácil não possui viagens convencionais com cota ID Jovem online direta para esta rota.",
        siteUrl: searchUrl,
        empresa: "Mobifácil",
        provedor: "Mobifacil",
        dataConsultada: dataIso,
        resultados: [],
      }
    }

    // 4. Modo Comercial / Geral: mapear todas as passagens disponíveis
    const resultados: ResultItem[] = servicos.map((s: any) => {
      const preco = typeof s.preco === "number" ? s.preco : parseFloat(s.preco) || undefined
      const horarioSaida = s.saida ? s.saida.split(" ")[1]?.substring(0, 5) : undefined
      const horarioChegada = s.chegada ? s.chegada.split(" ")[1]?.substring(0, 5) : undefined

      return {
        empresa: s.empresa || "Mobifácil (Grupo Comporte)",
        horario: horarioSaida,
        chegada: horarioChegada,
        duracao: s.duration,
        valor: preco !== undefined ? `R$ ${preco.toFixed(2).replace(".", ",")}` : undefined,
        valorNumerico: preco,
        classe: s.classe || "Convencional",
        tipoGratuidade: "nenhuma",
        vagasIdJovem: 0,
        poltronasLivres: typeof s.poltronasLivres === "number" ? s.poltronasLivres : undefined,
        origem: s.originName || `${origem} - ${origemUF}`,
        destino: s.destinationName || `${destino} - ${destinoUF}`,
        data: dataIso,
        linkCompra: searchUrl,
      }
    })

    return {
      disponivel: resultados.length > 0,
      vagasIdJovem: 0,
      detalhes: `Encontradas ${resultados.length} opções de viagens na Mobifácil.`,
      siteUrl: searchUrl,
      empresa: "Mobifácil",
      provedor: "Mobifacil",
      dataConsultada: dataIso,
      resultados,
    }
  } catch (error: any) {
    const isTimeout = error.name === "AbortError" || error.message?.includes("timeout")
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: isTimeout
        ? "Consulta à Mobifácil excedeu o tempo limite."
        : `Erro ao consultar Mobifácil: ${error.message || error}`,
      siteUrl: defaultSiteUrl,
      empresa: "Mobifácil",
      provedor: "Mobifacil",
      dataConsultada: dataIso,
      resultados: [],
      error: isTimeout ? "PROVIDER_TIMEOUT" : (error.message || "SCRAPE_ERROR"),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const consultarMobifacil = scrapeMobifacil
