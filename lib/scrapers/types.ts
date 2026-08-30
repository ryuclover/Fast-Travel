export interface ResultItem {
  empresa: string
  horario?: string
  chegada?: string
  duracao?: string
  valor?: string
}

export interface ScraperResult {
  disponivel: boolean
  vagasIdJovem: number
  detalhes: string
  siteUrl: string
  empresa?: string
  resultados: ResultItem[]
}
