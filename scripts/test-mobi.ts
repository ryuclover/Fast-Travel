async function testMobiOrigins() {
  const res = await fetch("https://www.mobifacil.com.br/on/demandware.store/Sites-Mobifacil-Site/pt_BR/Ticket-GetOrigins?search=sao%20paulo", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    }
  })
  console.log("Status Mobi Origins:", res.status)
  const data = await res.json().catch(() => null)
  console.log("Origins:", JSON.stringify(data).slice(0, 300))
}

testMobiOrigins().catch(console.error)
