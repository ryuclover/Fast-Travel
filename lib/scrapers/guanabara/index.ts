import { fetchWithRetry } from "../../http-client";
import { ScraperResult, ResultItem } from "../types";

export async function scrapeGuanabara(url: string): Promise<ScraperResult> {
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();

    return parseGuanabaraHtml(html, url);
  } catch (error) {
    console.error(`Error scraping Guanabara ${url}:`, error);
    return {
      disponivel: false,
      vagasIdJovem: 0,
      detalhes: "Erro ao consultar Guanabara via HTTP",
      siteUrl: url,
      resultados: [],
    };
  }
}

function parseGuanabaraHtml(html: string, url: string): ScraperResult {
  const resultados: ResultItem[] = [];
  let vagasIdJovem = 0;
  
  // Como o Guanabara é um SPA Next.js App Router, extrair a lista de viagens 
  // via RSC/HTML estático é complexo. 
  // Usamos um fallback baseado no HTML inicial ou metadados de viagens se disponíveis.

  const texto = html.toLowerCase();
  
  // Buscar no texto renderizado ou RSC payload por indícios de Id Jovem
  const encontrouIdJovem = /id\s*jovem/.test(texto) || url.includes("passengers=13:1");
  const encontrouGratuidade = /gratuidade|vagas gratuitas|passagens gratuitas|beneficio|benefício/.test(texto);
  const encontrouDisponibilidade = /dispon[ií]vel|disponibilidade|vaga(s)? disponível(s)?/.test(texto);
  const temViagens = /"trip"|"price"|"fare"|selecionar poltrona/i.test(texto);
  
  vagasIdJovem = (encontrouIdJovem && temViagens) ? 1 : 0;
  
  if (vagasIdJovem > 0 || encontrouGratuidade || encontrouDisponibilidade || temViagens) {
      resultados.push({
          empresa: "Guanabara",
          horario: "Vários",
          duracao: "Consultar site",
      })
  }

  const disponivel = resultados.length > 0 || vagasIdJovem > 0;
  const detalhes = disponivel
    ? "Resultado encontrado na plataforma Guanabara"
    : "Nenhum resultado claro encontrado";

  return {
    disponivel,
    vagasIdJovem,
    detalhes,
    siteUrl: url,
    empresa: "Guanabara",
    resultados,
  };
}
