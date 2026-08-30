const fs = require('fs');
const text = fs.readFileSync('clickbus.html', 'utf8');
const urls = text.match(/https:\/\/[a-zA-Z0-9.-]+\.clickbus\.com\.br\/[^\s"']+/g);
if(urls) {
  const uniqueUrls = [...new Set(urls)];
  console.log('Found URLs:', uniqueUrls.filter(u => u.includes('api') || u.includes('search') || u.includes('trips') || u.includes('graphql')));
}
