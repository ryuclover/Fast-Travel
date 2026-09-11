async function inspectVehicleSeats() {
  const date = "2026-09-19"
  const routeId = 361216823 // SAMPAIO 14:30

  // 1. Obter a configuração do veículo (layout)
  const configResp = await fetch("https://viajeguanabara.com.br/api/seats/vehicle-configuration/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": `https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=${date}&passengers=13:1`,
    },
    body: JSON.stringify({ id: 107 }),
  })
  const configData = await configResp.json()
  console.log("configData keys:", Object.keys(configData))
  console.log("configData sample:", JSON.stringify(configData).slice(0, 500))
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

  console.log("Config name:", configData.name)
  console.log("Status count:", seatData.seatsStatus?.length)

  // Mapear cell_id para status
  const statusMap = new Map<number, number>()
  for (const s of seatData.seatsStatus || []) {
    statusMap.set(s.id_seat_map_cell, s.status)
  }

  // Percorrer os assentos da configuração
  const seatsFound: any[] = []
  const rows = configData.vehicle_configuration?.rows || []
  for (const row of rows) {
    for (const cell of row.cells || []) {
      if (cell.is_seat && cell.seat_identifier) {
        const st = statusMap.get(cell.seat_map_cell_id) ?? cell.status
        seatsFound.push({
          num: cell.seat_identifier,
          cellId: cell.seat_map_cell_id,
          status: st,
          styleClass: cell.style_class,
        })
      }
    }
  }

  console.log(`Total de assentos mapeados: ${seatsFound.length}`)
  console.log("Status únicos encontrados:", Array.from(new Set(seatsFound.map(s => s.status))))
  console.log("Assentos livres (status !== 3 e !== 5, etc.):")
  for (const s of seatsFound) {
    console.log(`  Poltrona ${s.num}: status=${s.status}, style=${s.styleClass}`)
  }
}

inspectVehicleSeats().catch(console.error)
