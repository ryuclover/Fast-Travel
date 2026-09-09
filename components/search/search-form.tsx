"use client"

import { useRef, type ChangeEvent } from "react"
import {
  MapPin,
  Calendar,
  Search,
  ArrowLeftRight,
  Ticket,
  ExternalLink,
  Sparkles,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cidadesSugeridas, valorCidade } from "@/lib/cidades-sugeridas"
import {
  formatarDataParaExibicao,
  parseDataExibicao,
  montarLinkClickbus,
} from "@/lib/utils/formatters"
import { ProgressIndicator } from "./progress-indicator"

interface SearchFormProps {
  origemSelecionada: string
  setOrigemSelecionada: (valor: string) => void
  destinoSelecionado: string
  setDestinoSelecionado: (valor: string) => void
  dataInicio: string
  setDataInicio: (valor: string) => void
  dataInicioDisplay: string
  setDataInicioDisplay: (valor: string) => void
  dataFim: string
  setDataFim: (valor: string) => void
  dataFimDisplay: string
  setDataFimDisplay: (valor: string) => void
  idJovem: boolean
  setIdJovem: (valor: boolean) => void
  carregando: boolean
  progresso: number
  erro: string
  onBuscar: () => void
}

const ROTAS_POPULARES = [
  { origem: "Rio de Janeiro::RJ", destino: "Sao Paulo::SP", label: "Rio ⇄ SP" },
  { origem: "Sao Paulo::SP", destino: "Curitiba::PR", label: "SP ⇄ Curitiba" },
  { origem: "Belo Horizonte::MG", destino: "Rio de Janeiro::RJ", label: "BH ⇄ Rio" },
  { origem: "Sao Paulo::SP", destino: "Belo Horizonte::MG", label: "SP ⇄ BH" },
]

export function SearchForm({
  origemSelecionada,
  setOrigemSelecionada,
  destinoSelecionado,
  setDestinoSelecionado,
  dataInicio,
  setDataInicio,
  dataInicioDisplay,
  setDataInicioDisplay,
  dataFim,
  setDataFim,
  dataFimDisplay,
  setDataFimDisplay,
  idJovem,
  setIdJovem,
  carregando,
  progresso,
  erro,
  onBuscar,
}: SearchFormProps) {
  const dataInicioHiddenRef = useRef<HTMLInputElement>(null)
  const dataFimHiddenRef = useRef<HTMLInputElement>(null)

  const handleInverterRota = () => {
    const tempOrigem = origemSelecionada
    setOrigemSelecionada(destinoSelecionado)
    setDestinoSelecionado(tempOrigem)
  }

  const aplicarRotaRapida = (origem: string, destino: string) => {
    setOrigemSelecionada(origem)
    setDestinoSelecionado(destino)
  }

  const abrirCalendario = (tipo: "inicio" | "fim") => {
    const input = tipo === "inicio" ? dataInicioHiddenRef.current : dataFimHiddenRef.current
    if (!input) return
    try {
      input.showPicker?.()
    } catch {
      input.focus()
    }
  }

  const handleDataInicioChange = (e: ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    setDataInicioDisplay(valor)
    const iso = parseDataExibicao(valor)
    if (iso) {
      setDataInicio(iso)
      // Se data fim for anterior à nova data inicio, sincroniza
      if (new Date(`${dataFim}T00:00:00`) < new Date(`${iso}T00:00:00`)) {
        setDataFim(iso)
        setDataFimDisplay(formatarDataParaExibicao(iso))
      }
    }
  }

  const handleDataFimChange = (e: ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    setDataFimDisplay(valor)
    const iso = parseDataExibicao(valor)
    if (iso) {
      setDataFim(iso)
    }
  }

  const aplicarPresetIntervalo = (diasAdicionais: number) => {
    const base = new Date(`${dataInicio}T00:00:00`)
    if (isNaN(base.getTime())) return
    const novaFim = new Date(base)
    novaFim.setDate(novaFim.getDate() + diasAdicionais)
    const isoFim = novaFim.toISOString().split("T")[0]
    setDataFim(isoFim)
    setDataFimDisplay(formatarDataParaExibicao(isoFim))
  }

  const aplicarFimDeSemana = () => {
    const hoje = new Date()
    const diaSemana = hoje.getDay() // 0 = Domingo, 5 = Sexta
    const diasAteSexta = (5 - diaSemana + 7) % 7 || 7
    const proximaSexta = new Date(hoje)
    proximaSexta.setDate(hoje.getDate() + diasAteSexta)
    const proximoDomingo = new Date(proximaSexta)
    proximoDomingo.setDate(proximaSexta.getDate() + 2)

    const isoSexta = proximaSexta.toISOString().split("T")[0]
    const isoDomingo = proximoDomingo.toISOString().split("T")[0]

    setDataInicio(isoSexta)
    setDataInicioDisplay(formatarDataParaExibicao(isoSexta))
    setDataFim(isoDomingo)
    setDataFimDisplay(formatarDataParaExibicao(isoDomingo))
  }

  // Links diretos para ClickBus
  const directLinks =
    origemSelecionada && destinoSelecionado && dataInicio && dataFim
      ? (() => {
          const inicio = new Date(`${dataInicio}T00:00:00`)
          const fim = new Date(`${dataFim}T00:00:00`)
          const dias = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000) + 1)
          if (dias <= 0) return []

          const [origem, origemUF] = origemSelecionada.split("::")
          const [destino, destinoUF] = destinoSelecionado.split("::")

          return Array.from({ length: Math.min(dias, 7) }, (_, idx) => {
            const dataConsulta = new Date(inicio)
            dataConsulta.setDate(dataConsulta.getDate() + idx)
            const dataIso = dataConsulta.toISOString().split("T")[0]

            return {
              data: formatarDataParaExibicao(dataIso),
              url: montarLinkClickbus(origem, origemUF, destino, destinoUF, dataIso, idJovem),
            }
          })
        })()
      : []

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Rotas Populares */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 text-xs text-muted-foreground custom-scrollbar">
        <span className="font-semibold text-foreground/80 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Rotas rápidas:
        </span>
        {ROTAS_POPULARES.map((rota) => {
          const ativa =
            origemSelecionada === rota.origem && destinoSelecionado === rota.destino
          return (
            <button
              key={rota.label}
              type="button"
              onClick={() => aplicarRotaRapida(rota.origem, rota.destino)}
              className={`px-2.5 py-1 rounded-full border transition-all shrink-0 ${
                ativa
                  ? "bg-primary/20 border-primary text-primary font-medium"
                  : "bg-secondary/40 border-border/70 hover:bg-secondary hover:text-foreground"
              }`}
            >
              {rota.label}
            </button>
          )
        })}
      </div>

      {/* Card Principal do Formulário */}
      <div className="p-5 md:p-7 rounded-2xl bg-card/85 border border-border/80 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-5 relative">
          {/* Seletor de Cidades com botão de inversão */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-end">
            {/* Origem */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Origem
              </label>
              <div className="relative">
                <select
                  value={origemSelecionada}
                  onChange={(e) => setOrigemSelecionada(e.target.value)}
                  className="w-full h-12 rounded-xl border border-border bg-secondary/80 px-4 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="">Selecione a cidade de partida</option>
                  {cidadesSugeridas.map((cidade) => {
                    const valor = valorCidade(cidade)
                    return (
                      <option key={`origem-${valor}`} value={valor}>
                        {cidade.nome} - {cidade.uf}
                      </option>
                    )
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-muted-foreground">
                  ▼
                </div>
              </div>
            </div>

            {/* Botão Inverter Rota */}
            <div className="flex justify-center md:pb-1">
              <button
                type="button"
                onClick={handleInverterRota}
                title="Inverter origem e destino"
                className="w-10 h-10 rounded-xl bg-secondary/80 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-secondary transition-all active:scale-95"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            {/* Destino */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Destino
              </label>
              <div className="relative">
                <select
                  value={destinoSelecionado}
                  onChange={(e) => setDestinoSelecionado(e.target.value)}
                  className="w-full h-12 rounded-xl border border-border bg-secondary/80 px-4 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="">Selecione a cidade de chegada</option>
                  {cidadesSugeridas.map((cidade) => {
                    const valor = valorCidade(cidade)
                    return (
                      <option key={`destino-${valor}`} value={valor}>
                        {cidade.nome} - {cidade.uf}
                      </option>
                    )
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-muted-foreground">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Filtro ID Jovem Toggle */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-secondary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  idJovem
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Modalidade de Passagem
                  {idJovem && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      ID Jovem Ativo
                    </span>
                  )}
                </span>
                <p className="text-xs text-muted-foreground">
                  {idJovem
                    ? "Filtrando apenas gratuidades estatutárias de 100% ou 50% de desconto"
                    : "Pesquisando todas as tarifas comerciais disponíveis nos 4 provedores"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-lg border border-border/70 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIdJovem(false)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !idJovem
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Geral (Todas)
              </button>
              <button
                type="button"
                onClick={() => setIdJovem(true)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  idJovem
                    ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                    : "text-muted-foreground hover:text-emerald-400"
                }`}
              >
                Apenas ID Jovem
              </button>
            </div>
          </div>

          {/* Seletor de Intervalo de Datas + Atalhos */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Intervalo de Consulta
              </label>

              {/* Atalhos Rápidos de Dias */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground mr-1">Atalhos:</span>
                <button
                  type="button"
                  onClick={() => aplicarPresetIntervalo(0)}
                  className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
                >
                  1 dia
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPresetIntervalo(3)}
                  className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
                >
                  +3 dias
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPresetIntervalo(5)}
                  className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
                >
                  +5 dias
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPresetIntervalo(7)}
                  className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
                >
                  +7 dias
                </button>
                <button
                  type="button"
                  onClick={aplicarFimDeSemana}
                  className="text-xs px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                >
                  Fim de Semana
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Data Início */}
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  value={dataInicioDisplay}
                  onChange={handleDataInicioChange}
                  placeholder="Data inicial (dd/mm)"
                  inputMode="numeric"
                  className="h-12 pl-10 pr-10 bg-secondary/80 border-border rounded-xl font-medium"
                />
                <button
                  type="button"
                  onClick={() => abrirCalendario("inicio")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
                  aria-label="Abrir seletor de data inicial"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <input
                  ref={dataInicioHiddenRef}
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value)
                    setDataInicioDisplay(formatarDataParaExibicao(e.target.value))
                  }}
                  min={new Date().toISOString().split("T")[0]}
                  className="absolute opacity-0 pointer-events-none w-px h-px"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>

              {/* Data Fim */}
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <Input
                  type="text"
                  value={dataFimDisplay}
                  onChange={handleDataFimChange}
                  placeholder="Data final (dd/mm)"
                  inputMode="numeric"
                  className="h-12 pl-10 pr-10 bg-secondary/80 border-border rounded-xl font-medium"
                />
                <button
                  type="button"
                  onClick={() => abrirCalendario("fim")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
                  aria-label="Abrir seletor de data final"
                >
                  <Calendar className="w-4 h-4" />
                </button>
                <input
                  ref={dataFimHiddenRef}
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value)
                    setDataFimDisplay(formatarDataParaExibicao(e.target.value))
                  }}
                  min={new Date().toISOString().split("T")[0]}
                  className="absolute opacity-0 pointer-events-none w-px h-px"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* Botão Principal de Busca */}
          <div className="pt-2">
            <Button
              size="lg"
              onClick={onBuscar}
              disabled={carregando}
              className="w-full h-14 rounded-xl text-base font-bold bg-gradient-to-r from-primary via-primary/95 to-teal-400 hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-[0.99] gap-2"
            >
              <Search className="w-5 h-5" />
              {carregando ? "Pesquisando Provedores..." : "Comparar Passagens no Período"}
            </Button>
          </div>

          {/* Indicador de Progresso durante busca */}
          {carregando && (
            <div className="mt-4">
              <ProgressIndicator progresso={progresso} />
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="p-3.5 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Links Rápidos Oficiais */}
          {directLinks.length > 0 && !carregando && (
            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Abrir pesquisa oficial nos sites:</span>
              <div className="flex flex-wrap gap-1.5">
                {directLinks.map((link) => (
                  <a
                    key={link.data}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary text-primary hover:underline transition-colors border border-border/50"
                  >
                    {link.data}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
