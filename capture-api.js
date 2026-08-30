import puppeteer from 'puppeteer';

async function main() {
  console.log('Iniciando Puppeteer para capturar a chamada de API da ClickBus...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  // Habilitar a interceptação de rede
  await page.setRequestInterception(true);

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'];
    if (contentType && contentType.includes('application/json') && !url.includes('google') && !url.includes('doubleclick')) {
      console.log('\n=========================================');
      console.log(`API URL: ${url}`);
      console.log(`STATUS: ${response.status()}`);
      try {
        const text = await response.text();
        if (text.includes('departure') || text.includes('price')) {
          console.log('--- ENCONTROU DADOS DE PASSAGEM! ---');
          console.log(text.substring(0, 500));
        }
      } catch(e) {}
    }
  });

  page.on('request', request => {
    const url = request.url();
    if (url.includes('bff.clickbus.com')) {
      console.log('\n=== BFF REQUEST HEADERS ===');
      console.log(JSON.stringify(request.headers(), null, 2));
    }
    request.continue();
  });

  const targetUrl = 'https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-30';
  console.log(`Navegando para: ${targetUrl}`);
  
  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.log('Erro ou timeout ao carregar:', e.message);
  }

  console.log('Aguardando 5 segundos para garantir que a API foi chamada...');
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
}

main().catch(console.error);
