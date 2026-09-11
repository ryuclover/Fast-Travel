import { scrapeClickBus } from "../lib/scrapers/clickbus"
import { scrapeEmbarca } from "../lib/scrapers/embarca"
import { scrapeAguiaBranca } from "../lib/scrapers/aguiabranca"
import { scrapeMobifacil } from "../lib/scrapers/mobifacil"
import { scrapeGuanabara } from "../lib/scrapers/guanabara"

async function testAll() {
  const origem = "Rio de Janeiro"
  const origemUF = "RJ"
  const destino = "Sao Paulo"
  const destinoUF = "SP"
  const dataIso = "2026-09-25"

  console.log(`\n======================================================`)
  console.log(`TESTANDO ROTA: ${origem}/${origemUF} -> ${destino}/${destinoUF} em ${dataIso} (ID JOVEM: true)`)
  console.log(`======================================================\n`)

  // 1. ClickBus
  console.log("--- 1. ClickBus ---")
  try {
    const cb = await scrapeClickBus(origem, destino, dataIso, origemUF, destinoUF, true)
    console.log("ClickBus:", {
      disponivel: cb.disponivel,
      vagasIdJovem: cb.vagasIdJovem,
      totalResultados: cb.resultados?.length,
      detalhes: cb.detalhes,
      error: cb.error
    })
    if (cb.resultados?.length) {
      console.log("Amostra ClickBus:", cb.resultados.slice(0, 2))
    }
  } catch (e: any) {
    console.log("Erro ClickBus:", e.message)
  }

  // 2. Embarca
  console.log("\n--- 2. Embarca ---")
  try {
    const emb = await scrapeEmbarca(origem, origemUF, destino, destinoUF, dataIso, true)
    console.log("Embarca:", {
      disponivel: emb.disponivel,
      vagasIdJovem: emb.vagasIdJovem,
      totalResultados: emb.resultados?.length,
      detalhes: emb.detalhes,
      error: emb.error
    })
    if (emb.resultados?.length) {
      console.log("Amostra Embarca:", emb.resultados.slice(0, 2))
    }
  } catch (e: any) {
    console.log("Erro Embarca:", e.message)
  }

  // 3. Águia Branca
  console.log("\n--- 3. Águia Branca ---")
  try {
    const ab = await scrapeAguiaBranca(origem, origemUF, destino, destinoUF, dataIso, true)
    console.log("Águia Branca:", {
      disponivel: ab.disponivel,
      vagasIdJovem: ab.vagasIdJovem,
      totalResultados: ab.resultados?.length,
      detalhes: ab.detalhes,
      error: ab.error
    })
    if (ab.resultados?.length) {
      console.log("Amostra Águia Branca:", ab.resultados.slice(0, 2))
    }
  } catch (e: any) {
    console.log("Erro Águia Branca:", e.message)
  }

  // 4. Mobifácil
  console.log("\n--- 4. Mobifácil ---")
  try {
    const mobi = await scrapeMobifacil(origem, origemUF, destino, destinoUF, dataIso, true)
    console.log("Mobifácil:", {
      disponivel: mobi.disponivel,
      vagasIdJovem: mobi.vagasIdJovem,
      totalResultados: mobi.resultados?.length,
      detalhes: mobi.detalhes,
      error: mobi.error
    })
    if (mobi.resultados?.length) {
      console.log("Amostra Mobifácil:", mobi.resultados.slice(0, 2))
    }
  } catch (e: any) {
    console.log("Erro Mobifácil:", e.message)
  }

  // 5. Guanabara
  console.log("\n--- 5. Guanabara ---")
  try {
    const gb = await scrapeGuanabara(origem, destino, dataIso, origemUF, destinoUF, true)
    console.log("Guanabara:", {
      disponivel: gb.disponivel,
      vagasIdJovem: gb.vagasIdJovem,
      totalResultados: gb.resultados?.length,
      detalhes: gb.detalhes,
      error: gb.error
    })
    if (gb.resultados?.length) {
      console.log("Amostra Guanabara:", gb.resultados.slice(0, 2))
    }
  } catch (e: any) {
    console.log("Erro Guanabara:", e.message)
  }
}

testAll().catch(console.error)
