import type { Browser, Page } from "puppeteer"

export interface ScraperResult {
  site: string
  origem: string
  destino: string
  data: string
  disponibilidade: boolean
  vagasIdJovem?: number
  detalhes?: string
  link?: string
}

export interface ScraperConfig {
  site: string
  url: string
}

export async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer")
  return puppeteer.launch({ headless: true })
}

export async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  return page
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close()
}

export async function scrapeSite(
  page: Page,
  config: ScraperConfig,
  origem: string,
  destino: string,
  data: string,
): Promise<ScraperResult> {
  await page.goto(config.url, { waitUntil: "networkidle2", timeout: 60000 })

  // Aqui você pode adicionar a lógica específica de cada site para extrair informações.
  // Exemplo:
  // const texto = await page.evaluate(() => document.body.innerText)
  // const vagasIdJovem = ...

  return {
    site: config.site,
    origem,
    destino,
    data,
    disponibilidade: false,
  }
}
