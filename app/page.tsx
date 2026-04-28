"use client"

import { useRef, useState } from "react"
import { MapPin, Calendar, Search, ArrowRight, ExternalLink, Loader2, Info, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { cidadesSugeridas, valorCidade } from "@/lib/cidades-sugeridas"

interface Passagem {
  id: string
  empresa: string
  site: string
  siteUrl: string
  origem: string
  destino: string
  data: string
  partida: string
  chegada: string
  duracao: string
  vagasIdJovem: number
  linkCompra: string
}

interface ResultadoBusca {
  buscadoEm: string
  origem: string
  destino: string
  dataSolicitada: string
  dataTemIdJovem?: boolean
  fontesIgnoradas?: string[]
  passagensNaData: Passagem[]
  passagensProximas: Passagem[]
  totalEncontrado: number
}

interface BlocoData {
  data: string
  passagens: Passagem[]
}

function formatarDataBloco(dataStr: string) {
  const [ano, mes, dia] = dataStr.split("-")
  const dataObj = new Date(Number.parseInt(ano, 10), Number.parseInt(mes, 10) - 1, Number.parseInt(dia, 10))
  return dataObj.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function agruparPorData(passagens: Passagem[]): BlocoData[] {
  const agrupado = new Map<string, Passagem[]>()

  for (const passagem of passagens) {
    const lista = agrupado.get(passagem.data) ?? []
    lista.push(passagem)
    agrupado.set(passagem.data, lista)
  }

  return Array.from(agrupado.entries())
    .sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
    .map(([data, lista]) => ({
      data,
      passagens: lista.sort((a, b) => a.site.localeCompare(b.site)),
    }))
}

export default function Home() {
  const [origemSelecionada, setOrigemSelecionada] = useState("")
  const [destinoSelecionado, setDestinoSelecionado] = useState("")
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0])
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [erro, setErro] = useState("")
  const dataInputRef = useRef<HTMLInputElement>(null)

  const abrirCalendario = () => {
    dataInputRef.current?.showPicker?.()
  }

  const blocosDatas = resultado
    ? agruparPorData([...resultado.passagensNaData, ...resultado.passagensProximas])
    : []

  const handleBuscar = async () => {
    if (!origemSelecionada || !destinoSelecionado || !data) {
      setErro("Selecione origem, destino e data para buscar")
      return
    }

    if (origemSelecionada === destinoSelecionado) {
      setErro("Origem e destino devem ser diferentes")
      return
    }

    const [origem, origemUF] = origemSelecionada.split("::")
    const [destino, destinoUF] = destinoSelecionado.split("::")

    setErro("")
    setCarregando(true)
    setResultado(null)

    try {
      const params = new URLSearchParams({
        origem,
        destino,
        data,
        origemUF,
        destinoUF,
      })

      const response = await fetch(`/api/buscar?${params}`)
      const dados = await response.json()

      if (!response.ok) {
        throw new Error(dados.error || "Erro ao buscar passagens")
      }

      setResultado(dados)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar passagens")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero e Busca */}
        <section id="buscar" className="relative py-12 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          
          <div className="container mx-auto px-4 relative">
            <div className="max-w-3xl mx-auto text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6">
                <Ticket className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">Passagens gratuitas ID Jovem</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Encontre vagas
                <span className="text-primary"> gratuitas</span> do ID Jovem
              </h1>
              
              <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
                Buscamos em diversos sites de passagens para encontrar vagas gratuitas para você viajar com o ID Jovem.
              </p>
            </div>

            {/* Formulário de Busca */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-lg">
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Origem */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Origem</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                          value={origemSelecionada}
                          onChange={(e) => setOrigemSelecionada(e.target.value)}
                          className="w-full h-10 rounded-md border border-border bg-secondary pl-10 pr-3 text-sm"
                        >
                          <option value="">Selecione a cidade de origem</option>
                          {cidadesSugeridas.map((cidade) => {
                            const valor = valorCidade(cidade)
                            return (
                              <option key={valor} value={valor}>
                                {cidade.nome} - {cidade.uf}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Destino */}
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Destino</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                        <select
                          value={destinoSelecionado}
                          onChange={(e) => setDestinoSelecionado(e.target.value)}
                          className="w-full h-10 rounded-md border border-border bg-secondary pl-10 pr-3 text-sm"
                        >
                          <option value="">Selecione a cidade de destino</option>
                          {cidadesSugeridas.map((cidade) => {
                            const valor = valorCidade(cidade)
                            return (
                              <option key={valor} value={valor}>
                                {cidade.nome} - {cidade.uf}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Data */}
                    <div className="space-y-2 flex-1">
                      <label className="text-sm text-muted-foreground">Data da viagem</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          ref={dataInputRef}
                          type="date"
                          value={data}
                          onChange={(e) => setData(e.target.value)}
                          onClick={abrirCalendario}
                          onFocus={abrirCalendario}
                          min={new Date().toISOString().split("T")[0]}
                          className="pl-10 bg-secondary border-border"
                        />
                      </div>
                    </div>

                    {/* Botão Buscar */}
                    <div className="flex items-end">
                      <Button 
                        size="lg" 
                        className="gap-2 w-full md:w-auto" 
                        onClick={handleBuscar}
                        disabled={carregando}
                      >
                        {carregando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {carregando ? "Buscando..." : "Buscar vagas"}
                      </Button>
                    </div>
                  </div>
                </div>

                {erro && (
                  <p className="mt-4 text-sm text-destructive">{erro}</p>
                )}
              </div>
            </div>

            {/* Resultados da Busca */}
            {resultado && (
              <div className="max-w-6xl mx-auto mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                  <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                    {resultado.origem} <ArrowRight className="w-4 h-4 text-primary" /> {resultado.destino}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {resultado.totalEncontrado} vaga{resultado.totalEncontrado !== 1 ? "s" : ""} encontrada{resultado.totalEncontrado !== 1 ? "s" : ""}
                  </span>
                </div>

                {blocosDatas.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-lg font-medium mb-4">Datas com vaga (da mais proxima para a mais distante)</h3>
                    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
                      {blocosDatas.map((bloco) => (
                        <div
                          key={bloco.data}
                          className="min-w-[240px] md:min-w-[260px] bg-card border border-border rounded-lg p-3 snap-start"
                        >
                          <p className="text-sm text-muted-foreground mb-1">Data da viagem</p>
                          <p className="text-base font-semibold mb-3">{formatarDataBloco(bloco.data)}</p>

                          <div className="space-y-2">
                            {bloco.passagens.map((passagem) => (
                              <SiteDisponivelItem key={passagem.id} passagem={passagem} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resultado.totalEncontrado === 0 && (
                  <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-lg font-medium mb-2">Nenhuma vaga encontrada</p>
                    <p className="text-muted-foreground">
                      Tente buscar em uma data diferente ou verifique os sites diretamente.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Como Funciona */}
        <section id="como-funciona" className="py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">Como funciona o ID Jovem</h2>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Cadastre-se</h3>
                <p className="text-sm text-muted-foreground">
                  Faça seu cadastro no app ID Jovem (15-29 anos, baixa renda)
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Busque vagas</h3>
                <p className="text-sm text-muted-foreground">
                  Use nossa busca para encontrar vagas gratuitas disponíveis
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Reserve no site</h3>
                <p className="text-sm text-muted-foreground">
                  Acesse o site da empresa e reserve sua vaga gratuitamente
                </p>
              </div>
            </div>

            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-center">
                  <strong>Importante:</strong> Cada viagem reserva 2 vagas gratuitas para beneficiários do ID Jovem. 
                  As vagas são liberadas com até 6h de antecedência da viagem.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function SiteDisponivelItem({ passagem }: { passagem: Passagem }) {
  return (
    <div className="border border-border rounded-md p-3 bg-background/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground leading-tight">{passagem.empresa}</p>
          <p className="text-xs text-muted-foreground mt-1">via {passagem.site}</p>
          <p className="text-xs text-primary mt-1">
            {passagem.vagasIdJovem} vaga{passagem.vagasIdJovem !== 1 ? "s" : ""} ID Jovem
          </p>
        </div>

        <Button asChild variant="outline" size="sm" className="h-8 px-3">
          <a href={passagem.linkCompra} target="_blank" rel="noopener noreferrer" className="gap-2">
            Abrir
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
    </div>
  )
}
