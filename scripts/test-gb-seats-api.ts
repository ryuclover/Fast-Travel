import { fetchWithRetry } from "../lib/scrapers/guanabara/client"

async function inspectGuanabaraSeats() {
  const originApi = "RIO DE JANEIRO - RJ - TODOS"
  const destinationApi = "SAO PAULO - SP - TODOS"
  const url = `https://viajeguanabara.com.br/api/search/services/?departure_date=2026-09-19&destination=${encodeURIComponent(destinationApi)}&origin=${encodeURIComponent(originApi)}&passengers=13:1`
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://viajeguanabara.com.br/",
    }
  })

  const data = await resp.json()
  console.log("Response keys:", Object.keys(data))
  if (data.results) console.log("data.results keys/length:", data.results?.length)
  if (data.trips) console.log("data.trips keys/length:", data.trips?.length)
  const trip = data.trips?.[0] || data.results?.[0] || data[0]
  console.log("Trip sample:", JSON.stringify(trip || data).slice(0, 500))
  console.log("Trip service_id:", trip?.service_id)
  console.log("All trip keys:", Object.keys(trip || {}))
  console.log("Trip details:", {
    fare: trip.fare,
    total: trip.total,
    sub_total: trip.sub_total,
    boarding_fee: trip.boarding_fee,
    available_seats: trip.available_seats,
    routes: trip.routes?.[0] ? Object.keys(trip.routes[0]) : null,
  })

  if (trip.routes?.[0]) {
    console.log("Route details:", {
      id: trip.routes[0].id,
      service_id: trip.routes[0].service_id,
      fare: trip.routes[0].fare,
      total: trip.routes[0].total,
      available_seats: trip.routes[0].available_seats,
      id_jovem_available: trip.routes[0].id_jovem_available,
      free_seats: trip.routes[0].free_seats,
    })
  }

  // Test possible seat endpoints
  const route = trip.routes?.[0]
  console.log("trip.trip_id:", trip.trip_id)
  console.log("route.daily_schedule_route_id:", route?.daily_schedule_route_id)

  const endpoints = [
    `https://viajeguanabara.com.br/api/search/services/${trip.trip_id}/seats/?passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/bus-layout/?trip_id=${trip.trip_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/bus-layout/?daily_schedule_route_id=${route?.daily_schedule_route_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/bus-layout/?trip_id=${trip.trip_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/seats/?trip_id=${trip.trip_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/seats/?daily_schedule_route_id=${route?.daily_schedule_route_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/services/bus-layout/?trip_id=${trip.trip_id}&passengers=13:1`,
    `https://viajeguanabara.com.br/api/search/services/bus-layout/?daily_schedule_route_id=${route?.daily_schedule_route_id}&passengers=13:1`,
  ]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json",
        }
      })
      console.log(`Endpoint: ${ep} -> Status: ${res.status}`)
      if (res.ok) {
        const json = await res.json()
        console.log("SUCCESS on endpoint:", ep)
        console.log("Response keys:", Object.keys(json))
        console.log("Sample response:", JSON.stringify(json).slice(0, 500))
      }
    } catch (e: any) {
      console.log(`Endpoint error: ${ep} -> ${e.message}`)
    }
  }
}

inspectGuanabaraSeats().catch(console.error)
