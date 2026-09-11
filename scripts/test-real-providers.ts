import { scrapeClickBus } from "../lib/scrapers/clickbus"
import { scrapeAguiaBranca } from "../lib/scrapers/aguiabranca"
import { scrapeEmbarca } from "../lib/scrapers/embarca"
import { scrapeMobifacil } from "../lib/scrapers/mobifacil"
import { scrapeGuanabara } from "../lib/scrapers/guanabara"

async function testReal() {
  console.log("================================================================================")
  console.log("   TESTANDO OS 4 PROVEDORES COM AS FUNÇÕES REAIS DO FAST-TRAVEL                 ")
  console.log("================================================================================\n")

  // 1. ÁGUIA BRANCA (Rota forte: Vitória -> Rio de Janeiro)
  console.log("▶ Testando ÁGUIA BRANCA (Vitoria -> Rio de Janeiro)...")
  try {
    const ab = await scrapeAguiaBranca("Vitoria", "ES", "Rio de Janeiro", "RJ", "2026-09-25", true)
    console.log("ÁGUIA BRANCA:", {
      disponivel: ab.disponivel,
      vagasIdJovem: ab.vagasIdJovem,
      total: ab.resultados?.length,
      detalhes: ab.detalhes,
      primeiroResultado: ab.resultados?.[0]
    })
  } catch (e: any) {
    console.log("Erro Águia Branca:", e)
  }

  // 2. EMBARCA (Rota forte: Curitiba -> Florianópolis)
  console.log("\n▶ Testando EMBARCA (Curitiba -> Florianopolis)...")
  try {
    const emb = await scrapeEmbarca("Curitiba", "PR", "Florianopolis", "SC", "2026-09-25", true)
    console.log("EMBARCA:", {
      disponivel: emb.disponivel,
      vagasIdJovem: emb.vagasIdJovem,
      total: emb.resultados?.length,
      detalhes: emb.detalhes,
      primeiroResultado: emb.resultados?.[0]
    })
  } catch (e: any) {
    console.log("Erro Embarca:", e)
  }

  // 3. MOBIFÁCIL (Rota: Sao Paulo -> Sorocaba ou Sao Paulo -> Curitiba)
  console.log("\n▶ Testando MOBIFÁCIL (Sao Paulo -> Curitiba)...")
  try {
    const mobi = await scrapeMobifacil("Sao Paulo", "SP", "Curitiba", "PR", "2026-09-25", true)
    console.log("MOBIFÁCIL:", {
      disponivel: mobi.disponivel,
      vagasIdJovem: mobi.vagasIdJovem,
      total: mobi.resultados?.length,
      detalhes: mobi.detalhes,
      primeiroResultado: mobi.resultados?.[0]
    })
  } catch (e: any) {
    console.log("Erro Mobifácil:", e)
  }

  // 4. CLICKBUS (Rota: Rio de Janeiro -> Sao Paulo)
  console.log("\n▶ Testando CLICKBUS (Rio de Janeiro -> Sao Paulo)...")
  try {
    const cb = await scrapeClickBus("Rio de Janeiro", "Sao Paulo", "2026-09-25", "RJ", "SP", true)
    console.log("CLICKBUS:", {
      disponivel: cb.disponivel,
      vagasIdJovem: cb.vagasIdJovem,
      total: cb.resultados?.length,
      detalhes: cb.detalhes,
      primeiroResultado: cb.resultados?.[0]
    })
  } catch (e: any) {
    console.log("Erro ClickBus:", e)
  }
}

testReal().catch(console.error)
