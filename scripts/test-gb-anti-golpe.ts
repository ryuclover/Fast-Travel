import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"

async function testAntiGolpe() {
  console.log("====================================================================")
  console.log("   TESTE DE VERIFICAÇÃO REAL DE ASSENTOS GUANABARA (ANTI-PEGADINHA)  ")
  console.log("====================================================================\n")

  // Vamos testar uma data próxima onde a cota 100% costuma estar esgotada
  const datas = ["2026-09-13", "2026-09-15", "2026-09-19"]

  for (const d of datas) {
    console.log(`\n📅 Verificando data: ${d}...`)
    const res = await fetchGuanabaraDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", d, true)

    console.log(`Total viagens retornadas na busca inicial: ${res.resultados.length}`)

    for (const p of res.resultados) {
      console.log(`- ${p.empresa} (${p.classe}) às ${p.horario}: exibido '${p.valor}' (${p.tipoGratuidade})`)
    }
  }
}

testAntiGolpe().catch(console.error)
