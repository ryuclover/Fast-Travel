export interface ResultItem {
  empresa: string
  horario?: string
  chegada?: string
  duracao?: string
  valor?: string
  valorNumerico?: number
  classe?: string
  tipoGratuidade?: "id_jovem_100" | "id_jovem_50" | "nenhuma"
  vagasIdJovem?: number
  poltronasLivres?: number
  origem?: string
  destino?: string
  data?: string
  linkCompra?: string
}

export interface ScraperResult {
  disponivel: boolean
  vagasIdJovem: number
  detalhes: string
  siteUrl: string
  empresa?: string
  provedor: string
  dataConsultada?: string
  resultados: ResultItem[]
  error?: string
}

export interface ResumoDia {
  data: string
  menorValor?: number
  temIdJovem100: boolean
  temIdJovem50: boolean
  totalViagens: number
  empresaMenorValor?: string
  horarioMenorValor?: string
}

export interface ResultadoComparacaoIntervalo {
  origem: string
  destino: string
  dataInicio: string
  dataFim: string
  idJovemApenas: boolean
  melhorDataPeriodo?: string
  menorPrecoPeriodo?: number
  empresaCampeaoPeriodo?: string
  resumoPorDia: ResumoDia[]
  todasViagens: ResultItem[]
  totalViagensEncontradas: number
}
