# Cenários

Um **Cenário** é uma Configuração fictícia, o estado de um Azure DevOps fictício
(projetos, times, iterações, work items com histórico) e uma data de referência,
o "hoje" do Cenário. Tudo é inventado: organização `contoso`, pessoas e Produtos
de exemplo.

Os Cenários servem a duas coisas:

- **Regressão.** `npm run test:regression` abre **toda tela em todo Cenário** e
  compara o resultado com o aprovado em `tests/regression/aprovados/`. Roda
  sozinho dentro do `npm run check`, antes de todo commit e em todo PR.
- **Demonstração.** O mesmo catálogo alimenta o Perfil de demonstração e os
  prints do README. Por isso o código mora em `src/main/demo/`, e não em `tests/`.
  O Perfil de demonstração usa o `vitrine`, com as datas deslocadas em semanas
  inteiras até a sprint corrente ser a de hoje (`RN-GLB-16`); a regressão roda
  sem deslocamento, na data de referência.

As telas da regressão são `sprint-unificada`, `entregas`, `bugs`, `desempenho`,
`daily`, `planning` (com o resumo para compartilhar), `descoberta`, `usuario`,
`home` (o momento da sprint que a Home sugere) e,
nos Cenários com item de Planning, `pedido-ia` (o texto que o PO copia para a IA
dele). Toda tela roda em todo Cenário; a coluna "Telas em foco" diz onde está o
que o Cenário prova.

A tela **Segurança** fica fora da regressão por Cenário porque não depende de
dado nenhum: o conteúdo é o mesmo em todo Cenário. O que ela promete é conferido
por `src/renderer/src/features/security/guarantees.test.ts` (`RN-SEC-31`).

## Catálogo

Esta tabela é conferida por teste: precisa listar exatamente os Cenários do
código, na mesma ordem, com as mesmas regras e telas.

| ID | O que prova | Regras | Telas em foco |
|---|---|---|---|
| `scrum-basico` | Um Produto Scrum sem campo customizado: toda tela abre e os indicadores que dependem de campo chegam vazios dizendo o que configurar, em vez de zero | RN-GLB-01, RN-GLB-05, RN-ENT-01, RN-BUG-04, RN-BUG-05, RN-PLN-03, RN-DLY-01 | entregas, bugs, desempenho, daily, planning, descoberta |
| `grupo-de-produtos` | Loja (Scrum) e App (Agile) em projetos, times e cores diferentes, somados num Grupo; sprints unidas pela janela e não pelo nome; iteração de outro time fica de fora | RN-GLB-01, RN-GLB-02, RN-GLB-04, RN-GLB-05, RN-ENT-13, RN-DES-05 | sprint-unificada, entregas, bugs, desempenho, daily, planning |
| `entrega-pelo-historico` | Entrega pela primeira entrada em estado de entrega: item movido de sprint depois de entregue, item da sprint entregue na anterior, item reaberto, item nunca planejado | RN-ENT-01, RN-ENT-03, RN-ENT-04 | entregas, desempenho |
| `escopo-injetado` | Item criado dentro da sprint, puxado do backlog na segunda semana, trazido da sprint seguinte e puxado às 10h do primeiro dia: todos injetados | RN-ENT-01, RN-ENT-08 | entregas, daily |
| `bugs-com-criticidade` | Nível pelo prefixo do valor, SLA pelo Due Date: no prazo, fora, reaberto, ativo vencido, sem criticidade, valor sem nível, removido, reincidente, campo inexistente ignorado | RN-BUG-01, RN-BUG-02, RN-BUG-04, RN-BUG-05, RN-BUG-17, RN-DES-03, RN-DES-05 | bugs, desempenho |
| `calendario-com-feriado` | Feriado nacional e feriado extra no meio da sprint, expediente 08:00–12:00 e 13:30–18:00: horas úteis, régua e projeção da Daily | RN-GLB-07, RN-DLY-01, RN-DLY-14, RN-ENT-01, RN-HOM-02 | daily, entregas, desempenho, home |
| `planning-com-remanescentes` | Remanescentes com percentual, item desmarcado, reserva de bugs no formato antigo, item removido e bug fora; pedido à IA com token fictício redigido | RN-PLN-01, RN-PLN-02, RN-PLN-03, RN-PLN-04, RN-PLN-10, RN-PLN-12, RN-PLN-15, RN-PLN-16, RN-PLN-17, RN-PLN-18, RN-PLN-20, RN-PLN-21, RN-SEC-24 | planning, pedido-ia, sprint-unificada |
| `desempenho-cinco-sprints` | Seis sprints de histórico com tendência: retrabalho caindo, SLA piorando, sprint corrente aberta | RN-DES-03, RN-DES-05, RN-DES-06, RN-BUG-02, RN-BUG-17 | desempenho, bugs, entregas |
| `processo-customizado` | Tipos e estados que não são os do Scrum nem os do Agile; Produto de fluxo contínuo num Grupo; abrandamento da Daily para item só aguardando teste; sugestão de Perfil de processo | RN-GLB-01, RN-GLB-04, RN-ENT-04, RN-ENT-08, RN-DLY-14, RN-DLY-19, RN-BUG-17 | entregas, daily, bugs, desempenho, planning, descoberta |
| `sprint-vazia` | Sprints sem nenhum item, com os campos configurados: nenhuma tela quebra e nada vira divisão por zero | RN-ENT-01, RN-BUG-02, RN-DES-03, RN-DLY-01, RN-PLN-02 | entregas, bugs, desempenho, daily, planning |
| `vitrine` | O Cenário da demonstração e dos prints: Grupo com dois Produtos no mesmo projeto, cinco sprints de histórico, sprint em andamento com um item em cada situação da Daily e a seguinte pronta para o Planning | RN-GLB-01, RN-GLB-02, RN-GLB-15, RN-ENT-01, RN-ENT-08, RN-BUG-02, RN-DLY-01 | entregas, bugs, desempenho, daily, planning, pedido-ia, home |

## Como um Cenário é montado

- `src/main/demo/types.ts` — a forma de um Cenário.
- `src/main/demo/builders.ts` — processos Scrum e Agile como o Azure os descreve,
  pessoas fictícias, séries de sprints e o construtor de work item com histórico.
  Estado atual, `StateChangeDate` e `ClosedDate` saem do histórico, para nunca o
  contradizerem.
- `src/main/demo/fake-azure.ts` — o Azure fictício. Responde só às rotas que os
  serviços usam; **pedido desconhecido falha alto**, com a rota no erro.
- `src/main/demo/wiql.ts` — o subconjunto de WIQL que os serviços escrevem.
  Consulta de outra forma também falha alto.
- `src/main/demo/scenarios/` — um módulo por Cenário e o catálogo em `index.ts`.

Para mexer num Cenário ou criar um, veja a seção "Cenários e resultados
aprovados" do `CONTRIBUTING.md`.
