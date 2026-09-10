import { scrapeClickBus } from "../scrapers/clickbus"
import { scrapeGontijo } from "../scrapers/gontijo"
import { scrapeGuanabara } from "../scrapers/guanabara"
import { scrapeBuser } from "../scrapers/buser"
import { scrapeEmbarca } from "../scrapers/embarca"
import { scrapeAguiaBranca } from "../scrapers/aguiabranca"
import type { ScraperResult } from "../scrapers/types"

export type ProvedorId = "ClickBus" | "Gontijo" | "Guanabara" | "Buser" | "Embarca" | "AguiaBranca"

export interface ContextoProvedor {
  origem: string
  origemUF: string
  destino: string
  destinoUF: string
  dataIso: string
  idJovem: boolean
}

interface AdaptadorProvedor {
  id: ProvedorId
  suportaIdJovem: boolean
  consultar: (contexto: ContextoProvedor) => Promise<ScraperResult>
}

export const adaptadoresProvedores: Record<ProvedorId, AdaptadorProvedor> = {
  ClickBus: {
    id: "ClickBus",
    suportaIdJovem: true,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeClickBus(origem, destino, dataIso, origemUF, destinoUF, idJovem),
  },
  Guanabara: {
    id: "Guanabara",
    suportaIdJovem: true,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeGuanabara(origem, destino, dataIso, origemUF, destinoUF, idJovem),
  },
  Buser: {
    id: "Buser",
    suportaIdJovem: false,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeBuser(origem, origemUF, destino, destinoUF, dataIso, idJovem),
  },
  Gontijo: {
    id: "Gontijo",
    suportaIdJovem: true,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeGontijo(origem, origemUF, destino, destinoUF, dataIso, idJovem),
  },
  Embarca: {
    id: "Embarca",
    suportaIdJovem: true,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeEmbarca(origem, origemUF, destino, destinoUF, dataIso, idJovem),
  },
  AguiaBranca: {
    id: "AguiaBranca",
    suportaIdJovem: true,
    consultar: ({ origem, origemUF, destino, destinoUF, dataIso, idJovem }) =>
      scrapeAguiaBranca(origem, origemUF, destino, destinoUF, dataIso, idJovem),
  },
}

export function obterAdaptadores(provedores?: ProvedorId[], idJovem = false): AdaptadorProvedor[] {
  const ids = provedores || Object.keys(adaptadoresProvedores) as ProvedorId[]
  return ids
    .map((id) => adaptadoresProvedores[id])
    .filter((adaptador) => adaptador && (!idJovem || adaptador.suportaIdJovem))
}
