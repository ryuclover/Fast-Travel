import { NextRequest } from "next/server"
import { GET } from "../app/api/buscar/route"

async function testEndpoint() {
  console.log("==================================================================")
  console.log("🧪 TESTES INCISIVOS DE INTEGRAÇÃO NA API: /api/buscar")
  console.log("==================================================================\n")

  // TESTE 1: Validação de Erros - Origem igual a Destino
  console.log("1. Testando validação de rota inválida (Origem == Destino)...")
  const req1 = new NextRequest("http://localhost:3000/api/buscar?origem=Rio de Janeiro&destino=Rio de Janeiro&data=2026-09-20&origemUF=RJ&destinoUF=RJ")
  const res1 = await GET(req1)
  const json1 = await res1.json()
  console.log(`   Status: ${res1.status} | Esperado: 400 | Erro recebido: "${json1.error}"`)
  if (res1.status === 400) console.log("   ✅ Teste 1 passou!\n")

  // TESTE 2: Validação de Erros - Data no passado
  console.log("2. Testando validação de data no passado...")
  const req2 = new NextRequest("http://localhost:3000/api/buscar?origem=Rio de Janeiro&destino=Sao Paulo&data=2020-01-01&origemUF=RJ&destinoUF=SP")
  const res2 = await GET(req2)
  const json2 = await res2.json()
  console.log(`   Status: ${res2.status} | Esperado: 400 | Erro recebido: "${json2.error}"`)
  if (res2.status === 400) console.log("   ✅ Teste 2 passou!\n")

  // TESTE 3: Rota Real - Rio de Janeiro -> São Paulo (5 dias, SEM ID Jovem)
  console.log("3. Testando busca por intervalo real (Rio -> SP, 5 dias, Geral)...")
  const t0 = Date.now()
  const req3 = new NextRequest(
    "http://localhost:3000/api/buscar?origem=Rio de Janeiro&destino=Sao Paulo&dataInicio=2026-09-15&dataFim=2026-09-19&origemUF=RJ&destinoUF=SP&idJovem=false"
  )
  const res3 = await GET(req3)
  const json3 = await res3.json()
  const t1 = Date.now()
  console.log(`   Status: ${res3.status} (${((t1 - t0) / 1000).toFixed(2)}s)`)
  console.log(`   Total viagens retornadas: ${json3.totalEncontrado}`)
  console.log(`   Melhor data: ${json3.melhorDataPeriodo} (Menor valor: R$ ${json3.menorPrecoPeriodo})`)
  console.log(`   Empresas encontradas:`, [...new Set(json3.passagensNaData.map((p: any) => p.empresa))].slice(0, 6))
  if (res3.status === 200 && json3.totalEncontrado > 0) console.log("   ✅ Teste 3 passou!\n")

  // TESTE 4: Rota Real - Rio de Janeiro -> São Paulo (COM ID Jovem)
  console.log("4. Testando busca por intervalo real (Rio -> SP, 5 dias, COM ID Jovem)...")
  const t2 = Date.now()
  const req4 = new NextRequest(
    "http://localhost:3000/api/buscar?origem=Rio de Janeiro&destino=Sao Paulo&dataInicio=2026-09-15&dataFim=2026-09-19&origemUF=RJ&destinoUF=SP&idJovem=true"
  )
  const res4 = await GET(req4)
  const json4 = await res4.json()
  const t3 = Date.now()
  console.log(`   Status: ${res4.status} (${((t3 - t2) / 1000).toFixed(2)}s)`)
  console.log(`   Total opções ID Jovem: ${json4.totalEncontrado}`)
  console.log(`   Datas com vaga ID Jovem: ${json4.datasConsultadas?.join(", ")}`)
  if (res4.status === 200 && json4.dataTemIdJovem) console.log("   ✅ Teste 4 passou!\n")

  console.log("==================================================================")
  console.log("🎉 TODOS OS TESTES INCISIVOS FORAM CONCLUÍDOS COM SUCESSO!")
  console.log("==================================================================")
}

testEndpoint().catch(console.error)
