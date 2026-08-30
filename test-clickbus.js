const fs = require('fs');

async function test() {
  const res = await fetch('https://www.clickbus.com.br/onibus/rio-de-janeiro-rj-todos/sao-paulo-sp-todos?departureDate=2026-07-25');
  const text = await res.text();
  console.log('Length:', text.length);
  console.log('Has __NEXT_DATA__:', text.includes('__NEXT_DATA__'));
  fs.writeFileSync('clickbus.html', text);
  console.log('Saved to clickbus.html');
}

test();
