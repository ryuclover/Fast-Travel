export function formatarDataBloco(dataStr: string): string {
  if (!dataStr) return ""
  const partes = dataStr.split("-")
  if (partes.length === 3) {
    const [, mes, dia] = partes
    return `${dia}/${mes}`
  }
  return dataStr
}

export function formatarDataParaExibicao(dataStr: string): string {
  return formatarDataBloco(dataStr)
}

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const DIAS_SEMANA_COMPLETOS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
]
const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

export function obterDiaDaSemana(dataStr: string): string {
  if (!dataStr) return ""
  const [ano, mes, dia] = dataStr.split("-").map(Number)
  if (!ano || !mes || !dia) return ""
  const dateObj = new Date(ano, mes - 1, dia)
  return DIAS_SEMANA_ABREV[dateObj.getDay()] || ""
}

export function obterDiaDaSemanaCompleto(dataStr: string): string {
  if (!dataStr) return ""
  const [ano, mes, dia] = dataStr.split("-").map(Number)
  if (!ano || !mes || !dia) return ""
  const dateObj = new Date(ano, mes - 1, dia)
  return DIAS_SEMANA_COMPLETOS[dateObj.getDay()] || ""
}

export function formatarDataCompleta(dataStr: string): string {
  if (!dataStr) return ""
  const [ano, mes, dia] = dataStr.split("-").map(Number)
  if (!ano || !mes || !dia) return ""
  const mesNome = MESES_NOMES[mes - 1] || ""
  return `${dia} de ${mesNome}`
}

export function obterDataHojeLocal(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function formatarDataIsoLocal(date: Date): string {
  const ano = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, "0")
  const dia = String(date.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function parseDataExibicao(dataStr: string): string | null {
  if (!dataStr) return null

  // Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    return dataStr
  }

  // Formato completo: DD/MM/YYYY
  const matchCompleto = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchCompleto) {
    const [, dia, mes, anoStr] = matchCompleto
    const diaNum = Number(dia)
    const mesNum = Number(mes)
    const anoNum = Number(anoStr)
    if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null
    return `${anoNum}-${String(mesNum).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`
  }

  // Formato curto: DD/MM (assume por padrão o ano atual da máquina do usuário)
  const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const [, dia, mes] = match
  const diaNum = Number(dia)
  const mesNum = Number(mes)
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null

  const ano = new Date().getFullYear()
  const iso = `${ano}-${String(mesNum).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`
  const dateObj = new Date(`${iso}T00:00:00`)
  if (dateObj.getFullYear() !== ano || dateObj.getMonth() + 1 !== mesNum || dateObj.getDate() !== diaNum) {
    return null
  }

  return iso
}

export function formatarMoeda(valor?: number | null): string {
  if (valor === undefined || valor === null || isNaN(valor)) return "--"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)
}

export function parseValorPassagem(valor?: string): number | null {
  if (!valor) return null
  const numero = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim()

  const parsed = Number(numero)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function formatarSlugParaUrl(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function montarLinkClickbus(
  origem: string,
  origemUF: string,
  destino: string,
  destinoUF: string,
  data: string,
  idJovem: boolean
): string {
  const origemSlug = formatarSlugParaUrl(origem)
  const destinoSlug = formatarSlugParaUrl(destino)

  const url = new URL(
    `https://www.clickbus.com.br/onibus/${origemSlug}-${origemUF.toLowerCase()}/${destinoSlug}-${destinoUF.toLowerCase()}`
  )
  url.searchParams.set("departureDate", data)
  if (idJovem) {
    url.searchParams.set("gratuity", "true")
  }
  return url.toString()
}

export function extrairTurno(horario?: string): "manha" | "tarde" | "noite" {
  if (!horario || horario === "N/A") return "manha"
  const horaMatch = horario.match(/^(\d{1,2}):?(\d{2})?/)
  if (!horaMatch) return "manha"

  const hora = parseInt(horaMatch[1], 10)
  if (hora >= 6 && hora < 12) return "manha"
  if (hora >= 12 && hora < 18) return "tarde"
  return "noite"
}

export function parseMinutosDuracao(duracao?: string): number {
  if (!duracao) return 999999
  // Exemplos: "6h 30m", "06:30", "5h", "45m"
  const horaMatch = duracao.match(/(\d+)\s*h/i)
  const minMatch = duracao.match(/(\d+)\s*m/i)
  
  if (horaMatch || minMatch) {
    const horas = horaMatch ? parseInt(horaMatch[1], 10) : 0
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0
    return horas * 60 + mins
  }

  const splitMatch = duracao.match(/(\d{1,2}):(\d{2})/)
  if (splitMatch) {
    return parseInt(splitMatch[1], 10) * 60 + parseInt(splitMatch[2], 10)
  }

  return 999999
}

export function parseMinutosHorario(horario?: string): number {
  if (!horario || horario === "N/A") return 999999
  const match = horario.match(/(\d{1,2}):(\d{2})/)
  if (!match) return 999999
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

export function passagemIgnoradaNoIdJovem(empresa: string): boolean {
  const norm = normalizarTexto(empresa)
  return norm.includes("viaje com expresso ns penha")
}

export function filtrarPassagensIdJovem<T extends { empresa: string; vagasIdJovem: number; vagasIdJovem100?: number }>(
  passagens: T[]
): T[] {
  return passagens.filter(
    (p) =>
      ((p.vagasIdJovem100 && p.vagasIdJovem100 > 0) || p.vagasIdJovem === 1 || p.vagasIdJovem === 2) &&
      !passagemIgnoradaNoIdJovem(p.empresa)
  )
}

