const fs = require('fs');

const html = fs.readFileSync('clickbus.html', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  if (data.props?.pageProps?.pageData?.trips) {
     console.log('pageData.trips structure:', Object.keys(data.props.pageProps.pageData.trips));
     const travelCompanies = data.props.pageProps.pageData.trips.travelCompanies || [];
     console.log('Travel companies:', travelCompanies.length);
     
     // Is there an array of actual trips?
     const otherKeys = Object.keys(data.props.pageProps.pageData).filter(k => k !== 'trips');
     console.log('Other pageData keys:', otherKeys);
  }
}
