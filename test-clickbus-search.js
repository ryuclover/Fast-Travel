const fs = require('fs');
const text = fs.readFileSync('clickbus.html', 'utf8');
const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if(match) {
  const data = JSON.parse(match[1]);
  let found = [];
  function search(obj, path) {
    if(!obj) return;
    if(Array.isArray(obj)) {
      obj.forEach((o, i) => search(o, path+'['+i+']'));
    } else if(typeof obj === 'object') {
      if(obj.price !== undefined && obj.departure) found.push(path);
      Object.keys(obj).forEach(k => search(obj[k], path+'.'+k));
    }
  }
  search(data, 'data');
  console.log('Found paths:', found.slice(0, 10));
}
