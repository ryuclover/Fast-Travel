"use client"

import { Zap, ExternalLink, Sparkles, CheckCircle2, Clock, Bus, ArrowRight } from "lucide-react"
import { Passagem } from "@/types/busca"
import { formatarDataBloco, obterDiaDaSemanaCompleto, formatarMoeda } from "@/lib/utils/formatters"

interface BestDealBannerProps {
  melhorData?: string
  menorPreco?: number
  empresaCampeao?: string
  isIdJovem: boolean
  melhorPassagem?: Passagem | null
  onSelecionarData?: (data: string) => void
}

export function BestDealBanner({
  melhorData,
  menorPreco,
  empresaCampeao,
  isIdJovem,
  melhorPassagem,
  onSelecionarData,
}: BestDealBannerProps) {
  if (!melhorData && !melhorPassagem) return null

  const dataAlvo = melhorPassagem?.data || melhorData || ""
  const dataFormatada = formatarDataBloco(dataAlvo)
  const diaSemana = obterDiaDaSemanaCompleto(dataAlvo)

  const is100 =
    melhorPassagem?.tipoGratuidade === "id_jovem_100" ||
    melhorPassagem?.valor === "R$ 0,00" ||
    melhorPassagem?.valorNumerico === 0 ||
    (melhorPassagem?.vagasIdJovem100 != null && melhorPassagem.vagasIdJovem100 > 0)

  const is50 = melhorPassagem?.tipoGratuidade === "id_jovem_50"

  const linkCheckout = melhorPassagem?.linkCompra || melhorPassagem?.siteUrl

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-card/80 to-teal-950/30 p-5 md:p-7 shadow-2xl backdrop-blur-xl">
      {/* Brilhos decorativos de fundo */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Lado Esquerdo: Info da Melhor Oferta */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              {is100
                ? "🏆 Melhor Vaga ID Jovem Encontrada (100% Grátis)"
                : isIdJovem
                ? "🏆 Melhor Vaga ID Jovem (50% Desconto)"
                : "🏆 Melhor Oportunidade do Período"}
            </span>

            {melhorPassagem?.empresa && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/80 text-muted-foreground border border-border/60">
                <Bus className="w-3 h-3 text-primary" />
                {melhorPassagem.empresa}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2 flex-wrap">
              <span>{dataFormatada}</span>
              <span className="text-base sm:text-lg font-normal text-muted-foreground">
                ({diaSemana})
              </span>
              {melhorPassagem?.partida && (
                <span className="inline-flex items-center gap-1 text-base font-bold text-foreground bg-secondary/60 px-2.5 py-0.5 rounded-lg border border-border/60">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Saída {melhorPassagem.partida}
                </span>
              )}
            </h3>

            {melhorPassagem && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                {melhorPassagem.classe && (
                  <span>
                    Classe: <strong className="text-foreground">{melhorPassagem.classe}</strong>
                  </span>
                )}
                {melhorPassagem.duracao && (
                  <span>
                    • Duração: <strong className="text-foreground">{melhorPassagem.duracao}</strong>
                  </span>
                )}
                {melhorPassagem.chegada && melhorPassagem.chegada !== "N/A" && (
                  <span>
                    • Chegada aprox.: <strong className="text-foreground">{melhorPassagem.chegada}</strong>
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {is100 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                Vaga 100% gratuita identificada (Tarifa R$ 0,00)!
                {melhorPassagem?.valor && melhorPassagem.valor !== "R$ 0,00" && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (apenas {melhorPassagem.valor} de taxa de embarque)
                  </span>
                )}
              </span>
            ) : is50 && melhorPassagem?.valor ? (
              <span className="text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Desconto ID Jovem aplicado: <strong className="text-foreground text-sm">{melhorPassagem.valor}</strong>
              </span>
            ) : menorPreco !== undefined && menorPreco > 0 ? (
              <span className="text-muted-foreground">
                Passagens a partir de{" "}
                <strong className="text-foreground font-extrabold text-base">
                  {formatarMoeda(menorPreco)}
                </strong>
                {empresaCampeao && (
                  <span>
                    {" "}pela viação <strong className="text-primary font-semibold">{empresaCampeao}</strong>
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Viagem recomendada com as melhores condições e horários disponíveis.
              </span>
            )}
          </div>
        </div>

        {/* Lado Direito: Botões de Ação */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
          {linkCheckout && (
            <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-1">
              <a
                href={linkCheckout}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-encaminhamento-direto"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 active:scale-95 border border-emerald-300/60 group"
              >
                <Zap className="w-5 h-5 fill-slate-950 text-slate-950 group-hover:scale-110 transition-transform" />
                <span>Encaminhamento Direto</span>
                <ExternalLink className="w-4 h-4 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <span className="text-[11px] text-emerald-400/90 font-medium text-center sm:text-right px-1">
                Abre o checkout oficial na viação com o benefício pré-aplicado
              </span>
            </div>
          )}

          {onSelecionarData && (
            <button
              type="button"
              onClick={() => onSelecionarData(dataAlvo)}
              className="px-4 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/70 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>Ver todas as opções deste dia</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

