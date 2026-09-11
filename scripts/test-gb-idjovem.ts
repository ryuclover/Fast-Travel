import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"

async function run() {
  console.log("Iniciando teste de verificação da Guanabara com ID Jovem...")
  const res = await fetchGuanabaraDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", "2026-09-19", true)
  console.log("Disponivel:", res.disponivel)
  console.log("SiteUrl:", res.siteUrl)
  console.log("Total resultados:", res.resultados.length)

  const contains12 = res.siteUrl.includes("12:1") || res.resultados.some((r) => (r.linkCompra || "").includes("12:1"))
  console.log("Contém 12:1 (deve ser false):", contains12)

  const contains13 = res.siteUrl.includes("13:1") && res.resultados.every((r) => (r.linkCompra || "").includes("13:1"))
  console.log("Contém 13:1 em todos os links (deve ser true):", contains13)

  const gratuitos = res.resultados.filter((r) => r.tipoGratuidade === "id_jovem_100")
  const desconto50 = res.resultados.filter((r) => r.tipoGratuidade === "id_jovem_50")
  console.log("Gratuitos (100%):", gratuitos.length)
  console.log("Desconto 50%:", desconto50.length)

  if (gratuitos.length > 0) {
    console.log("Exemplo 100%:", {
      empresa: gratuitos[0].empresa,
      horario: gratuitos[0].horario,
      valor: gratuitos[0].valor,
      tipoGratuidade: gratuitos[0].tipoGratuidade,
      linkCompra: gratuitos[0].linkCompra,
    })
  }

  if (desconto50.length > 0) {
    console.log("Exemplo 50%:", {
      empresa: desconto50[0].empresa,
      horario: desconto50[0].horario,
      valor: desconto50[0].valor,
      tipoGratuidade: desconto50[0].tipoGratuidade,
      linkCompra: desconto50[0].linkCompra,
    })
  }

  if (contains12) {
    throw new Error("FALHA: Encontrado 12:1 (Passe Livre) nos resultados!")
  }
  if (!contains13) {
    throw new Error("FALHA: 13:1 não está presente em todos os links!")
  }
  console.log("\n✅ Teste de verificação da Guanabara passou com 100% de sucesso!")
}

run().catch((e) => {
  console.error("Erro no teste:", e)
  process.exit(1)
})
