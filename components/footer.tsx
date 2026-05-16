import { Bus, ExternalLink } from "lucide-react"

const sitesParceiros = [
  { nome: "ClickBus", url: "https://www.clickbus.com.br" },
  { nome: "Embarca.ai", url: "https://www.embarca.ai" },
  { nome: "Gontijo", url: "https://www.gontijo.com.br" },
  { nome: "JCA", url: "https://vendas.jcaholding.com.br" },
  { nome: "Viaje Guanabara", url: "https://viajeguanabara.com.br" },
  { nome: "Águia Branca", url: "https://www.aguiabranca.com.br" },
]

export function Footer() {
  return (
    <footer id="fontes" className="border-t border-border bg-card py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Bus className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">FastTravel</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Buscamos passagens e promoções em diversos sites de transporte para facilitar sua viagem.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Sites consultados</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sitesParceiros.map((site) => (
                <a
                  key={site.nome}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {site.nome}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>Este site apenas busca informações públicas. As reservas são feitas diretamente nos sites oficiais.</p>
        </div>
      </div>
    </footer>
  )
}
