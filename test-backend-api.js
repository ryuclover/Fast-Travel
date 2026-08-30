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
      else {
        console.log('Status:', response.status);
        console.log(await response.text());
      }
    } catch (e) {
      console.log('Retry', i+1, e.message);
    }
  }
  throw new Error('Failed to fetch');
}

async function run() {
  const dataUrl = `https://bff.clickbus.com/web/api/v5/trips?from=rio-de-janeiro-rj-todos&to=sao-paulo-sp-todos&departureDate=2026-07-30&clientId=2`;
  
  console.log('Fetching backend data URL:', dataUrl);
  
  try {
    const dataRes = await fetchWithRetry(dataUrl);
    const dataJson = await dataRes.json();
    
    const trips = dataJson?.departures || [];
    console.log(`Found ${trips.length} trips!`);
    
    if (trips.length > 0) {
      console.log('First Trip:', {
         empresa: trips[0].company?.name,
         horario: trips[0].departure?.schedule?.time,
         chegada: trips[0].arrival?.schedule?.time,
         valor: trips[0].price
      });
    }
  } catch(e) {
    console.log('Error fetching backend data:', e);
  }
}

run();
