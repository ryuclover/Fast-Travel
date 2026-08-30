import fs from 'fs';

const html = fs.readFileSync('clickbus-rendered.html', 'utf8');

// Os horarios encontrados (12:12, 06:00 etc) estão no HTML renderizado
// Vamos encontrar o contexto de cada um para ver se são de viagens
const horarioRegex = /\b(\d{2}:\d{2})\b/g;
let match;
const found: string[] = [];

while ((match = horarioRegex.exec(html)) !== null) {
  const start = Math.max(0, match.index - 300);
  const end = Math.min(html.length, match.index + 300);
  const context = html.substring(start, end);
  // Só nos interessa se o contexto contiver algo como empresa, passagem, etc
  if (context.toLowerCase().includes('empresa') || 
      context.includes('BRL') || 
      context.includes('"departure"') ||
      context.includes('"company"') ||
      context.includes('passagem') ||
      context.toLowerCase().includes('viagem') ||
      context.toLowerCase().includes('ônibus')) {
    found.push(`\n[HORÁRIO: ${match[1]}]\n${context}`);
  }
}

console.log(`Horários com contexto relevante: ${found.length}`);
found.forEach(f => console.log(f.substring(0, 500) + '\n---'));

// Também buscar todas as tags <time> ou data-departure no HTML
const timeTags = html.match(/<time[^>]*>[\s\S]*?<\/time>/g);
console.log(`\n<time> tags: ${timeTags?.length ?? 0}`);
if (timeTags) timeTags.slice(0, 5).forEach(t => console.log(t));

// Buscar data-testid relacionados a passagens
const testIds = html.match(/data-testid="[^"]*trip[^"]*"/gi);
console.log(`\ndata-testid com "trip": ${testIds?.length ?? 0}`);
if (testIds) console.log(testIds.slice(0, 10));

// Buscar a string "Viação" ou nomes de empresas de ônibus
const empresas = html.match(/(Expresso|Viação|Via[çc][aã]o|Cometa|Kaissara|Sampaio|JBL|1001|Itapemirim|Util|Catarinense|Raposo)[^<"]{0,30}/gi);
console.log(`\nNomes de empresas: ${empresas?.length ?? 0}`);
if (empresas) console.log([...new Set(empresas)].slice(0, 15));
