"use client"

import {
  Bus,
  Clock,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Armchair,
  CheckCircle2,
  Building,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Passagem } from "@/types/busca"
import { formatarDataBloco, obterDiaDaSemana } from "@/lib/utils/formatters"

interface TripCardProps {
  passagem: Passagem
  destaque?: boolean
}

export function TripCard({ passagem, destaque }: TripCardProps) {
  const is100 =
    passagem.tipoGratuidade === "id_jovem_100" ||
    (passagem.vagasIdJovem100 && passagem.vagasIdJovem100 > 0) ||
    passagem.valor === "R$ 0,00" ||
    passagem.valorNumerico === 0

  const is50 = passagem.tipoGratuidade === "id_jovem_50"

  const diaSemana = obterDiaDaSemana(passagem.data)
  const dataFormatada = formatarDataBloco(passagem.data)

  // Badge do provedor de dados
  const getProvedorBadge = (site: string, empresa: string) => {
    const s = `${site} ${empresa}`.toLowerCase()
    if (s.includes("buser")) {
      return { nome: "Buser", cor: "bg-pink-500/15 text-pink-400 border-pink-500/30" }
    }
    if (s.includes("gontijo")) {
      return { nome: "Gontijo", cor: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    }
    if (s.includes("embarca")) {
      return { nome: "Embarca.ai", cor: "bg-purple-500/15 text-purple-400 border-purple-500/30" }
    }
    if (s.includes("guanabara") || s.includes("util") || s.includes("sampaio") || s.includes("real expresso")) {
      return { nome: "Guanabara / UTIL", cor: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
    }
    return { nome: "ClickBus", cor: "bg-teal-500/15 text-teal-400 border-teal-500/30" }
  }

  const provedorInfo = getProvedorBadge(passagem.site, passagem.empresa)
  const isReservaOnline =
    passagem.modalidadeGratuidade === "online" ||
    passagem.linkCompra?.includes("viajeguanabara") ||
    passagem.linkCompra?.includes("embarca")

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
        destaque
          ? "bg-gradient-to-b from-card via-card to-primary/5 border-primary/40 shadow-xl glow-primary"
          : "bg-card/75 hover:bg-card/95 border-border/70 hover:border-primary/40 hover:shadow-lg"
      }`}
    >
      {/* Barra superior de destaque se for a melhor oferta */}
      {destaque && (
        <div className="bg-primary/20 border-b border-primary/30 px-4 py-1 flex items-center justify-between text-xs font-semibold text-primary">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Menor preço encontrado na data
          </span>
          <span>{diaSemana}, {dataFormatada}</span>
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col justify-between h-full gap-4">
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-foreground tracking-tight">
                {passagem.empresa}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${provedorInfo.cor}`}
              >
                via {provedorInfo.nome}
              </span>
              {passagem.classe && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground border border-border/60 flex items-center gap-1">
                  <Armchair className="w-3 h-3" />
                  {passagem.classe}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
              {diaSemana}, {dataFormatada}
            </span>
          </div>

          {/* Badges de ID Jovem */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            {is100 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Grátis (Lei 12.852)</span>
              </div>
            ) : is50 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>50% Desconto ID Jovem</span>
              </div>
            ) : null}

            {(is100 || is50) && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                {isReservaOnline ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Reserva Online Disponível
                  </>
                ) : (
                  <>
                    <Building className="w-3 h-3 text-amber-400" />
                    Emissão no Guichê (Min. 3h)
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Linha de Horários e Rota */}
        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3 py-1">
          {/* Partida */}
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold text-foreground tracking-tight">
              {passagem.partida}
            </span>
            <span className="text-xs text-muted-foreground line-clamp-1 font-medium">
              {passagem.origem || "Origem"}
            </span>
          </div>

          {/* Duração & Ícone de Ônibus */}
          <div className="flex flex-col items-center px-2">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {passagem.duracao}
            </span>
            <div className="w-20 sm:w-28 flex items-center gap-1 my-1">
              <div className="h-px bg-border/80 flex-1" />
              <Bus className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="h-px bg-border/80 flex-1" />
            </div>
            <span className="text-[10px] text-muted-foreground/80">Direto</span>
          </div>

          {/* Chegada */}
          <div className="flex flex-col items-end text-right">
            <span className="text-2xl font-extrabold text-foreground tracking-tight">
              {passagem.chegada !== "N/A" ? passagem.chegada : "--:--"}
            </span>
            <span className="text-xs text-muted-foreground line-clamp-1 font-medium">
              {passagem.destino || "Destino"}
            </span>
          </div>
        </div>

        {/* Rodapé: Preço e Botão Reservar */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3">
          <div>
            {is100 ? (
              <div>
                <span className="text-xs font-semibold text-emerald-400 block uppercase tracking-wider">
                  Gratuidade Integral
                </span>
                <span className="text-2xl font-black text-emerald-400 tracking-tight">
                  R$ 0,00
                </span>
              </div>
            ) : is50 ? (
              <div>
                <span className="text-[10px] uppercase font-semibold text-amber-400 block tracking-wider">
                  50% com ID Jovem
                </span>
                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {passagem.valor}
                </span>
              </div>
            ) : passagem.valor ? (
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block tracking-wider">
                  Tarifa comercial
                </span>
                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {passagem.valor}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-xs text-muted-foreground">Consulte no site</span>
              </div>
            )}
          </div>

          <Button
            asChild
            size="sm"
            className={`h-10 px-4 rounded-xl font-bold transition-all hover:scale-102 ${
              is100
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
            }`}
          >
            <a
              href={passagem.linkCompra || passagem.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <span>
                {is100
                  ? isReservaOnline
                    ? "Garantir 100% Grátis"
                    : "Emitir no Guichê"
                  : is50
                  ? "Reservar com 50%"
                  : "Reservar"}
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
