import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"

interface Opcao100 {
  data: string
  diaSemana: string
  empresa: string
  classe: string
  horario: string
  chegada: string
  duracao: string
  taxaEmbarque: string
  linkCompra: string
  vagas: number
  aviso?: string
}

async function find100RioSp() {
  console.log("================================================================================")
  console.log("   BUSCA COMPLETA DE PASSAGENS 100% ID JOVEM: RIO DE JANEIRO ➔ SÃO PAULO       ")
  console.log("   Período: 11/09/2026 até 30/09/2026                                         ")
  console.log("================================================================================\n")

  const diasDoMes: string[] = []
  for (let dia = 11; dia <= 30; dia++) {
    diasDoMes.push(`2026-09-${dia.toString().padStart(2, "0")}`)
  }

  const diasSemanaNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  const encontradas: Opcao100[] = []

  for (const data of diasDoMes) {
    const dObj = new Date(`${data}T12:00:00Z`)
    const diaSemana = diasSemanaNomes[dObj.getUTCDay()]
    const dataBr = data.split("-").reverse().join("/")

    process.stdout.write(`🔎 Consultando ${dataBr} (${diaSemana})... `)

    try {
      const res = await fetchGuanabaraDirect("Rio de Janeiro", "RJ", "Sao Paulo", "SP", data, true)

      if (!res.disponivel || res.resultados.length === 0) {
        console.log("Sem viagens.")
        continue
      }

      // Filtrar apenas as passagens 100% genuínas (que passaram pela validação do mapa de assentos)
      const passagens100 = res.resultados.filter(
        (p) =>
          p.tipoGratuidade === "id_jovem_100" ||
          p.valor === "R$ 0,00" ||
          p.valorNumerico === 0
      )

      if (passagens100.length > 0) {
        console.log(`🎉 ENCONTRADA(S) ${passagens100.length} OPÇÃO(ÕES) 100% GRÁTIS!`)
        for (const p of passagens100) {
          console.log(`   ➔ ${p.empresa} (${p.classe}) às ${p.horario} | Taxa: ${p.valor} | Vagas: ${p.vagasIdJovem || 2}`)
          encontradas.push({
            data: dataBr,
            diaSemana,
            empresa: p.empresa,
            classe: p.classe || "Convencional",
            horario: p.horario || "N/A",
            chegada: p.chegada || "N/A",
            duracao: p.duracao || "N/A",
            taxaEmbarque: p.valor || "R$ 0,00",
            linkCompra: p.linkCompra || res.siteUrl,
            vagas: p.vagasIdJovem || 2,
            aviso: p.avisoAssento,
          })
        }
      } else {
        const passagens50 = res.resultados.filter((p) => p.tipoGratuidade === "id_jovem_50")
        console.log(`Apenas 50% de desconto (${passagens50.length} viagens a partir de ${passagens50[0]?.valor || "R$ 50+"})`)
      }
    } catch (err: any) {
      console.log(`Erro na data: ${err.message}`)
    }

    // Pequeno intervalo para respeitar o rate-limit da viação
    await new Promise((r) => setTimeout(r, 400))
  }

  console.log("\n================================================================================")
  console.log(`                RESUMO FINAL: ${encontradas.length} PASSAGENS 100% ENCONTRADAS                  `)
  console.log("================================================================================")

  if (encontradas.length > 0) {
    console.table(
      encontradas.map((e) => ({
        Data: `${e.data} (${e.diaSemana})`,
        Saída: e.horario,
        Chegada: e.chegada,
        Empresa: e.empresa,
        Classe: e.classe,
        Taxa: e.taxaEmbarque,
        Vagas: e.vagas,
        Checkout: e.linkCompra,
      }))
    )
  } else {
    console.log("Nenhuma passagem 100% gratuita foi encontrada para o restante do mês.")
  }
}

find100RioSp().catch(console.error)
