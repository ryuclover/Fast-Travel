"use client"

import { Calendar, Check, Sparkles } from "lucide-react"
import { ResumoDia } from "@/types/busca"
import {
  formatarDataBloco,
  obterDiaDaSemana,
  formatarMoeda,
} from "@/lib/utils/formatters"

interface DateTimelineProps {
  datasDisponiveis: string[]
  resumosPorDia?: ResumoDia[]
  dataSelecionada?: string
  melhorDataPeriodo?: string
  isIdJovem: boolean
  onSelectData: (data?: string) => void
}

export function DateTimeline({
  datasDisponiveis,
  resumosPorDia = [],
  dataSelecionada,
  melhorDataPeriodo,
  isIdJovem,
  onSelectData,
}: DateTimelineProps) {
  if (datasDisponiveis.length <= 1) return null

  const mapaResumos = new Map<string, ResumoDia>()
  for (const r of resumosPorDia) {
    mapaResumos.set(r.data, r)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground uppercase tracking-wide">
            Comparador de Datas no Período
          </h3>
        </div>

        {dataSelecionada && (
          <button
            type="button"
            onClick={() => onSelectData(undefined)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Exibir todas as datas ({datasDisponiveis.length})
          </button>
        )}
      </div>

      {/* Faixa horizontal de datas */}
      <div className="flex gap-2.5 overflow-x-auto pb-2.5 pt-1 px-1 custom-scrollbar">
        {/* Botão Todos os Dias */}
        <button
          type="button"
          onClick={() => onSelectData(undefined)}
          className={`shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-xl border text-center transition-all min-w-[90px] ${
            !dataSelecionada
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/25"
              : "bg-card/70 border-border/70 hover:border-primary/40 hover:bg-secondary/60 text-muted-foreground"
          }`}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider">Período</span>
          <span className="text-base font-bold">Todos</span>
          <span className="text-[10px] opacity-80 mt-0.5">{datasDisponiveis.length} dias</span>
        </button>

        {/* Cada Dia do Intervalo */}
        {datasDisponiveis.map((data) => {
          const isAtivo = dataSelecionada === data
          const isMelhorData = melhorDataPeriodo === data
          const resumo = mapaResumos.get(data)
          const diaSemana = obterDiaDaSemana(data)
          const dataFmt = formatarDataBloco(data)

          return (
            <button
              key={data}
              type="button"
              onClick={() => onSelectData(data)}
              className={`shrink-0 flex flex-col items-center p-3 rounded-xl border text-center transition-all min-w-[130px] relative ${
                isAtivo
                  ? "bg-primary/20 border-primary text-foreground shadow-md ring-1 ring-primary"
                  : "bg-card/75 border-border/70 hover:border-primary/40 hover:bg-secondary/60 text-muted-foreground"
              }`}
            >
              {/* Badge Melhor Oferta */}
              {isMelhorData && (
                <span className="absolute -top-2 px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-sm flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> Campeão
                </span>
              )}

              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {diaSemana}
              </span>

              <span className="text-base font-bold text-foreground my-0.5">
                {dataFmt}
              </span>

              {/* Preço ou Status ID Jovem */}
              {isIdJovem || resumo?.temIdJovem100 ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                  ID Jovem 100%
                </span>
              ) : resumo?.menorValor !== undefined && resumo.menorValor > 0 ? (
                <span className="text-xs font-extrabold text-primary">
                  a partir de {formatarMoeda(resumo.menorValor)}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Consultar</span>
              )}

              {resumo && resumo.totalViagens > 0 && (
                <span className="text-[10px] text-muted-foreground/80 mt-1">
                  {resumo.totalViagens} opç{resumo.totalViagens > 1 ? "ões" : "ão"}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
