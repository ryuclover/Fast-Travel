async function testEmbarcaApi() {
  const url = "https://www.embarca.ai/api/v1/trips/curitiba-pr/florianopolis-sc?departure_at=2026-09-25&gratuity=true&web_request=true"
  console.log("Fetching Embarca API:", url)
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.embarca.ai/",
      "Accept-Language": "pt-BR,pt;q=0.9",
    }
  })
  console.log("Status Embarca:", res.status)
  const json = await res.json().catch(() => null)
  console.log("Is array:", Array.isArray(json), "Count:", json?.length)
  if (Array.isArray(json) && json.length > 0) {
    const withGrat = json.filter(t => t.gratuity_types != null)
    console.log("Trips with gratuity_types:", withGrat.length)
    for (const t of withGrat.filter(t => t.gratuity_types?.length > 0)) {
      console.log("Eligible trip:", t.operator_name, t.seat_class, t.departure_at)
      console.log("available_gratuities:", JSON.stringify(t.available_gratuities))
      console.log("disable_gratuity:", t.disable_gratuity)
      console.log("price:", t.price)
    }
  }
}

testEmbarcaApi().catch(console.error)
