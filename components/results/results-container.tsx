"use client"

import { useState, useMemo } from "react"
import { ArrowRight, Info, RotateCcw, Bus } from "lucide-react"
import {
  Passagem,
  ResultadoBusca,
  TipoOrdenacao,
  TipoTurno,
  BlocoData,
} from "@/types/busca"
import {
  formatarDataBloco,
  obterDiaDaSemana,
  extrairTurno,
  parseValorPassagem,
  parseMinutosHorario,
  parseMinutosDuracao,
} from "@/lib/utils/formatters"
import { BestDealBanner } from "./best-deal-banner"
import { DateTimeline } from "./date-timeline"
import { FiltersBar } from "./filters-bar"
import { TripCard } from "./trip-card"
import { IdJovemGuideModal } from "./id-jovem-guide-modal"
import { CheckCircle2, CircleAlert, CircleOff, Radio, Loader2 } from "lucide-react"

interface ResultsContainerProps {
  resultado: ResultadoBusca
  idJovem: boolean
  apenas100?: boolean
  setApenas100?: (apenas100: boolean) => void
}

export function ResultsContainer({
  resultado,
  idJovem,
  apenas100 = false,
  setApenas100,
}: ResultsContainerProps) {
  const [dataFoco, setDataFoco] = useState<string | undefined>(undefined)
  const [ordenacao, setOrdenacao] = useState<TipoOrdenacao>("valor")
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("todas")
  const [turno, setTurno] = useState<TipoTurno>("todos")

  // Junta todas as passagens disponíveis
  const todasPassagens = useMemo(() => {
    return [...resultado.passagensNaData, ...resultado.passagensProximas]
  }, [resultado])

  // Lista de datas únicas presentes no resultado
  const datasDisponiveis = useMemo(() => {
    const setDatas = new Set<string>()
    for (const p of todasPassagens) {
      if (p.data) setDatas.add(p.data)
    }
    return Array.from(setDatas).sort()
  }, [todasPassagens])

  // Lista de empresas únicas encontradas
  const empresasDisponiveis = useMemo(() => {
    const setEmp = new Set<string>()
    for (const p of todasPassagens) {
      if (p.empresa) setEmp.add(p.empresa)
    }
    return Array.from(setEmp).sort()
  }, [todasPassagens])

  // Identifica a melhor passagem do período para o Encaminhamento Direto
  const melhorPassagem = useMemo(() => {
    if (!todasPassagens || todasPassagens.length === 0) return null

    // Se a busca for ID Jovem:
    if (idJovem) {
      // 1. Prioridade máxima: 100% gratuita
      const passagens100 = todasPassagens.filter(
        (p) =>
          p.tipoGratuidade === "id_jovem_100" ||
          p.valor === "R$ 0,00" ||
          p.valorNumerico === 0 ||
          (p.vagasIdJovem100 != null && p.vagasIdJovem100 > 0)
      )
      if (passagens100.length > 0) {
        return passagens100.slice().sort((a, b) => {
          // Prioriza classes convencionais/semi-leito (evita a pegadinha da Guanabara que reajusta Leito para tarifa cheia no mapa)
          const isLeitoA = /(?<!semi[\s\-_]*)leito|cama/i.test(a.classe || "")
          const isLeitoB = /(?<!semi[\s\-_]*)leito|cama/i.test(b.classe || "")
          if (isLeitoA !== isLeitoB) return isLeitoA ? 1 : -1

          const valA = a.valorNumerico ?? parseValorPassagem(a.valor) ?? 0
          const valB = b.valorNumerico ?? parseValorPassagem(b.valor) ?? 0
          if (valA !== valB) return valA - valB
          return a.data.localeCompare(b.data)
        })[0]
      }

      // 2. Segunda prioridade: 50% de desconto
      if (!apenas100) {
        const passagens50 = todasPassagens.filter((p) => p.tipoGratuidade === "id_jovem_50")
        if (passagens50.length > 0) {
          return passagens50.slice().sort((a, b) => {
            const valA = a.valorNumerico ?? parseValorPassagem(a.valor) ?? 999999
            const valB = b.valorNumerico ?? parseValorPassagem(b.valor) ?? 999999
            if (valA !== valB) return valA - valB
            return a.data.localeCompare(b.data)
          })[0]
        }
      }
    }

    // Caso geral ou fallback: menor valor disponível
    return todasPassagens.slice().sort((a, b) => {
      const valA = a.valorNumerico ?? parseValorPassagem(a.valor) ?? 999999
      const valB = b.valorNumerico ?? parseValorPassagem(b.valor) ?? 999999
      if (valA !== valB) return valA - valB
      return a.data.localeCompare(b.data)
    })[0]
  }, [todasPassagens, idJovem, apenas100])

  // Aplicação dos filtros dinâmicos
  const passagensFiltradas = useMemo(() => {
    let lista = todasPassagens

    // Filtro de Data
    if (dataFoco) {
      lista = lista.filter((p) => p.data === dataFoco)
    }

    // Filtro de Empresa
    if (empresaSelecionada !== "todas") {
      lista = lista.filter(
        (p) =>
          p.empresa.toLowerCase() === empresaSelecionada.toLowerCase() ||
          p.site.toLowerCase().includes(empresaSelecionada.toLowerCase())
      )
    }

    // Filtro de Turno
    if (turno !== "todos") {
      lista = lista.filter((p) => extrairTurno(p.partida) === turno)
    }

    // Filtro ID Jovem Apenas 100%
    if (idJovem && apenas100) {
      lista = lista.filter(
        (p) =>
          p.tipoGratuidade === "id_jovem_100" ||
          p.valor === "R$ 0,00" ||
          p.valorNumerico === 0 ||
          (p.vagasIdJovem100 != null && p.vagasIdJovem100 > 0)
      )
    }

    // Ordenação
    return lista.slice().sort((a, b) => {
      if (ordenacao === "valor") {
        const valA = a.valorNumerico ?? parseValorPassagem(a.valor) ?? 999999
        const valB = b.valorNumerico ?? parseValorPassagem(b.valor) ?? 999999
        return valA - valB
      }
      if (ordenacao === "partida") {
        return parseMinutosHorario(a.partida) - parseMinutosHorario(b.partida)
      }
      if (ordenacao === "duracao") {
        return parseMinutosDuracao(a.duracao) - parseMinutosDuracao(b.duracao)
      }
      return a.data.localeCompare(b.data)
    })
  }, [todasPassagens, dataFoco, empresaSelecionada, turno, ordenacao, idJovem, apenas100])

  // Agrupamento por data para exibição organizada
  const blocosPorData: BlocoData[] = useMemo(() => {
    const mapa = new Map<string, Passagem[]>()
    for (const p of passagensFiltradas) {
      const arr = mapa.get(p.data) || []
      arr.push(p)
      mapa.set(p.data, arr)
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, passagens]) => ({ data, passagens }))
  }, [passagensFiltradas])

  const handleResetFiltros = () => {
    setDataFoco(undefined)
    setEmpresaSelecionada("todas")
    setTurno("todos")
    setOrdenacao("valor")
  }

  const statusLabel = {
    online: "Online",
    sem_oferta: "Sem oferta",
    inconclusivo: "Consulta inconclusiva",
    sem_cobertura: "Sem cobertura",
    erro: "Erro",
    consultando: "Consultando...",
  } as const

  const statusStyle = {
    online: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    sem_oferta: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    inconclusivo: "text-orange-300 border-orange-500/30 bg-orange-500/10",
    sem_cobertura: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    erro: "text-red-400 border-red-500/30 bg-red-500/10",
    consultando: "text-primary border-primary/30 bg-primary/10 animate-pulse",
  } as const

  const statusIcon = {
    online: CheckCircle2,
    sem_oferta: CircleOff,
    inconclusivo: CircleAlert,
    sem_cobertura: CircleOff,
    erro: CircleAlert,
    consultando: Loader2,
  } as const

  return (
    <section className="space-y-6 pt-4 animate-fade-in">
      {/* Cabeçalho do Resultado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-card/40 border border-border/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-[11px] font-bold text-primary tracking-wide uppercase">
            <Bus className="w-3 h-3" />
            Resultado da Consulta
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2 flex-wrap">
            <span>{resultado.origem}</span>
            <ArrowRight className="w-5 h-5 text-primary shrink-0" />
            <span>{resultado.destino}</span>
          </h2>
          {resultado.datasConsultadas && resultado.datasConsultadas.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Intervalo pesquisado: {resultado.datasConsultadas.join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-col md:items-end gap-2 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <IdJovemGuideModal />
            <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/30 shadow-sm">
              {idJovem
                ? `${todasPassagens.length} opção${todasPassagens.length !== 1 ? "ões" : ""} ID Jovem`
                : `${todasPassagens.length} passagem${todasPassagens.length !== 1 ? "s" : ""} encontrada${todasPassagens.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </div>

      {resultado.statusProvedores && resultado.statusProvedores.length > 0 && (
        <div className="p-4 rounded-2xl bg-card/60 border border-border/70 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Estado dos provedores</h3>
            <span className="text-[11px] text-muted-foreground">nesta consulta</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {resultado.statusProvedores.map((provedor) => {
              const Icon = statusIcon[provedor.status] || CircleAlert
              const isSpinning = provedor.status === "consultando"
              return (
                <span
                  key={provedor.provedor}
                  title={provedor.detalhes}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusStyle[provedor.status] || statusStyle.inconclusivo}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                  {provedor.provedor}: {statusLabel[provedor.status] || provedor.status}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Banner da Melhor Oferta do Período */}
      {(resultado.melhorDataPeriodo || melhorPassagem) && (
        <BestDealBanner
          melhorData={resultado.melhorDataPeriodo}
          menorPreco={resultado.menorPrecoPeriodo}
          empresaCampeao={resultado.empresaCampeaoPeriodo}
          isIdJovem={idJovem}
          melhorPassagem={melhorPassagem}
          onSelecionarData={(data) => setDataFoco(data)}
        />
      )}

      {/* Timeline de Datas Interativa */}
      <DateTimeline
        datasDisponiveis={datasDisponiveis}
        resumosPorDia={resultado.resumoPorDia}
        dataSelecionada={dataFoco}
        melhorDataPeriodo={resultado.melhorDataPeriodo}
        isIdJovem={idJovem}
        onSelectData={(data) => setDataFoco(data)}
      />

      {/* Barra de Filtros e Ordenação */}
      {todasPassagens.length > 0 && (
        <FiltersBar
          ordenacao={ordenacao}
          setOrdenacao={setOrdenacao}
          empresaSelecionada={empresaSelecionada}
          setEmpresaSelecionada={setEmpresaSelecionada}
          empresasDisponiveis={empresasDisponiveis}
          turno={turno}
          setTurno={setTurno}
          totalExibido={passagensFiltradas.length}
          totalGeral={todasPassagens.length}
          idJovem={idJovem}
          apenas100={apenas100}
          setApenas100={setApenas100}
        />
      )}

      {/* Lista de Passagens por Bloco de Data */}
      {blocosPorData.length > 0 ? (
        <div className="space-y-8">
          {blocosPorData.map((bloco) => {
            const diaSemana = obterDiaDaSemana(bloco.data)
            const dataFmt = formatarDataBloco(bloco.data)
            const isMelhorData = resultado.melhorDataPeriodo === bloco.data

            return (
              <div key={bloco.data} className="space-y-3">
                {/* Separador de Data */}
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {diaSemana}, {dataFmt}
                    </h3>
                    {isMelhorData && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                        Melhor Data do Período
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {bloco.passagens.length} opç{bloco.passagens.length > 1 ? "ões" : "ão"}
                  </span>
                </div>

                {/* Grade de Cards de Passagem */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bloco.passagens.map((passagem) => (
                    <TripCard
                      key={passagem.id}
                      passagem={passagem}
                      destaque={passagem.id === melhorPassagem?.id}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Estado Vazio com Filtros */
        <div className="p-8 rounded-2xl bg-card/60 border border-border/70 text-center space-y-3">
          <Info className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">
            Nenhuma passagem encontrada com os filtros selecionados
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Tente remover o filtro de viação ou horário para ver mais opções disponíveis.
          </p>
          <button
            type="button"
            onClick={handleResetFiltros}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-primary hover:bg-secondary/80 text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar todos os filtros
          </button>
        </div>
      )}

      {/* Estado Vazio Total da Busca */}
      {resultado.totalEncontrado === 0 && (
        <div className="p-8 rounded-2xl bg-card/70 border border-border/80 text-center space-y-3">
          <Info className="w-12 h-12 text-muted-foreground mx-auto opacity-70" />
          <h3 className="text-lg font-bold text-foreground">
            Nenhuma viagem encontrada no período
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Não encontramos assentos disponíveis para este trecho nas datas selecionadas. Tente ampliar o intervalo de dias ou consultar os sites oficiais.
          </p>
        </div>
      )}
    </section>
  )
}
