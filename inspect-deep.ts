import fs from 'fs';

const html = fs.readFileSync('clickbus-rendered.html', 'utf8');

// 1. Achar onde "1001" está no HTML e capturar o contexto
const idx = html.indexOf('1001');
if (idx > -1) {
  console.log('=== CONTEXTO "1001" ===');
  console.log(html.substring(Math.max(0, idx - 200), idx + 400));
}

// 2. Procurar padrões de horário (HH:MM)
const horarios = html.match(/\b\d{2}:\d{2}\b/g);
console.log(`\n=== HORÁRIOS (HH:MM) encontrados: ${horarios?.length} ===`);
if (horarios) console.log([...new Set(horarios)].slice(0, 20));

// 3. Tentar achar trip data em JSON inline (React hydration state)
// Procurar por padrões como {"from":..., "to":...} ou {"price":...,"company":...}
const tripPatterns = html.match(/\{"price":\d+[\s\S]{0,200}\}/g);
console.log(`\n=== JSON blocks com "price" field: ${tripPatterns?.length ?? 0} ===`);
if (tripPatterns) console.log('Amostras:', tripPatterns.slice(0, 2));

// 4. Procurar __NEXT_DATA__ completo e mostrar travelCompanies
const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (nextDataMatch) {
  const data = JSON.parse(nextDataMatch[1]);
  const companies = data?.props?.pageProps?.pageData?.trips?.travelCompanies ?? [];
  console.log(`\n=== travelCompanies (${companies.length}) ===`);
  if (companies.length) console.log('Primeiro:', JSON.stringify(companies[0], null, 2));

  // Mostrar todas as keys do trips object
  const trips = data?.props?.pageProps?.pageData?.trips;
  if (trips) {
    console.log('\n=== keys do trips ===', Object.keys(trips));
    // Mostrar o origin e destination
    console.log('origin:', trips.origin);
    console.log('destination:', trips.destination);
  }
}

// 5. Procurar script tags com estado do React (self.__next_f, window.__REDUX_STATE__, etc)
const scriptTags = html.match(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g);
console.log(`\n=== React Flight Data (self.__next_f) pushes: ${scriptTags?.length ?? 0} ===`);
if (scriptTags) {
  for (const tag of scriptTags.slice(0, 5)) {
    if (tag.includes('departure') || tag.includes('price') || tag.includes('1001')) {
      console.log('Relevante:', tag.substring(0, 300));
    }
  }
}

// 6. Procurar JSON window.__STORE__ ou similar
const windowVars = html.match(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]*?\});/g);
console.log(`\n=== window.__VAR__ assignments: ${windowVars?.length ?? 0} ===`);
if (windowVars) windowVars.forEach(v => console.log(v.substring(0, 150)));
