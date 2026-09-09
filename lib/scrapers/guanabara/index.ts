import { ScraperResult } from "../types"
import { fetchGuanabaraDirect } from "./client"

export async function scrapeGuanabara(
  origemOuUrl: string,
  destino = "",
  data = "",
  origemUF = "RJ",
  destinoUF = "SP",
  idJovem = false
): Promise<ScraperResult> {
  if (origemOuUrl.startsWith("http")) {
    try {
      const urlObj = new URL(origemOuUrl)
      const parts = urlObj.pathname.split("/").filter(Boolean)
      const fromSlug = parts[1] || ""
      const toSlug = parts[2] || ""
      const dataParam = urlObj.searchParams.get("departure_date") || ""
      const idJovemParam = urlObj.searchParams.get("passengers") === "13:1"

      const cleanFrom = fromSlug.replace(/-[a-z]{2}-todos$/, "").replace(/_/g, " ")
      const cleanTo = toSlug.replace(/-[a-z]{2}-todos$/, "").replace(/_/g, " ")
      const ufFrom = fromSlug.match(/-([a-z]{2})-todos$/)?.[1]?.toUpperCase() || "RJ"
      const ufTo = toSlug.match(/-([a-z]{2})-todos$/)?.[1]?.toUpperCase() || "SP"

      return fetchGuanabaraDirect(cleanFrom, ufFrom, cleanTo, ufTo, dataParam, idJovemParam)
    } catch (e) {
      console.warn("[Guanabara] Erro ao fazer parse de URL:", e)
    }
  }

  return fetchGuanabaraDirect(origemOuUrl, origemUF, destino, destinoUF, data, idJovem)
}

export { fetchGuanabaraDirect }
export * from "./client"
