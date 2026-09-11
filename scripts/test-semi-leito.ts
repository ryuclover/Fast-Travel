import { chromium } from "playwright"

async function testSemiLeitoSeat() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto("https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-09-19&passengers=13:1", {
    waitUntil: "networkidle"
  })

  // Encontrar o card com classe SEMI LEITO
  console.log("Procurando card SEMI LEITO...")
  const cards = await page.locator("div[class*='card'], div[class*='service'], div:has(button:has-text('Escolher assento'))").all()

  // Localizar botão de 'Escolher assento' do Semi-leito
  const semiLeitoBtn = page.locator("button:has-text('Escolher assento')").nth(2) // 3o card é SEMI LEITO
  console.log("Clicando no 3º card (SEMI LEITO 14:30)...")
  await semiLeitoBtn.click()
  await page.waitForTimeout(4000)

  const seatImgs = await page.locator("img[src*='seat-available']").all()
  console.log(`Assentos livres no SEMI LEITO: ${seatImgs.length}`)

  if (seatImgs.length > 0) {
    console.log("Clicando no 1º assento livre do SEMI LEITO...")
    await seatImgs[0].click({ force: true })
    await page.waitForTimeout(2000)

    const modal = page.locator("text='O preço da viagem foi atualizado'")
    const isModal = await modal.isVisible()
    console.log("Modal de preço alterado apareceu no SEMI LEITO? ", isModal)

    const pageText = await page.evaluate(() => document.body.innerText)
    const priceSnippet = pageText.match(/R\$\s*[0-9]+[,\.][0-9]{2}/g)
    console.log("Preços detectados na página do SEMI LEITO após seleção:", priceSnippet)
  }

  await browser.close()
}

testSemiLeitoSeat().catch(console.error)
