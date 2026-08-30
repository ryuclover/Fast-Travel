const fs = require('fs');

async function test() {
  const res = await fetch('https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-30');
  const text = await res.text();
  const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    const departures = data.props?.pageProps?.pageData?.trips?.departures || [];
    console.log('Departures count for 30th:', departures.length);
    if (departures.length > 0) {
      console.log('Sample keys:', Object.keys(departures[0]));
      console.log('Sample departure date:', departures[0].departure);
      console.log('Sample companyId:', departures[0].companyId);
      
      const travelCompanies = data.props?.pageProps?.pageData?.trips?.travelCompanies || [];
      console.log('Company:', travelCompanies.find(c => c.id === departures[0].companyId)?.name);
      
      console.log('Price:', departures[0].price);
    }
  } else {
    console.log('No next data');
  }
}
test();
