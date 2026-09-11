import fs from "fs"
import path from "path"
import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"
import { fetchEmbarcaDirect } from "../lib/scrapers/embarca/client"

const OUT_FILE = path.join(process.cwd(), "scratch", "ticket_found.json")
const STATUS_FILE = path.join(process.cwd(), "scratch", "monitor_status.json")

// Garante que o diretório scratch exista
if (!fs.existsSync(path.join(process.cwd(), "scratch"))) {
  fs.mkdirSync(path.join(process.cwd(), "scratch"), { recursive: true })
}

async function runSingleScan(ciclo: number) {
  const diasDoMes: string[] = []
  for (let dia = 11; dia <= 30; dia++) {
    diasDoMes.push(`2026-09-${dia.toString().padStart(2, "0")}`)
  }

  console.log(`\n[${new Date().toLocaleTimeString("pt-BR")}] === INICIANDO CICLO DE MONITORAMENTO #${ciclo} ===`)
  console.log(`Varrendo ${diasDoMes.length} dias (11/09 a 30/09) para Rio ➔ São Paulo...`)

  const encontradas100: any[] = []

  for (const data of diasDoMes) {
    // 1. Consulta Guanabara / UTIL / Sampaio
    try {
      const resGb = await fetchGuanabaraDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", data, true)
      if (resGb.disponivel && resGb.resultados) {
        const p100 = resGb.resultados.filter((r) => r.tipoGratuidade === "id_jovem_100")
        if (p100.length > 0) {
          for (const item of p100) {
            console.log(`\n🚨🚨 [GUANABARA] 100% ENCONTRADA EM ${data}! ${item.empresa} (${item.classe}) às ${item.horario} - Taxa: ${item.valor}`)
            encontradas100.push({ ...item, provedor: "Guanabara", dataConsultada: data })
          }
        }
      }
    } catch {
      // Ignora erro momentâneo
    }

    // Intervalo de segurança anti-bloqueio
    await new Promise((r) => setTimeout(r, 600))

    // 2. Consulta Embarca
    try {
      const resEmbarca = await fetchEmbarcaDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", data, true)
      if (resEmbarca.disponivel && resEmbarca.resultados) {
        const p100 = resEmbarca.resultados.filter((r) => r.tipoGratuidade === "id_jovem_100")
        if (p100.length > 0) {
          for (const item of p100) {
            console.log(`\n🚨🚨 [EMBARCA] 100% ENCONTRADA EM ${data}! ${item.empresa} (${item.classe}) às ${item.horario} - Taxa: ${item.valor}`)
            encontradas100.push({ ...item, provedor: "Embarca", dataConsultada: data })
          }
        }
      }
    } catch {
      // Ignora erro momentâneo
    }

    await new Promise((r) => setTimeout(r, 600))
  }

  // Atualiza arquivo de status do monitor
  fs.writeFileSync(
    STATUS_FILE,
    JSON.stringify(
      {
        ultimoCiclo: ciclo,
        ultimaExecucao: new Date().toISOString(),
        total100Encontradas: encontradas100.length,
        status: "ativo",
      },
      null,
      2
    )
  )

  if (encontradas100.length > 0) {
    console.log(`\n🎯🎯 SUCESSO! Encontrada(s) ${encontradas100.length} passagem(ns) 100% ID Jovem! Gravando em ${OUT_FILE}`)
    fs.writeFileSync(OUT_FILE, JSON.stringify(encontradas100, null, 2))
    return true
  }

  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] Ciclo #${ciclo} finalizado: Nenhuma vaga 100% livre no momento (apenas 50% ou esgotadas).`)
  return false
}

async function startDaemon() {
  console.log("================================================================================")
  console.log("   MONITOR EM TEMPO REAL: VAGAS 100% ID JOVEM (RIO DE JANEIRO ➔ SÃO PAULO)     ")
  console.log("   Período monitorado: 11/09/2026 até 30/09/2026                              ")
  console.log("   Intervalo entre ciclos: 2 minutos (respeitando rate-limit)                 ")
  console.log("================================================================================\n")

  let ciclo = 1
  while (true) {
    const achou = await runSingleScan(ciclo)
    if (achou) {
      console.log("\n🛑 Passagem encontrada! O monitor registrou os dados com sucesso.")
      // Não encerra se quiser continuar monitorando ou encerra se achar uma
      break
    }
    ciclo++
    console.log(`Aguardando 2 minutos para a próxima rodada de varredura...`)
    await new Promise((r) => setTimeout(r, 120000))
  }
}

startDaemon().catch(console.error)
