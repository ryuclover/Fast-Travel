import { Bus } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center">
              <Bus className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">
                FastTravel
              </span>
              <span className="text-xs text-muted-foreground leading-tight">Busca de passagens de ônibus</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#buscar" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Buscar
            </a>
            <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Como Funciona
            </a>
            <a href="#fontes" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Sites Parceiros
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
