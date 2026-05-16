"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { MapPin, Calendar, Search, ArrowRight, ExternalLink, Loader2, Info, Ticket, Plus } from "lucide-react"
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
  valor?: string
  vagasIdJovem: number
  vagasIdJovem100?: number
  linkCompra: string
}

interface ResultadoBusca {
  buscadoEm: string
  origem: string
  destino: string
  dataSolicitada: string
  datasConsultadas?: string[]
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
  return `${dia}/${mes}`
}

function formatarDataParaExibicao(dataStr: string) {
  const [ano, mes, dia] = dataStr.split("-")
  return `${dia}/${mes}`
}

function parseDataExibicao(dataStr: string): string | null {
  const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const [, dia, mes] = match
  const diaNum = Number(dia)
  const mesNum = Number(mes)
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null

  const ano = new Date().getFullYear()
  const iso = `${ano}-${String(mesNum).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`
  const dateObj = new Date(`${iso}T00:00:00`)
  if (dateObj.getFullYear() !== ano || dateObj.getMonth() + 1 !== mesNum || dateObj.getDate() !== diaNum) return null

  return iso
}

function formatarSlugParaUrl(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function montarLinkClickbus(origem: string, origemUF: string, destino: string, destinoUF: string, data: string, idJovem: boolean) {
  const origemSlug = formatarSlugParaUrl(origem)
  const destinoSlug = formatarSlugParaUrl(destino)

  const url = new URL(
    `https://www.clickbus.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}-todos/${destinoSlug}-${destinoUF.toLowerCase()}-todos`
  )
  url.searchParams.set("departureDate", data)
  if (idJovem) {
    url.searchParams.set("gratuity", "true")
  }
  return url.toString()
}

function parseValorPassagem(valor?: string): number | null {
  if (!valor) return null
  const numero = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim()

  const parsed = Number(numero)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizarTextoParaComparacao(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function passagemIgnoradaNoIdJovem(passagem: Passagem) {
  const empresaNormalizada = normalizarTextoParaComparacao(passagem.empresa)
  return empresaNormalizada.includes("viaje com expresso ns penha")
}

function filtrarPassagensIdJovem(passagens: Passagem[]) {
  return passagens.filter(
    (passagem) =>
      (passagem.vagasIdJovem === 1 || passagem.vagasIdJovem === 2) &&
      !passagemIgnoradaNoIdJovem(passagem)
  )
}

function agruparPorData(passagens: Passagem[], ordenarPorValor: boolean): BlocoData[] {
  const agrupado = new Map<string, Passagem[]>()

  for (const passagem of passagens) {
    const lista = agrupado.get(passagem.data) ?? []
    lista.push(passagem)
    agrupado.set(passagem.data, lista)
  }

  return Array.from(agrupado.entries())
    .sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
    .map(([data, lista]) => {
      const passagensOrdenadas = ordenarPorValor
        ? lista.slice().sort((a, b) => {
            const valorA = parseValorPassagem(a.valor)
            const valorB = parseValorPassagem(b.valor)

            if (valorA === null && valorB === null) {
              return a.site.localeCompare(b.site)
            }
            if (valorA === null) return 1
            if (valorB === null) return -1
            return valorA - valorB
          })
        : lista.slice().sort((a, b) => a.site.localeCompare(b.site))

      return {
        data,
        passagens: passagensOrdenadas,
      }
    })
}

export default function Home() {
  const [origemSelecionada, setOrigemSelecionada] = useState("")
  const [destinoSelecionado, setDestinoSelecionado] = useState("")
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().split("T")[0])
  const [dataInicioDisplay, setDataInicioDisplay] = useState(() => formatarDataParaExibicao(new Date().toISOString().split("T")[0]))
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0])
  const [dataFimDisplay, setDataFimDisplay] = useState(() => formatarDataParaExibicao(new Date().toISOString().split("T")[0]))
  const [idJovem, setIdJovem] = useState(false)
  const [ordenarPorValor, setOrdenarPorValor] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [erro, setErro] = useState("")
  const [diasAdicionais, setDiasAdicionais] = useState(0)
  const dataInicioHiddenRef = useRef<HTMLInputElement>(null)
  const dataFimHiddenRef = useRef<HTMLInputElement>(null)

  const abrirCalendario = (tipo: "inicio" | "fim") => {
    const dateInput = tipo === "inicio" ? dataInicioHiddenRef.current : dataFimHiddenRef.current
    if (!dateInput) return

    try {
      dateInput.showPicker?.()
    } catch {
      dateInput.focus()
    }
  }

  const handleDataInicioDisplayChange = (event: ChangeEvent<HTMLInputElement>) => {
    const novoValor = event.target.value
    setDataInicioDisplay(novoValor)

    const iso = parseDataExibicao(novoValor)
    if (iso) {
      setDataInicio(iso)
    }
  }

  const handleDataFimDisplayChange = (event: ChangeEvent<HTMLInputElement>) => {
    const novoValor = event.target.value
    setDataFimDisplay(novoValor)

    const iso = parseDataExibicao(novoValor)
    if (iso) {
      setDataFim(iso)
    }
  }

  const blocosDatas = resultado
    ? agruparPorData([...resultado.passagensNaData, ...resultado.passagensProximas], ordenarPorValor)
    : []

  const directLinks = origemSelecionada && destinoSelecionado && dataInicio && dataFim
    ? (() => {
        const inicio = new Date(`${dataInicio}T00:00:00`)
        const fim = new Date(`${dataFim}T00:00:00`)
        const dias = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000) + 1)
        if (dias <= 0) return []

        return Array.from({ length: dias }, (_, indice) => {
          const [origem, origemUF] = origemSelecionada.split("::")
          const [destino, destinoUF] = destinoSelecionado.split("::")
          const dataConsulta = new Date(`${dataInicio}T00:00:00`)
          dataConsulta.setDate(dataConsulta.getDate() + indice)
          const dataIso = dataConsulta.toISOString().split("T")[0]

          return {
            data: formatarDataParaExibicao(dataIso),
            url: montarLinkClickbus(origem, origemUF, destino, destinoUF, dataIso, idJovem),
          }
        })
      })()
    : []

  const handleBuscar = async () => {
    if (!origemSelecionada || !destinoSelecionado || !dataInicio || !dataFim) {
      setErro("Selecione origem, destino, data inicial e data final para buscar")
      return
    }

    const dataInicioObj = new Date(`${dataInicio}T00:00:00`)
    const dataFimObj = new Date(`${dataFim}T00:00:00`)
    if (dataInicioObj > dataFimObj) {
      setErro("A data final deve ser igual ou posterior à data inicial")
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
        dataInicio,
        dataFim,
        origemUF,
        destinoUF,
        idJovem: idJovem ? "true" : "false",
      })

      const response = await fetch(`/api/buscar?${params}`)
      const dados = (await response.json()) as ResultadoBusca

      if (!response.ok) {
        throw new Error((dados as any).error || "Erro ao buscar passagens")
      }

      const resultadoParaExibir = idJovem
        ? {
            ...dados,
            passagensNaData: filtrarPassagensIdJovem(dados.passagensNaData ?? []),
            passagensProximas: filtrarPassagensIdJovem(dados.passagensProximas ?? []),
          }
        : dados

      if (idJovem) {
        resultadoParaExibir.totalEncontrado =
          resultadoParaExibir.passagensNaData.length + resultadoParaExibir.passagensProximas.length
      }

      setResultado(resultadoParaExibir)
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
                <span className="text-sm text-primary font-medium">Busca de passagens de ônibus</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                Encontre as melhores
                <span className="text-primary"> passagens</span> de ônibus
              </h1>
              
              <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
                Compare resultados em vários sites de viagem e escolha entre buscas gerais ou apenas ID Jovem.
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

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm text-muted-foreground">Filtro de busca</label>
                      <div className="relative">
                        <select
                          value={idJovem ? "id_jovem" : "geral"}
                          onChange={(e) => setIdJovem(e.target.value === "id_jovem")}
                          className="w-full h-10 rounded-md border border-border bg-secondary pl-3 pr-3 text-sm"
                        >
                          <option value="geral">Buscar todas as passagens</option>
                          <option value="id_jovem">Buscar apenas ID Jovem</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Data de início</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="text"
                            value={dataInicioDisplay}
                            onChange={handleDataInicioDisplayChange}
                            placeholder="dd/mm"
                            inputMode="numeric"
                            className="pr-10 pl-10 bg-secondary border-border"
                          />
                          <button
                            type="button"
                            onClick={() => abrirCalendario("inicio")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Abrir calendário de início"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <Input
                            ref={dataInicioHiddenRef}
                            type="date"
                            value={dataInicio}
                            onChange={(e) => {
                              setDataInicio(e.target.value)
                              setDataInicioDisplay(formatarDataParaExibicao(e.target.value))
                            }}
                            min={new Date().toISOString().split("T")[0]}
                            className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
                            aria-hidden="true"
                            tabIndex={-1}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Data final</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="text"
                            value={dataFimDisplay}
                            onChange={handleDataFimDisplayChange}
                            placeholder="dd/mm"
                            inputMode="numeric"
                            className="pr-10 pl-10 bg-secondary border-border"
                          />
                          <button
                            type="button"
                            onClick={() => abrirCalendario("fim")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Abrir calendário final"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <Input
                            ref={dataFimHiddenRef}
                            type="date"
                            value={dataFim}
                            onChange={(e) => {
                              setDataFim(e.target.value)
                              setDataFimDisplay(formatarDataParaExibicao(e.target.value))
                            }}
                            min={new Date().toISOString().split("T")[0]}
                            className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
                            aria-hidden="true"
                            tabIndex={-1}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Botão Buscar */}
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 w-full md:w-auto">
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
                          {carregando ? "Buscando passagens..." : "Buscar passagens"}
                        </Button>
                        </div>
                      <div className="text-sm w-full md:w-auto text-right">
                        {directLinks.length > 0 ? (
                          directLinks.length === 1 ? (
                            <a
                              href={directLinks[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Abrir diretamente {directLinks[0].data}
                            </a>
                          ) : (
                            <div className="space-y-1 text-right">
                              <p className="text-muted-foreground">Abrir diretamente para as datas:</p>
                              <div className="flex flex-wrap justify-end gap-2">
                                {directLinks.map((link) => (
                                  <a
                                    key={link.data}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {link.data}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground">
                            Selecione origem e destino para abrir diretamente.
                          </span>
                        )}
                      </div>
                      {carregando && (
                        <p className="text-sm text-muted-foreground">
                          Buscando passagens, aguardando enquanto consultamos os sites um de cada vez.
                        </p>
                      )}
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                      {resultado.origem} <ArrowRight className="w-4 h-4 text-primary" /> {resultado.destino}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <label htmlFor="ordenar-valor" className="font-medium">Ordenar por</label>
                      <select
                        id="ordenar-valor"
                        value={ordenarPorValor ? "valor" : "padrao"}
                        onChange={(e) => setOrdenarPorValor(e.target.value === "valor")}
                        className="h-9 rounded-md border border-border bg-secondary px-2 text-sm"
                      >
                        <option value="padrao">Padrão</option>
                        <option value="valor">Valor mais barato</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-sm text-muted-foreground">
                      {resultado.totalEncontrado} opção{resultado.totalEncontrado !== 1 ? "s" : ""} de ID Jovem 100%{resultado.totalEncontrado !== 1 ? "s" : ""}
                    </span>
                    {resultado.datasConsultadas && resultado.datasConsultadas.length > 1 && (
                      <p className="text-sm text-muted-foreground">
                        Buscado para: {resultado.datasConsultadas.join(", ")}
                      </p>
                    )}
                  </div>
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
            <h2 className="text-2xl font-bold mb-8 text-center">Como funciona</h2>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Selecione sua viagem</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha origem, destino e data para encontrar passagens de ônibus.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Defina o filtro</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha entre buscar todas as passagens ou apenas as opções ID Jovem.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Veja os resultados</h3>
                <p className="text-sm text-muted-foreground">
                  Compare as opções encontradas e acesse o site oficial para reservar.
                </p>
              </div>
            </div>

            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-center">
                  <strong>Importante:</strong> Todas as informações são consultadas em fontes públicas de sites de transporte.
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
  const vagas = passagem.vagasIdJovem === 1 || passagem.vagasIdJovem === 2 ? passagem.vagasIdJovem : passagem.vagasIdJovem100 ?? passagem.vagasIdJovem

  return (
    <div className="border border-primary/40 rounded-md p-3 bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground leading-tight">{passagem.empresa}</p>
          <p className="text-xs text-muted-foreground mt-1">via {passagem.site}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-muted-foreground">Horário: {passagem.partida}</p>
            {passagem.valor && <p className="text-muted-foreground">Valor: {passagem.valor}</p>}
            {passagem.chegada !== "N/A" && passagem.chegada && (
              <p className="text-muted-foreground">Chegada: {passagem.chegada}</p>
            )}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-success text-sm font-semibold">
            <span>ID Jovem 100%</span>
            <span className="rounded-full bg-success/20 px-2 py-0.5">
              {vagas} vaga{vagas !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="h-8 px-3">
          <a href={passagem.linkCompra} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
            Abrir
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
    </div>
  )
}
