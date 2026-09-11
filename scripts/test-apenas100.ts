import { compararPrecosIntervalo } from "../lib/services/comparador-intervalo"
import { filtrarPassagensIdJovem } from "../lib/utils/formatters"

async function run() {
  console.log("Testando busca com ID Jovem e apenas100 = true vs false...")

  const resTodos = await compararPrecosIntervalo({
    origem: "Rio de Janeiro",
    origemUF: "RJ",
    destino: "Sao Paulo",
    destinoUF: "SP",
    dataInicio: "2026-09-19",
    dataFim: "2026-09-19",
    idJovem: true,
    apenas100: false,
    provedores: ["Guanabara"],
  })

  console.log("Com apenas100=false:")
  console.log("Total viagens:", resTodos.todasViagens.length)
  console.log("Tipos encontrados:", resTodos.todasViagens.map((v) => v.tipoGratuidade))

  const resApenas100 = await compararPrecosIntervalo({
    origem: "Rio de Janeiro",
    origemUF: "RJ",
    destino: "Sao Paulo",
    destinoUF: "SP",
    dataInicio: "2026-09-19",
    dataFim: "2026-09-19",
    idJovem: true,
    apenas100: true,
    provedores: ["Guanabara"],
  })

  console.log("\nCom apenas100=true:")
  console.log("Total viagens:", resApenas100.todasViagens.length)
  console.log("Tipos encontrados:", resApenas100.todasViagens.map((v) => v.tipoGratuidade))

  const tem50 = resApenas100.todasViagens.some((v) => v.tipoGratuidade === "id_jovem_50")
  if (tem50) {
    throw new Error("FALHA: Encontrado tipoGratuidade 50% quando apenas100=true!")
  }

  // Testar também o helper filtrarPassagensIdJovem
  const filtradas100 = filtrarPassagensIdJovem(resTodos.todasViagens as any, true)
  console.log("\nfiltrarPassagensIdJovem com apenas100=true:", filtradas100.length)
  if (filtradas100.length !== resApenas100.todasViagens.length) {
    throw new Error("FALHA: Inconsistência entre filtrarPassagensIdJovem e comparadorIntervalo!")
  }

  console.log("\n✅ Teste de Apenas 100% passou com sucesso!")
}

run().catch((e) => {
  console.error("Erro:", e)
  process.exit(1)
})
