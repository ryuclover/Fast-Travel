async function inspectAllRoutesOfTrip() {
  const originApi = "RIO DE JANEIRO - RJ - TODOS"
  const destinationApi = "SAO PAULO - SP - TODOS"
  const date = "2026-09-19"
  const url = `https://viajeguanabara.com.br/api/search/services/?departure_date=${date}&destination=${encodeURIComponent(destinationApi)}&origin=${encodeURIComponent(originApi)}&passengers=13:1`

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://viajeguanabara.com.br/",
    }
  })
  const data = await resp.json()
  const trips = data.trips || []

  for (const t of trips) {
    const route = t.routes?.[0]
    console.log({
      empresa: t.company,
      horario: t.origin?.date_time?.split("T")[1]?.slice(0, 5),
      classe: t.class_of_service,
      trip_id: t.trip_id,
      daily_schedule_route_id: route?.daily_schedule_route_id,
      vehicle_config_id: t.vehicle_configuration_id || route?.vehicle_configuration_id,
      available_seats: route?.available_seats,
      fare: t.fare,
      total: t.total,
    })
  }
}

inspectAllRoutesOfTrip().catch(console.error)
