import { compararPrecosIntervalo } from "../lib/services/comparador-intervalo"
import { getClickBusSession } from "../lib/scrapers/clickbus"
import fs from "fs"
import path from "path"

async function executarTestesReais() {
  console.log("=======================================================================")
  console.log("🚀 FAST-TRAVEL: TESTE REAL DE 5 DIAS (RIO DE JANEIRO x SÃO PAULO)")
  console.log("=======================================================================\n")

  const origem = "Rio de Janeiro"
  const origemUF = "RJ"
  const destino = "Sao Paulo"
  const destinoUF = "SP"
  const dataInicio = "2026-09-15"
  const dataFim = "2026-09-19"

  console.log(`📍 Trecho: ${origem} (${origemUF}) ➔ ${destino} (${destinoUF})`)
  console.log(`📅 Intervalo de 5 dias: ${dataInicio} até ${dataFim}\n`)

  // -------------------------------------------------------------
  // TESTE 1: MODO GERAL (SEM ID JOVEM)
  // -------------------------------------------------------------
  console.log("--- [TESTE 1/2] Iniciando Busca Geral (Sem ID Jovem) ---")
  const t0Geral = Date.now()
  const resGeral = await compararPrecosIntervalo({
    origem,
    origemUF,
    destino,
    destinoUF,
    dataInicio,
    dataFim,
    idJovem: false,
    provedores: ["ClickBus", "Guanabara"],
    maxConcorrencia: 1, // Sequencial na sessão warm para máxima estabilidade
  })
  const t1Geral = Date.now()
  const tempoGeralSegundos = ((t1Geral - t0Geral) / 1000).toFixed(2)
  console.log(`✅ Busca Geral concluída em ${tempoGeralSegundos}s | Total de viagens: ${resGeral.totalViagensEncontradas}`)

  // -------------------------------------------------------------
  // TESTE 2: MODO COM ID JOVEM
  // -------------------------------------------------------------
  console.log("\n--- [TESTE 2/2] Iniciando Busca com ID Jovem ---")
  const t0IdJovem = Date.now()
  const resIdJovem = await compararPrecosIntervalo({
    origem,
    origemUF,
    destino,
    destinoUF,
    dataInicio,
    dataFim,
    idJovem: true,
    provedores: ["ClickBus", "Guanabara"],
    maxConcorrencia: 1,
  })
  const t1IdJovem = Date.now()
  const tempoIdJovemSegundos = ((t1IdJovem - t0IdJovem) / 1000).toFixed(2)
  console.log(`✅ Busca ID Jovem concluída em ${tempoIdJovemSegundos}s | Total de vagas elegíveis: ${resIdJovem.totalViagensEncontradas}`)

  // Fecha sessão do navegador
  const session = await getClickBusSession()
  await session.close()

  // Montagem do Relatório Final Estruturado
  const relatorio = {
    geradoEm: new Date().toISOString(),
    rota: `${origem} - ${origemUF} -> ${destino} - ${destinoUF}`,
    intervalo: `${dataInicio} a ${dataFim}`,
    tempoGeralSegundos: Number(tempoGeralSegundos),
    tempoIdJovemSegundos: Number(tempoIdJovemSegundos),
    modoGeral: {
      totalViagens: resGeral.totalViagensEncontradas,
      melhorData: resGeral.melhorDataPeriodo,
      menorPreco: resGeral.menorPrecoPeriodo,
      empresaMaisBarata: resGeral.empresaCampeaoPeriodo,
      dias: resGeral.resumoPorDia,
      exemplosMaisBaratos: resGeral.todasViagens.slice(0, 10).map(v => ({
        data: v.data,
        empresa: v.empresa,
        classe: v.classe,
        horario: `${v.horario} -> ${v.chegada}`,
        duracao: v.duracao,
        valor: v.valor,
        poltronasLivres: v.poltronasLivres
      }))
    },
    modoIdJovem: {
      totalViagensElegiveis: resIdJovem.totalViagensEncontradas,
      melhorData: resIdJovem.melhorDataPeriodo,
      dias: resIdJovem.resumoPorDia,
      exemplosIdJovem: resIdJovem.todasViagens.slice(0, 10).map(v => ({
        data: v.data,
        empresa: v.empresa,
        classe: v.classe,
        horario: `${v.horario} -> ${v.chegada}`,
        duracao: v.duracao,
        valor: v.valor,
        poltronasLivres: v.poltronasLivres,
        tipoGratuidade: v.tipoGratuidade
      }))
    }
  }

  const outputFilePath = path.resolve(process.cwd(), "scratch/relatorio-rio-sp.json")
  fs.writeFileSync(outputFilePath, JSON.stringify(relatorio, null, 2))
  console.log(`\n📄 Relatório JSON salvo com sucesso em: ${outputFilePath}`)

  return relatorio
}

executarTestesReais().catch(console.error)
