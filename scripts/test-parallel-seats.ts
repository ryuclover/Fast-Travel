async function testParallelSeatVerification() {
  const originApi = "RIO DE JANEIRO - RJ - TODOS"
  const destinationApi = "SAO PAULO - SP - TODOS"
  const date = "2026-09-19"
  const url = `https://viajeguanabara.com.br/api/search/services/?departure_date=${date}&destination=${encodeURIComponent(destinationApi)}&origin=${encodeURIComponent(originApi)}&passengers=13:1`

  const start = Date.now()
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://viajeguanabara.com.br/",
    }
  })
  const data = await resp.json()
  const trips = data.trips || []
  console.log(`Buscadas ${trips.length} viagens em ${Date.now() - start}ms.`)

  const startSeats = Date.now()
  const seatPromises = trips.map(async (t: any) => {
    const route = t.routes?.[0]
    const routeId = route?.daily_schedule_route_id || t.trip_id
    try {
      const res = await fetch("https://viajeguanabara.com.br/api/seats/maps/", {
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
      if (!res.ok) return null
      const json = await res.json()
      const availabilities = json.passengerTypeAvailability || []
      const j100 = availabilities.find((a: any) => a.name?.includes("100%"))?.available_seats ?? 0
      const j50 = availabilities.find((a: any) => a.name?.includes("50%"))?.available_seats ?? 0
      return {
        tripId: t.trip_id,
        routeId,
        classe: t.class_of_service,
        empresa: t.company,
        horario: t.origin?.date_time?.split("T")[1]?.slice(0, 5),
        vagas100Reais: j100,
        vagas50Reais: j50,
      }
    } catch {
      return null
    }
  })

  const results = await Promise.allSettled(seatPromises)
  console.log(`Verificação de assentos em paralelo concluída em ${Date.now() - startSeats}ms:`)
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      console.log(`- ${r.value.empresa} (${r.value.classe}) às ${r.value.horario}: 100% = ${r.value.vagas100Reais} vagas | 50% = ${r.value.vagas50Reais} vagas`)
    }
  }
}

testParallelSeatVerification().catch(console.error)
