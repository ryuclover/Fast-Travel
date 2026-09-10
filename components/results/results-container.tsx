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
import { CheckCircle2, CircleAlert, CircleOff, Radio } from "lucide-react"

interface ResultsContainerProps {
  resultado: ResultadoBusca
  idJovem: boolean
}

export function ResultsContainer({ resultado, idJovem }: ResultsContainerProps) {
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
  }, [todasPassagens, dataFoco, empresaSelecionada, turno, ordenacao])

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
    sem_cobertura: "Sem cobertura",
    erro: "Erro",
  } as const

  const statusStyle = {
    online: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    sem_oferta: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    sem_cobertura: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    erro: "text-red-400 border-red-500/30 bg-red-500/10",
  } as const

  const statusIcon = {
    online: CheckCircle2,
    sem_oferta: CircleOff,
    sem_cobertura: CircleOff,
    erro: CircleAlert,
  } as const

  return (
    <section className="w-full max-w-5xl mx-auto space-y-6 mt-8">
      {/* Cabeçalho de Rota e Metadados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card/60 border border-border/70 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Bus className="w-4 h-4" /> Resultado da Consulta
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2 flex-wrap">
            <span>{resultado.origem}</span>
            <ArrowRight className="w-5 h-5 text-primary" />
            <span>{resultado.destino}</span>
          </h2>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <IdJovemGuideModal />
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">
              {idJovem
                ? `${todasPassagens.length} opção${todasPassagens.length !== 1 ? "ões" : ""} ID Jovem`
                : `${todasPassagens.length} passagem${todasPassagens.length !== 1 ? "s" : ""} encontrada${todasPassagens.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          {resultado.datasConsultadas && resultado.datasConsultadas.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Intervalo pesquisado: {resultado.datasConsultadas.join(", ")}
            </p>
          )}
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
              const Icon = statusIcon[provedor.status]
              return (
                <span
                  key={provedor.provedor}
                  title={provedor.detalhes}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusStyle[provedor.status]}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {provedor.provedor}: {statusLabel[provedor.status]}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Banner da Melhor Oferta do Período */}
      {resultado.melhorDataPeriodo && (
        <BestDealBanner
          melhorData={resultado.melhorDataPeriodo}
          menorPreco={resultado.menorPrecoPeriodo}
          empresaCampeao={resultado.empresaCampeaoPeriodo}
          isIdJovem={idJovem}
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
                  {bloco.passagens.map((passagem, idx) => (
                    <TripCard
                      key={passagem.id}
                      passagem={passagem}
                      destaque={isMelhorData && idx === 0}
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
