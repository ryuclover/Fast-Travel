import { ScraperResult, ResultItem } from "../types";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export async function scrapeClickBus(url: string): Promise<ScraperResult> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    
    // Otimização: bloquear imagens e fontes para carregar mais rápido
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Nós vamos interceptar a resposta da API BFF diretamente da rede!
    let bffData: any = null;
    page.on('response', async response => {
      if (response.url().includes('bff.clickbus.com/web/api/v5/trips')) {
        try {
          bffData = await response.json();
        } catch (e) {}
      }
    });

    // Navegar até o site. timeout de 45s para garantir.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Opcional: Esperar um pouco para a API BFF terminar de ser chamada pelo frontend
    // Checamos a cada 1s, se achar dados, já sai do loop (max 15s)
    for (let i = 0; i < 15; i++) {
      if (bffData && bffData.departures && bffData.departures.length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (browser) await browser.close();

    return parseClickBusBFF(bffData, url);
  } catch (error) {
    if (browser) await browser.close();
    console.error(`Error scraping ClickBus ${url} with Puppeteer:`, error);
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Erro ao consultar ClickBus com Puppeteer",
      siteUrl: url,
      resultados: [],
    };
  }
}

function parseClickBusBFF(bffData: any, url: string): ScraperResult {
  const resultados: ResultItem[] = [];
  let vagasIdJovem = 0;
  let empresa: string | undefined = undefined;

  if (bffData && bffData.departures && Array.isArray(bffData.departures)) {
    for (const trip of bffData.departures) {
      const companyName = trip.company?.name ?? "ClickBus";
      if (!empresa) empresa = companyName;

      resultados.push({
        empresa: companyName,
        horario: trip.departure?.schedule?.time ?? "",
        chegada: trip.arrival?.schedule?.time ?? "",
        duracao: trip.duration?.hours ?? "",
        valor: trip.price != null ? `R$ ${Number(trip.price).toFixed(2).replace(".", ",")}` : undefined,
      });

      // Checa se tem alguma indicação de IdJovem (gratuidade ou tags)
      const tagsStr = JSON.stringify(trip.tags ?? trip.benefits ?? []).toLowerCase();
      if (tagsStr.includes("id jovem") || tagsStr.includes("idjovem") || trip.isLowFare) {
        vagasIdJovem = Math.max(vagasIdJovem, 1);
      }
    }
  }

  const disponivel = resultados.length > 0 || vagasIdJovem > 0;
  const detalhes = disponivel
    ? `${resultados.length} viagem(ns) encontrada(s)`
    : "Nenhuma viagem encontrada para esta data na ClickBus.";

  return {
    disponivel,
    vagasIdJovem,
    detalhes,
    siteUrl: url,
    empresa,
    resultados,
  };
}
