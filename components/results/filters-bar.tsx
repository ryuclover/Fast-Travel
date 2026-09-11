"use client"

import { Filter, ArrowUpDown, Sun, Sunset, Moon } from "lucide-react"
import { TipoOrdenacao, TipoTurno } from "@/types/busca"

interface FiltersBarProps {
  ordenacao: TipoOrdenacao
  setOrdenacao: (ord: TipoOrdenacao) => void
  empresaSelecionada: string
  setEmpresaSelecionada: (empresa: string) => void
  empresasDisponiveis: string[]
  turno: TipoTurno
  setTurno: (turno: TipoTurno) => void
  totalExibido: number
  totalGeral: number
  idJovem?: boolean
  apenas100?: boolean
  setApenas100?: (apenas100: boolean) => void
}

export function FiltersBar({
  ordenacao,
  setOrdenacao,
  empresaSelecionada,
  setEmpresaSelecionada,
  empresasDisponiveis,
  turno,
  setTurno,
  totalExibido,
  totalGeral,
  idJovem,
  apenas100,
  setApenas100,
}: FiltersBarProps) {
  return (
    <div className="p-4 rounded-2xl bg-card/80 border border-border/70 backdrop-blur-md space-y-4">
      {/* Linha 1: Contagem, Ordenação e Filtro ID Jovem se ativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">
            Filtros & Ordenação
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
            {totalExibido} de {totalGeral} opções
          </span>

          {idJovem && setApenas100 && (
            <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/70 text-xs ml-2">
              <button
                type="button"
                onClick={() => setApenas100(false)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                  !apenas100
                    ? "bg-secondary text-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                100% e 50%
              </button>
              <button
                type="button"
                onClick={() => setApenas100(true)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs flex items-center gap-1 ${
                  apenas100
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm"
                    : "text-muted-foreground hover:text-emerald-400"
                }`}
              >
                ✨ Apenas 100%
              </button>
            </div>
          )}
        </div>

        {/* Seletor de Ordenação */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Ordenar por:</span>
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as TipoOrdenacao)}
            className="h-9 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="valor">Menor Preço</option>
            <option value="partida">Horário Mais Cedo</option>
            <option value="duracao">Menor Duração</option>
            <option value="padrao">Padrão</option>
          </select>
        </div>
      </div>

      {/* Linha 2: Chips de Turno (Manhã, Tarde, Noite) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-muted-foreground text-[11px] font-medium mr-1 shrink-0">
          Turno:
        </span>
        <button
          type="button"
          onClick={() => setTurno("todos")}
          className={`px-3 py-1 rounded-lg border font-medium transition-all shrink-0 ${
            turno === "todos"
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
              : "bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos os Horários
        </button>
        <button
          type="button"
          onClick={() => setTurno("manha")}
          className={`px-3 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 shrink-0 ${
            turno === "manha"
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
              : "bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sun className="w-3 h-3 text-amber-400" />
          Manhã (06h - 12h)
        </button>
        <button
          type="button"
          onClick={() => setTurno("tarde")}
          className={`px-3 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 shrink-0 ${
            turno === "tarde"
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
              : "bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sunset className="w-3 h-3 text-orange-400" />
          Tarde (12h - 18h)
        </button>
        <button
          type="button"
          onClick={() => setTurno("noite")}
          className={`px-3 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 shrink-0 ${
            turno === "noite"
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
              : "bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Moon className="w-3 h-3 text-indigo-400" />
          Noite (18h - 06h)
        </button>
      </div>

      {/* Linha 3: Chips de Empresas/Provedores */}
      {empresasDisponiveis.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar pt-1 border-t border-border/50">
          <span className="text-muted-foreground text-[11px] font-medium mr-1 shrink-0">
            Viação:
          </span>
          <button
            type="button"
            onClick={() => setEmpresaSelecionada("todas")}
            className={`px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
              empresaSelecionada === "todas"
                ? "bg-secondary border-primary/50 text-primary font-bold"
                : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({empresasDisponiveis.length})
          </button>
          {empresasDisponiveis.map((emp) => (
            <button
              key={emp}
              type="button"
              onClick={() => setEmpresaSelecionada(emp)}
              className={`px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
                empresaSelecionada === emp
                  ? "bg-secondary border-primary/50 text-primary font-bold"
                  : "bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {emp}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
