import { fetchAguiaBrancaDirect } from "../lib/scrapers/aguiabranca/client"

async function testABScraper() {
  console.log("Calling fetchAguiaBrancaDirect...")
  const res = await fetchAguiaBrancaDirect("Vitoria", "ES", "Rio de Janeiro", "RJ", "2026-09-25", true)
  console.log("Result:", {
    disponivel: res.disponivel,
    vagasIdJovem: res.vagasIdJovem,
    totalResultados: res.resultados?.length,
    detalhes: res.detalhes,
    error: res.error,
  })
  if (res.resultados?.length) {
    console.log("Primeiros resultados:", res.resultados.slice(0, 3))
  }
}

testABScraper().catch(console.error)
