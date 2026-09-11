import { fetchGuanabaraDirect } from "../lib/scrapers/guanabara/client"

interface TestRoute {
  origem: string
  origemUf: string
  destino: string
  destinoUf: string
  data: string
}

async function testEncaminhamentoDireto() {
  console.log("================================================================================")
  console.log("       TESTE INTENSIVO DO BOTÃO 'ENCAMINHAMENTO DIRETO' (ID JOVEM)             ")
  console.log("================================================================================\n")

  const rotas: TestRoute[] = [
    { origem: "Rio de Janeiro", origemUf: "RJ", destino: "Sao Paulo", destinoUf: "SP", data: "2026-09-19" },
    { origem: "Sao Paulo", origemUf: "SP", destino: "Rio de Janeiro", destinoUf: "RJ", data: "2026-09-19" },
    { origem: "Rio de Janeiro", origemUf: "RJ", destino: "Belo Horizonte", destinoUf: "MG", data: "2026-09-19" },
    { origem: "Belo Horizonte", origemUf: "MG", destino: "Rio de Janeiro", destinoUf: "RJ", data: "2026-09-19" },
    { origem: "Juiz de Fora", origemUf: "MG", destino: "Belo Horizonte", destinoUf: "MG", data: "2026-09-19" },
    { origem: "Fortaleza", origemUf: "CE", destino: "Sobral", destinoUf: "CE", data: "2026-09-19" },
  ]

  const resultadosFinais: any[] = []

  for (const rota of rotas) {
    console.log(`\n--------------------------------------------------------------------------------`)
    console.log(`🔎 Testando rota: ${rota.origem}/${rota.origemUf} ➔ ${rota.destino}/${rota.destinoUf} em ${rota.data}`)
    console.log(`--------------------------------------------------------------------------------`)

    const res = await fetchGuanabaraDirect(rota.origem, rota.origemUf, rota.destino, rota.destinoUf, rota.data, true)

    if (!res.disponivel || res.resultados.length === 0) {
      console.log(`⚠️ Nenhuma viagem encontrada para esta data/rota na viação.`)
      continue
    }

    console.log(`✅ Viagens encontradas: ${res.resultados.length}`)

    // 1. Aplicar a mesma lógica de seleção do botão "Encaminhamento Direto"
    const passagens100 = res.resultados.filter(
      (p) =>
        p.tipoGratuidade === "id_jovem_100" ||
        p.valor === "R$ 0,00" ||
        p.valorNumerico === 0 ||
        (p.vagasIdJovem != null && p.vagasIdJovem > 0)
    )

    const passagens50 = res.resultados.filter((p) => p.tipoGratuidade === "id_jovem_50")

    console.log(`   - Vagas 100% Grátis: ${passagens100.length}`)
    console.log(`   - Vagas 50% Desconto: ${passagens50.length}`)

    let melhorPassagem: any = null

    if (passagens100.length > 0) {
      // Prioridade 1: 100% gratuito, menor taxa de embarque
      melhorPassagem = passagens100.slice().sort((a, b) => (a.valorNumerico ?? 0) - (b.valorNumerico ?? 0))[0]
    } else if (passagens50.length > 0) {
      // Prioridade 2: 50% desconto, menor valor
      melhorPassagem = passagens50.slice().sort((a, b) => (a.valorNumerico ?? 9999) - (b.valorNumerico ?? 9999))[0]
    } else {
      melhorPassagem = res.resultados[0]
    }

    const checkoutUrl = melhorPassagem.linkCompra || melhorPassagem.siteUrl || res.siteUrl

    console.log(`\n🎯 MELHOR PASSAGEM SELECIONADA PARA O ENCAMINHAMENTO DIRETO:`)
    console.log(`   Empresa: ${melhorPassagem.empresa}`)
    console.log(`   Horário: ${melhorPassagem.horario}`)
    console.log(`   Valor: ${melhorPassagem.valor}`)
    console.log(`   Tipo de Benefício: ${melhorPassagem.tipoGratuidade === "id_jovem_100" ? "100% Grátis" : "50% Desconto"}`)
    console.log(`   URL do Botão: ${checkoutUrl}`)

    // 2. Validação dos Parâmetros da URL
    const hasIdJovem13 = checkoutUrl.includes("passengers=13:1")
    const hasPasseLivre12 = checkoutUrl.includes("passengers=12:1")

    if (hasPasseLivre12) {
      throw new Error(`[ERRO CRÍTICO] A URL gerada contém '12:1' (Passe Livre), quando deveria ser ID Jovem!`)
    }

    if (!hasIdJovem13) {
      throw new Error(`[ERRO CRÍTICO] A URL gerada NÃO contém 'passengers=13:1' (ID Jovem)!`)
    }

    // 3. Validação HTTP Real da URL de Checkout
    console.log(`   🌐 Testando carregamento real da URL de checkout (HTTP GET)...`)
    const startTime = Date.now()
    const httpResponse = await fetch(checkoutUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    const duration = Date.now() - startTime
    const statusCode = httpResponse.status
    const textHtml = await httpResponse.text()

    console.log(`   Status HTTP: ${statusCode} (em ${duration}ms)`)

    if (statusCode !== 200) {
      throw new Error(`[ERRO HTTP] O checkout retornou status ${statusCode}!`)
    }

    const isCheckoutPageValid = textHtml.length > 500 && !textHtml.toLowerCase().includes("erro 404")

    if (!isCheckoutPageValid) {
      throw new Error(`[ERRO CONTEÚDO] A página retornou conteúdo inválido ou página de erro!`)
    }

    console.log(`   ✅ Link de checkout carregado com 100% de sucesso!`)

    resultadosFinais.push({
      trecho: `${rota.origem} ➔ ${rota.destino}`,
      data: rota.data,
      horario: melhorPassagem.horario,
      empresa: melhorPassagem.empresa,
      beneficio: melhorPassagem.tipoGratuidade === "id_jovem_100" ? "100% Grátis" : "50% Desconto",
      valor: melhorPassagem.valor,
      parametroIdJovem: hasIdJovem13 ? "passengers=13:1 (OK)" : "FALHA",
      httpStatus: statusCode,
      tempoResposta: `${duration}ms`,
      checkoutUrl: checkoutUrl,
    })
  }

  console.log("\n================================================================================")
  console.log("                        RESUMO DOS TESTES INTENSIVOS                           ")
  console.log("================================================================================")
  console.table(resultadosFinais)

  console.log("\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!")
  console.log("O botão 'Encaminhamento Direto' abre diretamente o checkout oficial com os parâmetros do ID Jovem (13:1) devidamente injetados.")
}

testEncaminhamentoDireto().catch((err) => {
  console.error("\n❌ FALHA NO TESTE:", err)
  process.exit(1)
})
