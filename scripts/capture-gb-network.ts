import { chromium } from "playwright"

async function captureNetwork() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on("request", (req) => {
    const u = req.url()
    if (u.includes("seats") || u.includes("services")) {
      console.log(">> REQUEST:", req.method(), u)
      if (req.postData()) {
        console.log("   PAYLOAD:", req.postData())
      }
    }
  })

  page.on("response", async (res) => {
    const u = res.url()
    if (u.includes("api") || u.includes("seat") || u.includes("layout")) {
      console.log("<< RESPONSE:", res.status(), u)
      try {
        const text = await res.text()
        console.log("   DATA:", text.slice(0, 300))
      } catch {}
    }
  })

  console.log("Navigating...")
  await page.goto("https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-09-19&passengers=13:1", { waitUntil: "networkidle" })

  console.log("Clicking 'Escolher assento'...")
  const btn = page.locator("button:has-text('Escolher assento')").first()
  if (await btn.isVisible()) {
    await btn.click()
    await page.waitForTimeout(3000)

    console.log("Looking for available seats...")
    // In Guanabara, seats are SVGs or buttons
    const seat = page.locator("img[src*='seat-available'], svg, [class*='seat']:not([class*='occupied'])").first()
    console.log("Clicking seat...")
    await seat.click({ force: true })
    await page.waitForTimeout(3000)

    // Capture text on the screen
    const modalText = await page.evaluate(() => document.body.innerText)
    console.log("PAGE TEXT AFTER SEAT CLICK (first 1000 chars):", modalText.slice(0, 1000))
  } else {
    console.log("Button not found")
  }

  await browser.close()
}

captureNetwork().catch(console.error)
