import fs from 'fs';

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const scraperApiKey = process.env.SCRAPERAPI_KEY || 'c3f583684a32841b994d385638271ac5';
      const params = new URLSearchParams({
        api_key: scraperApiKey,
        url: url,
        country_code: "br"
      });
      const fetchUrl = `http://api.scraperapi.com?${params.toString()}`;
      
      const response = await fetch(fetchUrl, options);
      if (response.ok) return response;
    } catch (e) {
      console.log('Retry', i+1);
    }
  }
  throw new Error('Failed to fetch');
}

async function run() {
  const url = 'https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-30';
  console.log('Fetching main page...');
  const res = await fetchWithRetry(url);
  const html = await res.text();
  
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    console.log('No NEXT_DATA found');
    return;
  }
  
  const nextData = JSON.parse(match[1]);
  const buildId = nextData.buildId;
  console.log('Build ID:', buildId);
  
  const dataUrl = `https://www.clickbus.com.br/_next/data/${buildId}/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos.json?origin=rio-de-janeiro-rj-todos&destination=sao-paulo-sp-todos&device=desktop&departureDate=2026-07-30`;
  
  console.log('Fetching data URL:', dataUrl);
  const dataRes = await fetchWithRetry(dataUrl);
  const dataJson = await dataRes.json();
  
  const trips = dataJson?.pageProps?.pageData?.trips?.departures || [];
  console.log(`Found ${trips.length} trips!`);
  
  if (trips.length > 0) {
    console.log(trips[0]);
  }
}

run();
