"use client"

import { Trophy, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react"
import { formatarDataBloco, obterDiaDaSemanaCompleto, formatarMoeda } from "@/lib/utils/formatters"

interface BestDealBannerProps {
  melhorData?: string
  menorPreco?: number
  empresaCampeao?: string
  isIdJovem: boolean
  onSelecionarData?: (data: string) => void
}

export function BestDealBanner({
  melhorData,
  menorPreco,
  empresaCampeao,
  isIdJovem,
  onSelecionarData,
}: BestDealBannerProps) {
  if (!melhorData) return null

  const dataFormatada = formatarDataBloco(melhorData)
  const diaSemana = obterDiaDaSemanaCompleto(melhorData)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/10 to-teal-500/10 p-5 md:p-6 shadow-xl backdrop-blur-md">
      {/* Luz decorativa */}
      <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
            🏆
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Melhor oportunidade no período pesquisado
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2 flex-wrap">
              <span>{dataFormatada}</span>
              <span className="text-sm sm:text-base font-normal text-muted-foreground">
                ({diaSemana})
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-muted-foreground">
              {isIdJovem ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Vaga 100% gratuita identificada para este dia!
                </span>
              ) : menorPreco !== undefined && menorPreco > 0 ? (
                <>
                  Passagens a partir de{" "}
                  <strong className="text-foreground font-extrabold text-base">
                    {formatarMoeda(menorPreco)}
                  </strong>{" "}
                  {empresaCampeao && (
                    <span>
                      pela viação <strong className="text-primary font-semibold">{empresaCampeao}</strong>
                    </span>
                  )}
                </>
              ) : (
                "Dia com as melhores condições e horários disponíveis."
              )}
            </p>
          </div>
        </div>

        {onSelecionarData && (
          <button
            type="button"
            onClick={() => onSelecionarData(melhorData)}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md shadow-primary/20 shrink-0"
          >
            <span>Ver passagens deste dia</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
