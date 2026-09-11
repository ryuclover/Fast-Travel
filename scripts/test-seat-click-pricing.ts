import { chromium } from "playwright"

async function testSeatClickPricing() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto("https://viajeguanabara.com.br/onibus/rio_de_janeiro-rj-todos/sao_paulo-sp-todos/?departure_date=2026-09-19&passengers=13:1", {
    waitUntil: "networkidle"
  })

  console.log("Abrindo primeiro card...")
  const btn = page.locator("button:has-text('Escolher assento')").first()
  await btn.click()
  await page.waitForTimeout(4000)

  // Inspecionar todos os elementos com imagem de seat-available
  const seatImgs = await page.locator("img[src*='seat-available']").all()
  console.log(`Total de assentos livres encontrados: ${seatImgs.length}`)

  for (let i = 0; i < Math.min(seatImgs.length, 5); i++) {
    const img = seatImgs[i]
    // Pegar o elemento pai ou o texto próximo
    const parentText = await img.locator("xpath=..").innerText().catch(() => "")
    console.log(`\nAssento ${i + 1} (Texto: '${parentText.trim()}'):`)
    await img.click({ force: true })
    await page.waitForTimeout(1500)

    // Verificar se modal apareceu
    const modal = page.locator("text='O preço da viagem foi atualizado'")
    const isModal = await modal.isVisible()
    console.log(`  Modal de aviso apareceu? ${isModal}`)

    // Pegar o texto do modal ou da tela
    if (isModal) {
      const modalMsg = await page.locator("div:has-text('O preço da viagem foi atualizado')").last().innerText().catch(() => "")
      console.log(`  MENSAGEM DO MODAL:`, modalMsg.replace(/\n+/g, " "))
      const closeBtn = page.locator("button:has-text('Entendi'), button:has-text('Continuar')").first()
      if (await closeBtn.isVisible()) await closeBtn.click()
    }

    // Pegar o preço total exibido na tela no rodapé
    const totalText = await page.locator("text='Total' >> xpath=..").innerText().catch(() => "")
    console.log(`  Preço exibido após seleção: ${totalText.replace(/\n+/g, " ")}`)

    // Desmarcar
    await img.click({ force: true })
    await page.waitForTimeout(500)
  }

  await browser.close()
}

testSeatClickPricing().catch(console.error)
