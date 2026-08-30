import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

config({ path: path.resolve(process.cwd(), '.env.local') });

const SCRAPER_KEY = process.env.SCRAPERAPI_KEY;

async function main() {
  if (!SCRAPER_KEY) {
    console.error('SCRAPERAPI_KEY não definida');
    process.exit(1);
  }

  const targetUrl = 'https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-30';
  const fetchUrl = `http://api.scraperapi.com?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(targetUrl)}&render=true`;

  console.log('Baixando HTML renderizado do ScraperAPI...');
  const res = await fetch(fetchUrl);
  const html = await res.text();

  console.log(`HTML recebido: ${html.length} bytes`);
  fs.writeFileSync('clickbus-rendered.html', html);
  console.log('Salvo em clickbus-rendered.html\n');

  const texto = html.toLowerCase();

  // 1. Tentar __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    const data = JSON.parse(nextDataMatch[1]);
    const departures = data?.props?.pageProps?.pageData?.trips?.departures ?? [];
    const travelCompanies: {id: string, name: string}[] = data?.props?.pageProps?.pageData?.trips?.travelCompanies ?? [];
    console.log(`__NEXT_DATA__ departures: ${departures.length}`);
    if (departures.length > 0) {
      console.log('Amostra departure:', JSON.stringify(departures[0], null, 2));
    }
    console.log('Travel companies:', travelCompanies.map((c: {id: string, name: string}) => c.name));
  }

  // 2. Procurar por padrões JSON de viagem no HTML completo renderizado
  const jsonBlocks = html.match(/\{"departure":"[^"]+","arrival":"[^"]+"/g);
  console.log(`\nJSON blocks com departure/arrival no HTML: ${jsonBlocks?.length ?? 0}`);
  if (jsonBlocks) console.log('Exemplos:', jsonBlocks.slice(0, 3));

  // 3. Olhar preços no texto
  const precos = html.match(/R\$\s*[\d,.]+/g);
  console.log(`\nPreços encontrados no HTML: ${precos?.length ?? 0}`);
  if (precos) console.log('Primeiros preços:', [...new Set(precos)].slice(0, 5));

  // 4. Verificar se há rotas buscadas
  console.log('\nHas "departureDate":', texto.includes('departuredate'));
  console.log('Has "1001 viagens":', texto.includes('1001'));
  console.log('Has "cometa":', texto.includes('cometa'));
  console.log('Has "passagem":', texto.includes('passagem'));
  console.log('Has "horario" / "hora":', texto.includes('horário') || texto.includes('horario'));
}

main().catch(console.error);
