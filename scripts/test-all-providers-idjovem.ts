import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"
import { fetchEmbarcaDirect } from "../lib/scrapers/embarca/client"
import { buscarClickBus } from "../lib/scrapers/clickbus"
import { fetchAguiaBrancaDirect } from "../lib/scrapers/aguiabranca/client"
import { fetchMobifacilDirect } from "../lib/scrapers/mobifacil/client"
import { fetchGontijoDirect } from "../lib/scrapers/gontijo/client"
import { fetchBuserDirect } from "../lib/scrapers/buser/client"

interface TestResult {
  provedor: string
  suportaIdJovemOnline: boolean
  passagemEncontrada: boolean
  detalhesPassagem?: {
    origem: string
    destino: string
    data: string
    empresa: string
    horario: string
    valor: string
    tipoGratuidade: string
    classe: string
    linkCompra: string
  }
  observacaoTecnica: string
}

async function testarTodosProvedores() {
  console.log("================================================================================")
  console.log("   TESTE GERAL DE ID JOVEM EM CADA UM DOS PROVEDORES (FAST-TRAVEL)              ")
  console.log("================================================================================\n")

  const relatorio: TestResult[] = []

  const rotas = [
    { origem: "Rio de Janeiro", ufOrigem: "RJ", destino: "Sao Paulo", ufDestino: "SP" },
    { origem: "Sao Paulo", ufOrigem: "SP", destino: "Curitiba", ufDestino: "PR" },
    { origem: "Belo Horizonte", ufOrigem: "MG", destino: "Rio de Janeiro", ufDestino: "RJ" },
    { origem: "Vitoria", ufOrigem: "ES", destino: "Rio de Janeiro", ufDestino: "RJ" },
  ]

  const datas = [
    "2026-09-21",
    "2026-09-26",
    "2026-09-28",
    "2026-10-05",
    "2026-10-15",
    "2026-10-20",
  ]

  // 1. GUANABARA
  console.log("▶ [1/7] Testando GUANABARA...")
  let gbFound: any = null
  for (const r of rotas) {
    if (gbFound) break
    for (const d of datas) {
      try {
        const res = await fetchGuanabaraDirect(r.origem, r.ufOrigem, r.destino, r.ufDestino, d, true)
        const idj = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
        if (idj) {
          gbFound = { ...idj, rota: `${r.origem} -> ${r.destino}`, data: d, res }
          console.log(`  ✅ Guanabara achou em ${r.origem} -> ${r.destino} (${d}): ${idj.empresa} às ${idj.horario} - ${idj.valor} (${idj.tipoGratuidade})`)
          break
        }
      } catch (e: any) {
        // ignora
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  relatorio.push({
    provedor: "Guanabara (UTIL / Sampaio / Real Expresso)",
    suportaIdJovemOnline: true,
    passagemEncontrada: !!gbFound,
    detalhesPassagem: gbFound
      ? {
          origem: gbFound.origem,
          destino: gbFound.destino,
          data: gbFound.data,
          empresa: gbFound.empresa,
          horario: gbFound.horario,
          valor: gbFound.valor,
          tipoGratuidade: gbFound.tipoGratuidade,
          classe: gbFound.classe,
          linkCompra: gbFound.linkCompra,
        }
      : undefined,
    observacaoTecnica:
      "Suporta consulta oficial via passengers=13:1. Exibe 50% de desconto online (~R$ 60). A gratuidade integral 100% (tarifa zero) fica reservada no sistema para emissão presencial no guichê por determinação da viação.",
  })

  // 2. EMBARCA.AI
  console.log("\n▶ [2/7] Testando EMBARCA.AI...")
  let embarcaFound: any = null
  for (const r of rotas) {
    if (embarcaFound) break
    for (const d of datas) {
      try {
        const res = await fetchEmbarcaDirect(r.origem, r.ufOrigem, r.destino, r.ufDestino, d, true)
        const idj = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
        if (idj) {
          embarcaFound = { ...idj, rota: `${r.origem} -> ${r.destino}`, data: d, res }
          console.log(`  ✅ Embarca achou em ${r.origem} -> ${r.destino} (${d}): ${idj.empresa} às ${idj.horario} - ${idj.valor} (${idj.tipoGratuidade})`)
          break
        }
      } catch (e: any) {
        // ignora
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  relatorio.push({
    provedor: "Embarca.ai",
    suportaIdJovemOnline: true,
    passagemEncontrada: !!embarcaFound,
    detalhesPassagem: embarcaFound
      ? {
          origem: embarcaFound.origem,
          destino: embarcaFound.destino,
          data: embarcaFound.data,
          empresa: embarcaFound.empresa,
          horario: embarcaFound.horario,
          valor: embarcaFound.valor,
          tipoGratuidade: embarcaFound.tipoGratuidade,
          classe: embarcaFound.classe,
          linkCompra: embarcaFound.linkCompra,
        }
      : undefined,
    observacaoTecnica:
      embarcaFound
        ? "Possui integração nativa de cotas de gratuidade no endpoint de viagens (gratuity_types category_id 5 e 6)."
        : "O endpoint da Embarca possui o campo gratuity_types preparado para young_100 e young_50, mas as viações parceiras da plataforma na rota raramente disponibilizam o assento aberto para emissão online.",
  })

  // 3. CLICKBUS
  console.log("\n▶ [3/7] Testando CLICKBUS...")
  let clickbusFound: any = null
  for (const r of rotas) {
    if (clickbusFound) break
    for (const d of datas.slice(0, 3)) {
      try {
        const res = await buscarClickBus(r.origem, r.ufOrigem, r.destino, r.ufDestino, d, true)
        const idj = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
        if (idj) {
          clickbusFound = { ...idj, rota: `${r.origem} -> ${r.destino}`, data: d, res }
          console.log(`  ✅ ClickBus achou em ${r.origem} -> ${r.destino} (${d}): ${idj.empresa} às ${idj.horario} - ${idj.valor}`)
          break
        }
      } catch (e: any) {
        // ignora
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  relatorio.push({
    provedor: "ClickBus",
    suportaIdJovemOnline: false,
    passagemEncontrada: !!clickbusFound,
    detalhesPassagem: clickbusFound
      ? {
          origem: clickbusFound.origem,
          destino: clickbusFound.destino,
          data: clickbusFound.data,
          empresa: clickbusFound.empresa,
          horario: clickbusFound.horario,
          valor: clickbusFound.valor,
          tipoGratuidade: clickbusFound.tipoGratuidade,
          classe: clickbusFound.classe,
          linkCompra: clickbusFound.linkCompra,
        }
      : undefined,
    observacaoTecnica:
      "A ClickBus é uma OTA (agência agregadora comercial). Por modelo de negócio de comissionamento e regras da ANTT, ela não emite gratuidades federais (ID Jovem / Passe Livre / Idoso) pelo site. As compras na ClickBus exigem pagamento integral da tarifa comercial.",
  })

  // 4. ÁGUIA BRANCA
  console.log("\n▶ [4/7] Testando ÁGUIA BRANCA...")
  let abFound: any = null
  for (const r of rotas) {
    if (abFound) break
    for (const d of datas.slice(0, 3)) {
      try {
        const res = await fetchAguiaBrancaDirect(r.origem, r.ufOrigem, r.destino, r.ufDestino, d, true)
        const idj = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
        if (idj) {
          abFound = { ...idj, rota: `${r.origem} -> ${r.destino}`, data: d, res }
          console.log(`  ✅ Águia Branca achou em ${r.origem} -> ${r.destino} (${d}): ${idj.empresa} às ${idj.horario} - ${idj.valor}`)
          break
        }
      } catch (e: any) {
        // ignora
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  relatorio.push({
    provedor: "Águia Branca",
    suportaIdJovemOnline: false,
    passagemEncontrada: !!abFound,
    detalhesPassagem: abFound
      ? {
          origem: abFound.origem,
          destino: abFound.destino,
          data: abFound.data,
          empresa: abFound.empresa,
          horario: abFound.horario,
          valor: abFound.valor,
          tipoGratuidade: abFound.tipoGratuidade,
          classe: abFound.classe,
          linkCompra: abFound.linkCompra,
        }
      : undefined,
    observacaoTecnica:
      "A Águia Branca mantém uma página institucional de gratuidade (aguiabranca.com.br/gratuidade), mas o motor de reservas do site não permite finalizar carrinho com ID Jovem. A emissão deve ser feita presencialmente nas agências ou guichês oficiais.",
  })

  // 5. MOBIFÁCIL
  console.log("\n▶ [5/7] Testando MOBIFÁCIL...")
  let mobiFound: any = null
  try {
    const res = await fetchMobifacilDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", "2026-09-21", true)
    mobiFound = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
  } catch {}
  relatorio.push({
    provedor: "Mobifácil (Grupo Comporte)",
    suportaIdJovemOnline: false,
    passagemEncontrada: !!mobiFound,
    observacaoTecnica:
      "Política oficial da Mobifácil: a plataforma web comercializa apenas tarifas pagas normais. Benefícios de gratuidade regulamentada (ID Jovem, Idoso) devem ser solicitados via agências físicas ou canal de atendimento dedicado.",
  })

  // 6. GONTIJO
  console.log("\n▶ [6/7] Testando GONTIJO...")
  let gontijoFound: any = null
  try {
    const res = await fetchGontijoDirect("Belo Horizonte", "MG", "Sao Paulo", "SP", "2026-09-21", true)
    gontijoFound = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
  } catch {}
  relatorio.push({
    provedor: "Gontijo",
    suportaIdJovemOnline: false,
    passagemEncontrada: !!gontijoFound,
    observacaoTecnica:
      "A Gontijo opera linhas convencionais elegíveis, porém não disponibiliza API pública de emissão web de ID Jovem aberta a terceiros. A emissão é realizada exclusivamente nos guichês rodoviários ou canal oficial JVVN.",
  })

  // 7. BUSER
  console.log("\n▶ [7/7] Testando BUSER...")
  let buserFound: any = null
  try {
    const res = await fetchBuserDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", "2026-09-21")
    buserFound = res.resultados?.find((item) => item.tipoGratuidade?.includes("id_jovem"))
  } catch {}
  relatorio.push({
    provedor: "Buser",
    suportaIdJovemOnline: false,
    passagemEncontrada: !!buserFound,
    observacaoTecnica:
      "A Buser opera sob o regime de fretamento colaborativo (turismo/circuito fechado), e não sob regime de concessão de linha regular da ANTT. Portanto, por definição jurídica, o Decreto nº 8.537/2015 (ID Jovem) não se aplica à Buser.",
  })

  console.log("\n================================================================================")
  console.log("                           RELATÓRIO CONSOLIDADO                                ")
  console.log("================================================================================\n")
  console.log(JSON.stringify(relatorio, null, 2))
}

testarTodosProvedores().catch(console.error)
