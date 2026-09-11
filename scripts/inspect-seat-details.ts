async function inspectSeatDetails() {
  const date = "2026-09-19"
  const routeId = 361216823 // SAMPAIO 14:30

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

  const seatData = await seatResp.json()
  console.log("seatData keys:", Object.keys(seatData))
  console.log("passengerTypeAvailability:", JSON.stringify(seatData.passengerTypeAvailability, null, 2))
  console.log("vehicle_configuration sample:", JSON.stringify(seatData.vehicle_configuration).slice(0, 500))
  console.log("seatsStatus count:", seatData.seatsStatus?.length)
  console.log("seatsStatus sample (first 10):", seatData.seatsStatus?.slice(0, 10))

  // Find cells with seat identifiers
  const cellsWithSeats: any[] = []
  for (const row of seatData.vehicle_configuration?.rows || []) {
    for (const cell of row.cells || []) {
      if (cell.is_seat && cell.seat_identifier) {
        cellsWithSeats.push(cell)
      }
    }
  }
  console.log("Total seats in map:", cellsWithSeats.length)
  console.log("First 5 seats:", cellsWithSeats.slice(0, 5))
}

inspectSeatDetails().catch(console.error)
