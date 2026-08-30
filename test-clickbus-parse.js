const fs = require('fs');

const html = fs.readFileSync('clickbus.html', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  console.log('Props:', Object.keys(data.props || {}));
  console.log('PageProps:', Object.keys(data.props?.pageProps || {}));
  
  if (data.props?.pageProps?.initialState) {
    console.log('InitialState:', Object.keys(data.props.pageProps.initialState));
    if (data.props.pageProps.initialState.search) {
       console.log('Search:', Object.keys(data.props.pageProps.initialState.search));
       console.log('Trips count:', data.props.pageProps.initialState.search.trips?.length);
    }
  } else {
    console.log('No initialState found. Let us search for the word "trips" or something similar in the JSON structure.');
    
    // Quick and dirty deep search for trips
    let found = false;
    function searchTrips(obj, path = '') {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        if (path.includes('trip') && obj.length > 0) {
           console.log('Found array at', path, 'with length', obj.length);
           if(obj[0] && obj[0].company) console.log('Sample:', obj[0].company);
           found = true;
        }
        obj.forEach((item, i) => searchTrips(item, `${path}[${i}]`));
      } else {
        Object.keys(obj).forEach(key => {
          if (key === 'trips' || key === 'items') {
             console.log('Found key', key, 'at', path, 'is array?', Array.isArray(obj[key]), 'length:', obj[key]?.length);
          }
          searchTrips(obj[key], `${path}.${key}`);
        });
      }
    }
    searchTrips(data);
  }
} else {
  console.log('No __NEXT_DATA__ match');
}
