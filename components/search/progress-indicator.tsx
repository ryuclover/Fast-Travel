import { Loader2 } from "lucide-react"

interface ProgressIndicatorProps {
  progresso: number
  mensagemCustomizada?: string
}

export function ProgressIndicator({ progresso, mensagemCustomizada }: ProgressIndicatorProps) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const clampedValue = Math.min(100, Math.max(0, progresso))
  const offset = circumference - (clampedValue / 100) * circumference
  const displayValue = Math.round(clampedValue)

  let etapaTexto = "Iniciando consulta..."
  let subTexto = "Preparando conexão com as operadoras"

  if (clampedValue >= 10 && clampedValue < 30) {
    etapaTexto = "Consultando ClickBus..."
    subTexto = "Verificando rotas e tarifas integradas"
  } else if (clampedValue >= 30 && clampedValue < 60) {
    etapaTexto = "Consultando Buser e Guanabara..."
    subTexto = "Buscando viagens de fretamento e linhas regulares"
  } else if (clampedValue >= 60 && clampedValue < 85) {
    etapaTexto = "Verificando Gontijo e vagas ID Jovem..."
    subTexto = "Checando disponibilidade de gratuidades"
  } else if (clampedValue >= 85) {
    etapaTexto = "Consolidando menores preços..."
    subTexto = "Calculando o melhor dia para viajar no período"
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-secondary/50 border border-primary/20 backdrop-blur-md glow-primary">
      {/* SVG Circular Dial */}
      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 76 76">
          {/* Trilha */}
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-border/60"
          />
          {/* Barra de Progresso Neon */}
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke="oklch(0.7 0.15 180)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <span className="absolute font-bold text-xs text-primary">
          {displayValue}%
        </span>
      </div>

      {/* Textos de Status */}
      <div className="flex flex-col text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="font-semibold text-sm text-foreground">
            {mensagemCustomizada || etapaTexto}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {subTexto}
        </p>
      </div>
    </div>
  )
}
