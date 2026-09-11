import { NextRequest, NextResponse } from "next/server"
import { compararPrecosIntervalo } from "@/lib/services/comparador-intervalo"
import { ProvedorId } from "@/lib/services/provedores"
import {
  obterIpDaRequisicao,
  validarRateLimit,
  validarDataBusca,
  validarCidadePermitida,
  montarChaveCidade,
  converterItemParaPassagem,
} from "@/lib/services/busca-helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const MAPA_PROVEDORES: Record<string, ProvedorId> = {
  clickbus: "ClickBus",
  aguiabranca: "AguiaBranca",
  embarca: "Embarca",
  buser: "Buser",
  gontijo: "Gontijo",
  guanabara: "Guanabara",
  mobifacil: "Mobifacil",
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const idNormalizado = id.toLowerCase().replace(/[^a-z]/g, "")
  const provedor = MAPA_PROVEDORES[idNormalizado]

  if (!provedor) {
    return NextResponse.json(
      { error: `Provedor '${id}' inválido. Provedores suportados: ${Object.keys(MAPA_PROVEDORES).join(", ")}` },
      { status: 400 }
    )
  }

  const ip = obterIpDaRequisicao(request)
  if (!ip) {
    return NextResponse.json(
      { error: "Não foi possível identificar o cliente para aplicar limite de uso." },
      { status: 400 }
    )
  }

  if (!validarRateLimit(ip)) {
    return NextResponse.json(
      { error: "Muitas consultas em pouco tempo. Aguarde alguns segundos." },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(request.url)
  const origem = searchParams.get("origem")?.trim()
  const origemUF = searchParams.get("origemUF")?.trim()
  const destino = searchParams.get("destino")?.trim()
  const destinoUF = searchParams.get("destinoUF")?.trim()
  const data = searchParams.get("data")?.trim()
  const dataInicio = searchParams.get("dataInicio")?.trim()
  const dataFim = searchParams.get("dataFim")?.trim()

  const inicioEfetivo = dataInicio || data
  const fimEfetivo = dataFim || inicioEfetivo

  if (!origem || !origemUF || !destino || !destinoUF || !inicioEfetivo || !fimEfetivo) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios ausentes: origem, origemUF, destino, destinoUF e data (ou dataInicio)." },
      { status: 400 }
    )
  }

  if (!validarDataBusca(inicioEfetivo) || !validarDataBusca(fimEfetivo)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD." },
      { status: 400 }
    )
  }

  if (!validarCidadePermitida(origem, origemUF) || !validarCidadePermitida(destino, destinoUF)) {
    return NextResponse.json(
      { error: "Origem e destino devem ser selecionados na lista de cidades permitidas." },
      { status: 400 }
    )
  }

  if (montarChaveCidade(origem, origemUF) === montarChaveCidade(destino, destinoUF)) {
    return NextResponse.json({ error: "Origem e destino devem ser diferentes." }, { status: 400 })
  }

  const idJovem = searchParams.get("idJovem") === "true"
  const apenas100 = searchParams.get("apenas100") === "true"

  try {
    const resultadoIntervalo = await compararPrecosIntervalo({
      origem,
      origemUF,
      destino,
      destinoUF,
      dataInicio: inicioEfetivo,
      dataFim: fimEfetivo,
      idJovem,
      apenas100,
      provedores: [provedor],
      maxConcorrencia: 2,
      timeoutMs: 9000,
    })

    const passagensFormatadas = resultadoIntervalo.todasViagens.map((item) =>
      converterItemParaPassagem(item)
    )

    const passagensNaData = passagensFormatadas.filter((p) => p.data === inicioEfetivo)
    const passagensProximas = passagensFormatadas.filter((p) => p.data !== inicioEfetivo)

    const statusProvedor = resultadoIntervalo.statusProvedores.find(
      (s) => s.provedor === provedor || (provedor === "Embarca" && s.provedor === "Embarca.ai")
    ) || {
      provedor,
      status: passagensFormatadas.length > 0 ? "online" : "sem_oferta",
      detalhes: passagensFormatadas.length > 0
        ? `${passagensFormatadas.length} viagem(ns) encontrada(s)`
        : `Nenhuma viagem encontrada para este trecho.`,
    }

    return NextResponse.json({
      provedor,
      status: statusProvedor,
      passagensNaData,
      passagensProximas,
      totalEncontrado: passagensFormatadas.length,
      resumoPorDia: resultadoIntervalo.resumoPorDia,
      melhorDataPeriodo: resultadoIntervalo.melhorDataPeriodo,
      menorPrecoPeriodo: resultadoIntervalo.menorPrecoPeriodo,
      empresaCampeaoPeriodo: resultadoIntervalo.empresaCampeaoPeriodo,
    })
  } catch (error: any) {
    console.error(`[Provedor ${provedor}] Erro na consulta isolada:`, error)
    return NextResponse.json(
      {
        provedor,
        status: {
          provedor,
          status: "erro",
          detalhes: `Falha na consulta de ${provedor}: ${error?.message || "Erro interno"}`,
        },
        passagensNaData: [],
        passagensProximas: [],
        totalEncontrado: 0,
        resumoPorDia: [],
      },
      { status: 200 }
    )
  }
}
