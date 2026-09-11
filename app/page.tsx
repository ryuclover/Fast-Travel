"use client"

import { useState, useRef } from "react"
import {
  CalendarRange,
  Bus,
  ShieldCheck,
  Sparkles,
  Zap,
  TrendingDown,
} from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchForm } from "@/components/search/search-form"
import { ResultsContainer } from "@/components/results/results-container"
import { ResultadoBusca, StatusProvedorBusca, ProvedorBusca } from "@/types/busca"
import {
  formatarDataParaExibicao,
  filtrarPassagensIdJovem,
  obterDataHojeLocal,
} from "@/lib/utils/formatters"

export default function Home() {
  const [origemSelecionada, setOrigemSelecionada] = useState("")
  const [destinoSelecionado, setDestinoSelecionado] = useState("")
  const [dataInicio, setDataInicio] = useState(() => obterDataHojeLocal())
  const [dataInicioDisplay, setDataInicioDisplay] = useState(() =>
    formatarDataParaExibicao(obterDataHojeLocal())
  )
  const [dataFim, setDataFim] = useState(() => obterDataHojeLocal())
  const [dataFimDisplay, setDataFimDisplay] = useState(() =>
    formatarDataParaExibicao(obterDataHojeLocal())
  )
  const [idJovem, setIdJovem] = useState(false)
  const [apenas100, setApenas100] = useState(false)
  const [provedoresSelecionados, setProvedoresSelecionados] = useState<ProvedorBusca[]>([
    "ClickBus",
    "AguiaBranca",
    "Embarca",
    "Guanabara",
    "Gontijo",
    "Mobifacil",
    "Buser",
  ])
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [erro, setErro] = useState("")
  const [progresso, setProgresso] = useState(0)
  const progressoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleBuscar = async () => {
    if (!origemSelecionada || !destinoSelecionado || !dataInicio || !dataFim) {
      setErro("Selecione origem, destino, data inicial e data final para buscar.")
      return
    }

    const dataInicioObj = new Date(`${dataInicio}T00:00:00`)
    const dataFimObj = new Date(`${dataFim}T00:00:00`)
    if (dataInicioObj > dataFimObj) {
      setErro("A data final deve ser igual ou posterior à data inicial.")
      return
    }

    if (origemSelecionada === destinoSelecionado) {
      setErro("Origem e destino devem ser diferentes.")
      return
    }

    const [origem, origemUF] = origemSelecionada.split("::")
    const [destino, destinoUF] = destinoSelecionado.split("::")

    setErro("")
    setCarregando(true)
    setProgresso(10)

    const [ano, mes, dia] = dataInicio.split("-")
    const dataFormatada = `${dia}/${mes}`

    // Gerar lista de datas consultadas
    const datas: string[] = []
    const cur = new Date(`${dataInicio}T00:00:00`)
    const end = new Date(`${dataFim}T00:00:00`)
    while (cur <= end) {
      const [, m, d] = cur.toISOString().split("T")[0].split("-")
      datas.push(`${d}/${m}`)
      cur.setDate(cur.getDate() + 1)
    }

    // Inicializa todos os provedores selecionados com o estado 'consultando'
    const statusIniciais: StatusProvedorBusca[] = provedoresSelecionados.map((p) => ({
      provedor: p,
      status: "consultando",
      detalhes: `Consultando ${p}...`,
    }))

    // Define o esqueleto inicial com as badges de provedores em andamento
    setResultado({
      buscadoEm: new Date().toISOString(),
      origem: `${origem} - ${origemUF}`,
      destino: `${destino} - ${destinoUF}`,
      dataSolicitada: dataFormatada,
      datasConsultadas: datas,
      passagensNaData: [],
      passagensProximas: [],
      totalEncontrado: 0,
      statusProvedores: statusIniciais,
      resumoPorDia: [],
    })

    // Variáveis de acumulação progressiva em tempo real
    let passagensNaDataAcumuladas: any[] = []
    let passagensProximasAcumuladas: any[] = []
    let statusAcumulados = [...statusIniciais]
    let resumosAcumulados: any[] = []
    let totalConcluidos = 0

    const promessasProvedores = provedoresSelecionados.map(async (provedor) => {
      const idSlug = provedor.toLowerCase()
      const params = new URLSearchParams({
        origem,
        origemUF,
        destino,
        destinoUF,
        dataInicio,
        dataFim,
        idJovem: idJovem ? "true" : "false",
        apenas100: apenas100 ? "true" : "false",
      })

      try {
        const response = await fetch(`/api/provedor/${idSlug}?${params}`)
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`)
        }
        const dados = await response.json()

        const novasNaData = idJovem
          ? filtrarPassagensIdJovem(dados.passagensNaData || [], apenas100)
          : dados.passagensNaData || []
        const novasProximas = idJovem
          ? filtrarPassagensIdJovem(dados.passagensProximas || [], apenas100)
          : dados.passagensProximas || []

        passagensNaDataAcumuladas = [...passagensNaDataAcumuladas, ...novasNaData]
        passagensProximasAcumuladas = [...passagensProximasAcumuladas, ...novasProximas]

        // Atualiza status do provedor individual
        statusAcumulados = statusAcumulados.map((s) =>
          s.provedor === provedor
            ? (dados.status || { provedor, status: "sem_oferta", detalhes: "" })
            : s
        )

        // Mescla resumos de menor preço por dia
        if (Array.isArray(dados.resumoPorDia)) {
          for (const r of dados.resumoPorDia) {
            const existente = resumosAcumulados.find((x) => x.data === r.data)
            if (!existente) {
              resumosAcumulados.push({ ...r })
            } else {
              existente.totalViagens += r.totalViagens
              if (r.temIdJovem100) existente.temIdJovem100 = true
              if (r.temIdJovem50) existente.temIdJovem50 = true
              if (
                r.menorValor != null &&
                (existente.menorValor == null || r.menorValor < existente.menorValor)
              ) {
                existente.menorValor = r.menorValor
                existente.empresaMenorValor = r.empresaMenorValor
                existente.horarioMenorValor = r.horarioMenorValor
              }
            }
          }
        }
      } catch (err: any) {
        statusAcumulados = statusAcumulados.map((s) =>
          s.provedor === provedor
            ? {
                provedor,
                status: "erro",
                detalhes: `Falha ao consultar ${provedor}: ${err?.message || err}`,
              }
            : s
        )
      } finally {
        totalConcluidos++
        const percentual = 10 + Math.round((totalConcluidos / provedoresSelecionados.length) * 90)
        setProgresso(percentual)

        // Recalcula menor preço e melhor data dinamicamente
        let menorPrecoPeriodo: number | undefined = undefined
        let melhorDataPeriodo: string | undefined = undefined
        let empresaCampeaoPeriodo: string | undefined = undefined

        const todas = [...passagensNaDataAcumuladas, ...passagensProximasAcumuladas]
        for (const p of todas) {
          const v = p.valorNumerico
          if (v != null && v > 0) {
            if (menorPrecoPeriodo == null || v < menorPrecoPeriodo) {
              menorPrecoPeriodo = v
              melhorDataPeriodo = p.data
              empresaCampeaoPeriodo = p.empresa
            }
          }
        }

        // Renderiza as novas passagens na tela imediatamente
        setResultado({
          buscadoEm: new Date().toISOString(),
          origem: `${origem} - ${origemUF}`,
          destino: `${destino} - ${destinoUF}`,
          dataSolicitada: dataFormatada,
          datasConsultadas: datas,
          passagensNaData: [...passagensNaDataAcumuladas],
          passagensProximas: [...passagensProximasAcumuladas],
          totalEncontrado:
            passagensNaDataAcumuladas.length + passagensProximasAcumuladas.length,
          statusProvedores: [...statusAcumulados],
          resumoPorDia: [...resumosAcumulados],
          menorPrecoPeriodo,
          melhorDataPeriodo,
          empresaCampeaoPeriodo,
        })
      }
    })

    try {
      await Promise.allSettled(promessasProvedores)
    } finally {
      setProgresso(100)
      setCarregando(false)
      setTimeout(() => setProgresso(0), 500)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20 selection:text-primary">
      <Header />

      <main className="flex-1 pb-16">
        {/* Seção Hero */}
        <section id="buscar" className="relative pt-10 pb-8 md:pt-16 md:pb-12 overflow-hidden">
          {/* Efeitos de iluminação de fundo */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[200px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="container mx-auto px-4 relative">
            <div className="max-w-3xl mx-auto text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-5 glow-subtle">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-bold tracking-wide uppercase">
                  Motor Inteligente de Ônibus
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight text-balance leading-tight">
                Viaje pagando menos ou com{" "}
                <span className="bg-gradient-to-r from-primary via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  ID Jovem Grátis
                </span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto text-pretty">
                Compare preços em tempo real no ClickBus, Buser, Guanabara, UTIL, Gontijo e Embarca.ai ao longo de até 30 dias e encontre passagens 100% gratuitas ou pelo menor valor.
              </p>
            </div>

            {/* Destaques de Funcionalidades */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-8 text-left">
              <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Intervalo de Datas</h4>
                  <p className="text-[11px] text-muted-foreground">Compare dias seguidos com 1 busca</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">ID Jovem 100%</h4>
                  <p className="text-[11px] text-muted-foreground">Vagas gratuitas da Lei nº 12.852</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Menor Preço</h4>
                  <p className="text-[11px] text-muted-foreground">Destaque imediato do dia campeão</p>
                </div>
              </div>
            </div>

            {/* Formulário de Busca */}
            <SearchForm
              origemSelecionada={origemSelecionada}
              setOrigemSelecionada={setOrigemSelecionada}
              destinoSelecionado={destinoSelecionado}
              setDestinoSelecionado={setDestinoSelecionado}
              dataInicio={dataInicio}
              setDataInicio={setDataInicio}
              dataInicioDisplay={dataInicioDisplay}
              setDataInicioDisplay={setDataInicioDisplay}
              dataFim={dataFim}
              setDataFim={setDataFim}
              dataFimDisplay={dataFimDisplay}
              setDataFimDisplay={setDataFimDisplay}
              idJovem={idJovem}
              setIdJovem={setIdJovem}
              apenas100={apenas100}
              setApenas100={setApenas100}
              provedoresSelecionados={provedoresSelecionados}
              setProvedoresSelecionados={setProvedoresSelecionados}
              carregando={carregando}
              progresso={progresso}
              erro={erro}
              onBuscar={handleBuscar}
            />

            {/* Resultados da Busca */}
            {resultado && (
              <ResultsContainer
                resultado={resultado}
                idJovem={idJovem}
                apenas100={apenas100}
                setApenas100={setApenas100}
              />
            )}
          </div>
        </section>

        {/* Seção Como Funciona */}
        <section id="como-funciona" className="py-16 mt-8 border-t border-border/60 bg-card/40">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Simples e Transparente
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                Como o FastTravel funciona
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Ajudamos você a economizar tempo e dinheiro consolidando passagens oficiais em um único lugar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-card/80 border border-border/70 text-center space-y-3 relative group hover:border-primary/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-xl flex items-center justify-center mx-auto border border-primary/20">
                  1
                </div>
                <h3 className="font-bold text-base text-foreground">Defina seu Período</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Informe as cidades e escolha uma data ou um intervalo de até 30 dias com nossos atalhos rápidos.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card/80 border border-border/70 text-center space-y-3 relative group hover:border-primary/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-xl flex items-center justify-center mx-auto border border-primary/20">
                  2
                </div>
                <h3 className="font-bold text-base text-foreground">Consulta Multi-Provedor</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consultamos simultaneamente ClickBus, Buser, Guanabara, UTIL, Gontijo e Embarca.ai, varrendo linhas normais e gratuidades ID Jovem (100% e 50%).
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card/80 border border-border/70 text-center space-y-3 relative group hover:border-primary/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-xl flex items-center justify-center mx-auto border border-primary/20">
                  3
                </div>
                <h3 className="font-bold text-base text-foreground">Reserve Direto na Fonte</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compare as menores tarifas na timeline, clique no link oficial e finalize a reserva com total segurança.
                </p>
              </div>
            </div>

            <div className="mt-10 p-5 rounded-2xl border border-primary/30 bg-primary/5 text-center max-w-3xl mx-auto">
              <p className="text-xs sm:text-sm text-foreground/90">
                <strong>Aviso Legal sobre o ID Jovem:</strong> O benefício de gratuidade de 100% (2 vagas) e 50% de desconto (2 vagas) em linhas interestaduais é regulamentado pela ANTT e pelo Decreto Federal nº 8.537/2015. Válido para jovens de 15 a 29 anos inscritos no CadÚnico.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
