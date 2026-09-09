import { ScraperResult } from "../types"
import { getClickBusSession, ClickBusSession } from "./client"

export async function scrapeClickBus(
  origemOuUrl: string,
  destino = "",
  data = "",
  origemUF = "RJ",
  destinoUF = "SP",
  idJovem = false
): Promise<ScraperResult> {
  const session = await getClickBusSession()

  if (origemOuUrl.startsWith("http")) {
    try {
      const urlObj = new URL(origemOuUrl)
      const pathname = urlObj.pathname
      const parts = pathname.split("/").filter(Boolean)
      const fromSlug = parts[1] || ""
      const toSlug = parts[2] || ""
      const dataParam = urlObj.searchParams.get("departureDate") || ""
      const idJovemParam = urlObj.searchParams.get("gratuity") === "true"

      const cleanFrom = fromSlug.replace(/-[a-z]{2}-todos$/, "").replace(/-/g, " ")
      const cleanTo = toSlug.replace(/-[a-z]{2}-todos$/, "").replace(/-/g, " ")
      const ufFrom = fromSlug.match(/-([a-z]{2})-todos$/)?.[1]?.toUpperCase() || "RJ"
      const ufTo = toSlug.match(/-([a-z]{2})-todos$/)?.[1]?.toUpperCase() || "SP"

      return session.buscarData(cleanFrom, ufFrom, cleanTo, ufTo, dataParam, idJovemParam)
    } catch (e) {
      console.warn("[ClickBus] Erro ao parsear URL pronta:", e)
    }
  }

  return session.buscarData(origemOuUrl, origemUF, destino, destinoUF, data, idJovem)
}

export { ClickBusSession, getClickBusSession }
