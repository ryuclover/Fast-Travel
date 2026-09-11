import { fetchWithRetry } from "../lib/http-client"

async function inspectSeats() {
  const origin = "RIO DE JANEIRO - RJ - TODOS"
  const destination = "SAO PAULO - SP - TODOS"
  const date = "2026-09-21"

  const url = `https://viajeguanabara.com.br/api/search/services/?departure_date=${date}&destination=${destination}&origin=${origin}&passengers=13:1`
  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://viajeguanabara.com.br",
    }
  })

  const data = await res.json()
  console.log("Total trips found:", data.trips?.length)

  for (const t of data.trips || []) {
    const rId = t.routes?.[0]?.daily_schedule_route_id || t.trip_id
    const time = t.origin?.date_time?.split("T")[1]?.slice(0, 5)
    const company = t.company || t.routes?.[0]?.company_name
    const cls = t.class_of_service || t.routes?.[0]?.class_of_service_name
    const fare = t.fare
    const total = t.total
    const original = t.original_price

    console.log(`\nTrip ${time} ${company} - ${cls} (rId: ${rId}) | fare: ${fare}, total: ${total}, orig: ${original}`)

    const sResp = await fetchWithRetry(
      "https://viajeguanabara.com.br/api/seats/maps/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: `https://viajeguanabara.com.br/onibus/${origin}/${destination}?departure_date=${date}&passengers=13:1`,
        },
        body: JSON.stringify({
          id_daily_schedule_route: rId,
          id_passenger_classification_list: [13],
          id_passenger_type: 8,
        }),
      }
    ).catch((e) => {
      console.log("Error fetching seats map:", e.message)
      return null
    })

    if (sResp && sResp.ok) {
      const sJson = await sResp.json().catch(() => null)
      console.log("passengerTypeAvailability:", JSON.stringify(sJson?.passengerTypeAvailability))
      // Check if seats have price or special status
      const bus = sJson?.bus || {}
      const seats = (bus.seats || []).slice(0, 5)
      console.log("Sample seat keys:", seats.length > 0 ? Object.keys(seats[0]) : "no seats")
      if (seats.length > 0) {
        console.log("Seat 0:", seats[0].number, seats[0].type, seats[0].status, seats[0].price, seats[0].fare)
      }
    } else {
      console.log("Seats map response status:", sResp?.status)
    }
  }
}

inspectSeats().catch(console.error)
