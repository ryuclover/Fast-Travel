import { compararPrecosIntervalo } from "../lib/services/comparador-intervalo"

async function main() {
  console.log("==================================================================")
  console.log("🚌 Fast-Travel: Teste de Comparação de Preços por Intervalo de Datas")
  console.log("==================================================================\n")

  const args = process.argv.slice(2)
  const idJovem = args.includes("--idjovem") || args.includes("-j")
  const origem = "Rio de Janeiro"
  const origemUF = "RJ"
  const destino = "Belo Horizonte"
  const destinoUF = "MG"
  const dataInicio = "2026-09-20"
  const dataFim = "2026-09-24"

  console.log(`Origem: ${origem} (${origemUF})`)
  console.log(`Destino: ${destino} (${destinoUF})`)
  console.log(`Período: ${dataInicio} até ${dataFim}`)
  console.log(`Modo: ${idJovem ? "Apenas ID Jovem" : "Geral (todas as passagens)"}\n`)

  const start = Date.now()
  const resultado = await compararPrecosIntervalo({
    origem,
    origemUF,
    destino,
    destinoUF,
    dataInicio,
    dataFim,
    idJovem,
    maxConcorrencia: 2,
  })
  const end = Date.now()

  console.log(`⏱️ Tempo total de busca: ${((end - start) / 1000).toFixed(2)}s\n`)
  console.log(`Total de viagens encontradas: ${resultado.totalViagensEncontradas}`)

  if (resultado.melhorDataPeriodo) {
    console.log(
      `🏆 MELHOR DATA PARA VIAJAR: ${resultado.melhorDataPeriodo} (Menor valor: R$ ${resultado.menorPrecoPeriodo?.toFixed(2) || "0,00"} - ${resultado.empresaCampeaoPeriodo || ""})`
    )
  }

  console.log("\n📅 RESUMO DIA A DIA:")
  console.table(
    resultado.resumoPorDia.map((d) => ({
      Data: d.data,
      "Menor Preço": d.menorValor !== undefined ? `R$ ${d.menorValor.toFixed(2)}` : "N/D",
      "Empresa Mais Barata": d.empresaMenorValor || "-",
      "Vagas ID Jovem 100%": d.temIdJovem100 ? "SIM" : "NÃO",
      "Total Opções": d.totalViagens,
    }))
  )

  if (resultado.todasViagens.length > 0) {
    console.log("\n🎫 PRIMEIRAS OPÇÕES ENCONTRADAS:")
    for (const v of resultado.todasViagens.slice(0, 5)) {
      console.log(
        `• [${v.data}] ${v.empresa} (${v.classe || "Conv."}) | Saída: ${v.horario} -> Chegada: ${v.chegada} | Valor: ${v.valor || "N/A"} | ID Jovem: ${v.tipoGratuidade === "id_jovem_100" ? "Sim (100%)" : "Não"}`
      )
    }
  }
}

main().catch(console.error)
