import { config } from 'dotenv';
import path from 'path';
import { scrapeGuanabara } from './index';

// Carrega as variáveis de ambiente do .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
  const targetUrl = 'https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-07-30&passengers=1';
  
  console.log('Iniciando integração de teste Guanabara...');
  console.log(`URL Alvo: ${targetUrl}\n`);
  
  const startTime = Date.now();
  const resultado = await scrapeGuanabara(targetUrl);
  const endTime = Date.now();

  console.log(`Tempo de resposta: ${((endTime - startTime) / 1000).toFixed(2)}s\n`);
  
  console.log('--- RESULTADO DO SCRAPER ---');
  console.log(JSON.stringify(resultado, null, 2));
}

runTest();
