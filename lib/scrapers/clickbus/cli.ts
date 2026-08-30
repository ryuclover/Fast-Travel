import { config } from 'dotenv';
import path from 'path';
import { scrapeClickBus } from './index';

// Carrega as variáveis de ambiente do .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
  const targetUrl = 'https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-30';
  
  console.log('Iniciando integração de teste ClickBus...');
  console.log(`URL Alvo: ${targetUrl}\n`);
  
  if (process.env.SCRAPERAPI_KEY) {
      console.log('Chave do ScraperAPI identificada! Usando proxy para bypass de Cloudflare.\n');
  } else {
      console.log('Aviso: Nenhuma chave do ScraperAPI identificada. Utilizando conexão direta (pode ser bloqueado).\n');
  }

  const startTime = Date.now();
  const resultado = await scrapeClickBus(targetUrl);
  const endTime = Date.now();

  console.log(`Tempo de resposta: ${((endTime - startTime) / 1000).toFixed(2)}s\n`);
  
  console.log('--- RESULTADO DO SCRAPER ---');
  console.log(JSON.stringify(resultado, null, 2));
}

runTest();
