# FastTravel

FastTravel é um projeto Next.js voltado para busca de passagens de ônibus no Brasil, com foco em encontrar disponibilidade de tarifas e benefícios como `ID Jovem`.

## O que faz

- Busca rotas de ônibus entre cidades sugeridas
- Consulta o ClickBus e coleta resultados via scraping com `puppeteer`
- Identifica disponibilidade de passagens e possíveis vagas `ID Jovem`
- Exibe resultados na interface em uma página única com filtros e ordenação

## Tecnologias

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Puppeteer
- Radix UI
- shadcn/ui

## Estrutura principal

- `app/page.tsx` - interface de busca e apresentação dos resultados
- `app/api/buscar/route.ts` - API que realiza a consulta e scraping
- `lib/scrapers/clickbus.ts` - scraper para a página ClickBus
- `lib/cidades-sugeridas.ts` - lista de cidades permitidas

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

3. Acesse no navegador:

```
http://localhost:3000
```

## Observações

- O projeto utiliza scraping para obter informações de sites de transporte, então o funcionamento pode depender de alterações na estrutura das páginas externas.
- Há suporte a busca por trechos e consulta de passagens com foco em disponibilidade de descontos `ID Jovem`.

## Contribuição

Para contribuir:

1. Faça um fork ou clone o repositório
2. Crie uma branch para a sua alteração
3. Execute os testes e verifique o projeto localmente
4. Faça o pull request

---

`FastTravel` foi criado para facilitar a pesquisa de passagens de ônibus e fornecer uma visualização rápida de disponibilidade e preços.
