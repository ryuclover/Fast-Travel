async function checkAllTripsRealAvailability() {
  const originApi = "RIO DE JANEIRO - RJ - TODOS"
  const destinationApi = "SAO PAULO - SP - TODOS"
  const date = "2026-09-19"
  const url = `https://viajeguanabara.com.br/api/search/services/?departure_date=${date}&destination=${encodeURIComponent(destinationApi)}&origin=${encodeURIComponent(originApi)}&passengers=13:1`

  console.log("Consultando viagens Guanabara...")
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://viajeguanabara.com.br/",
    }
  })

  const data = await resp.json()
  const trips = data.trips || []
  console.log(`Encontradas ${trips.length} viagens no card de busca.\n`)

  for (const t of trips) {
    const route = t.routes?.[0]
    const routeId = route?.daily_schedule_route_id || t.trip_id
    const empresa = t.company || route?.company_name || "Guanabara"
    const horario = t.origin?.date_time?.split("T")[1]?.slice(0, 5) || "N/A"
    const cardPrice = t.total ?? t.fare

    console.log(`----------------------------------------------------------------------`)
    console.log(`🚌 ${empresa} às ${horario} (ID Rota: ${routeId})`)
    console.log(`   Preço exibido no Card: R$ ${Number(cardPrice).toFixed(2)} (fare=${t.fare})`)

    // Consultar o mapa real de assentos: POST https://viajeguanabara.com.br/api/seats/maps/
    try {
      const seatResp = await fetch("https://viajeguanabara.com.br/api/seats/maps/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": `https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=${date}&passengers=13:1`,
        },
        body: JSON.stringify({
          id_daily_schedule_route: routeId,
          id_passenger_classification_list: [13],
          id_passenger_type: 8,
        }),
      })

      if (seatResp.ok) {
        const seatData = await seatResp.json()
        const availabilities = seatData.passengerTypeAvailability || []
        console.log("   DISPONIBILIDADE REAL DE ASSENTOS:")
        for (const a of availabilities) {
          console.log(`     - [${a.name}]: disponíveis = ${a.available_seats}, indisponíveis = ${a.unavailable_seats}`)
        }
      } else {
        console.log(`   Erro ao consultar assentos: HTTP ${seatResp.status}`)
      }
    } catch (err: any) {
      console.log(`   Erro na requisição de assentos: ${err.message}`)
    }
  }
}

checkAllTripsRealAvailability().catch(console.error)
