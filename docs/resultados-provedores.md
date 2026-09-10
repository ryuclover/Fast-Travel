# Resultados de buscas por provedor

Este documento registra o comportamento observado nas consultas do FastTravel e serve como guia para diagnosticar e corrigir cada integração.

## Como reproduzir

A API local usa esta estrutura:

```text
/api/buscar?origem=Rio%20de%20Janeiro&origemUF=RJ&destino=Salvador&destinoUF=BA&dataInicio=2026-09-11&dataFim=2026-09-11&idJovem=false
```

Para consultar uma fonte diretamente, abra a URL oficial indicada em cada seção. Sempre registre a data da consulta, a data da viagem, o status HTTP, a quantidade de resultados e uma amostra do primeiro resultado.

## Resumo observado

Consulta de referência: Rio de Janeiro/RJ para Salvador/BA, viagem em 10/09/2026, modalidade comercial.

| Provedor | Resultado observado | Integração atual | Próxima ação |
| --- | --- | --- | --- |
| ClickBus | Parser atualizado para o BFF v6 (`trips`/`parts`); 5 viagens Rio-Salvador e 38 Rio-BH em 11/09 | Playwright interceptando BFF | Validar o binário Chromium no deploy; Rio-SP retornou sem oferta nessa data |
| Buser | 0 horários em 10/09; 1 horário em 11/09 por R$ 295,98 | Playwright lendo cards HTML | Preferir endpoint estruturado se a página mudar |
| Guanabara/UTIL | API respondeu HTTP 500 em consulta direta | API REST | Investigar contrato, sessão e parâmetros aceitos |
| Gontijo | Não há consulta automática real implementada | Portal oficial sem scraper de disponibilidade | Implementar fluxo oficial antes de exibir horários |
| Embarca.ai | Não há consulta automática real implementada | Portal oficial sem scraper de disponibilidade | Implementar catálogo/API real antes de exibir horários |

## ClickBus

### Resultado

A URL atual funciona com o formato:

```text
https://www.clickbus.com.br/onibus/rio-de-janeiro-rj/salvador-ba?departureDate=2026-09-11
```

O formato antigo usado pelo projeto adicionava `-todos` aos dois slugs e podia redirecionar para a página genérica. O cliente foi atualizado para remover esse sufixo.

O BFF retorna `403 Forbidden` quando chamado diretamente sem a sessão e os cabeçalhos criados pelo site. Por isso, a integração precisa carregar a página com Playwright e interceptar a chamada BFF.

O schema atual usa `trips`, com os dados dentro de `parts[0]`. O cliente não deve voltar a usar `departures`, que pertencia ao schema antigo.

### Código relacionado

- Cliente: `lib/scrapers/clickbus/client.ts`
- Mapeador de rede: `lib/scrapers/clickbus/mapper.ts`
- Amostra do mapeamento: `lib/scrapers/clickbus/mapped-api.json`
- Link de compra: `lib/utils/formatters.ts`

### Checklist de diagnóstico

1. Confirmar se o Chromium iniciou no ambiente de execução.
2. Confirmar status da navegação da página.
3. Confirmar se uma resposta `bff.clickbus.com` foi capturada.
4. Registrar endpoint, status e presença de `departures`.
5. Comparar o schema de `departures` com o mapeamento do cliente.

## Buser

### Resultado

A página oficial confirmou:

- 10/09/2026: `0 horários`.
- 11/09/2026: `1 horário`.
- 18/09/2026: `1 horário`.
- 25/09/2026: `1 horário`.

A API local retornou para 11/09/2026:

```text
Buser | 22:00 -> 05:00 | R$ 295,98 | Executivo
```

URL de referência:

```text
https://www.buser.com.br/onibus/rio-de-janeiro-rj/salvador-ba?ida=2026-09-11
```

### Código relacionado

- Cliente: `lib/scrapers/buser/client.ts`
- Orquestração: `lib/services/comparador-intervalo.ts`

### Implementação serverless

Na Vercel, o cliente tenta primeiro ler os cards SSR da resposta HTML. Esse fallback evita depender do Chromium dentro da função serverless e foi validado para Rio-Salvador em 11/09/2026. O Playwright continua como fallback para ambientes locais ou quando a página não entrega cards SSR.

### Limitações

A extração depende dos seletores `.grupo-novo-card` e `.itinerario-resumido-novo-card`. Uma alteração visual na Buser pode resultar em zero sem indicar erro. O diagnóstico deve registrar quantidade de cards encontrados e quantidade de cards com preço.

## Guanabara/UTIL

### Resultado

Consulta direta observada:

```text
GET https://viajeguanabara.com.br/api/search/services/?departure_date=2026-09-10&destination=SALVADOR%20-%20BA%20-%20TODOS&origin=RIO%20DE%20JANEIRO%20-%20RJ%20-%20TODOS&passengers=1
```

O catálogo `GET /api/cities/available/` responde `200` e contém Rio de Janeiro, São Paulo, Salvador e Belo Horizonte. Porém, a chamada de serviços usada pelo cliente retorna HTTP `500` com corpo `{"error":"Failed to load services"}` mesmo para cidades presentes no catálogo.

### Código relacionado

- Cliente: `lib/scrapers/guanabara/client.ts`
- Cliente HTTP e retry: `lib/http-client.ts`

### Próxima investigação

1. Abrir a página oficial parametrizada e capturar a chamada feita pelo frontend.
2. Comparar os nomes exatos de origem e destino retornados pelo catálogo da Guanabara.
3. Verificar se a API exige cookie, token CSRF ou cabeçalho adicional.
4. Não tratar HTTP 500 como “nenhuma viagem”; preservar o erro no diagnóstico.

Enquanto o endpoint de serviços não for corrigido pelo provedor, o FastTravel deve manter Guanabara como `Erro`, não como `Online` ou `Sem oferta`.

## Gontijo

### Resultado

O cliente atual não consulta a disponibilidade da Gontijo. Horários fixos que existiam no código foram removidos para evitar resultados inventados. O provedor retorna `sem_cobertura` até que o fluxo oficial seja integrado.

### Código relacionado

- Cliente: `lib/scrapers/gontijo/client.ts`

### Risco

A correção adequada é integrar o fluxo oficial da Gontijo ou manter a fonte marcada como indisponível para consulta automática.

## Embarca.ai

### Resultado

O cliente não consulta disponibilidade real no momento. Dados simulados de rotas Sul/Sudeste foram removidos; a fonte retorna `sem_cobertura` até que o catálogo/API real seja integrado.

### Código relacionado

- Cliente: `lib/scrapers/embarca/client.ts`

### Próxima investigação

Localizar o endpoint/catálogo real do Embarca.ai, validar a cobertura da rota e substituir a lista fixa por resposta da fonte. Até lá, a interface deve deixar claro que a fonte não cobre a rota, em vez de sugerir indisponibilidade geral.

## Interpretação dos resultados

`totalEncontrado: 0` não prova que não existem passagens. Pode significar:

- a data não tem oferta;
- a fonte respondeu erro;
- a fonte não cobre a rota;
- o navegador não iniciou;
- o seletor ou schema da integração ficou desatualizado.

Ao corrigir uma integração, preserve no retorno o provedor, o status, a mensagem de erro e a quantidade de itens capturados. Isso evita que uma falha técnica seja confundida com ausência de oferta.
