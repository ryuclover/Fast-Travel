const fs = require('fs');

const html = fs.readFileSync('clickbus.html', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  if (data.props?.pageProps?.pageData?.trips?.departures) {
     const departures = data.props.pageProps.pageData.trips.departures;
     console.log('Departures count:', departures.length);
     if (departures.length > 0) {
        console.log('Sample departure keys:', Object.keys(departures[0]));
        console.log('Sample departure company:', departures[0].companyId);
        console.log('Sample departure price:', departures[0].price);
        console.log('Sample departure classes:', departures[0].busClass);
        console.log('Sample departure tags:', departures[0].tags);
     }
  }
}
