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
`home` (o momento da sprint que a Home sugere), `retrato` (o retrato do fluxo do
PO de cada Produto, `RN-FLX-01`), `fluxo` (a Fase e as pendências de cada Feature,
sobre a pasta de trabalho fictícia em `tests/regression/pastas/<cenário>/<produto>`,
com a data de alteração de cada pasta fixada no teste), `oportunidades` (os feedbacks, a conversa e
os bugs sem regra, com o encaixe), `acompanhamento` (bugs sem análise, por
Feature e por regra, e as regras a conferir), `roadmap` (as Janelas de todas as
pastas, a Fase sobre elas, a carga das trilhas e os marcos), `catalogo` (o catálogo de
cada Produto e o que a absorção da wiki mudaria) e,
nos Cenários com item de Planning, `pedido-ia` (o texto que o PO copia para a IA
dele). Toda tela roda em todo Cenário; a coluna "Telas em foco" diz onde está o
que o Cenário prova.

A tela **Segurança** fica fora da regressão por Cenário porque não depende de
dado nenhum: o conteúdo é o mesmo em todo Cenário. O que ela promete é conferido
por `src/renderer/src/features/security/guarantees.test.ts` (`RN-SEC-31`).

As **novidades da versão** (`RN-HOM-04`, `RN-HOM-05`) também ficam fora: o conteúdo
vem de `src/shared/release-notes.json`, igual em todo Cenário. Quando o modal abre e
a busca do histórico são provados por `src/shared/release-notes.test.ts`.

O **aviso de versão nova** (`RN-GLB-18`) também fica fora: ele depende da Release
publicada no GitHub, não do Cenário. A comparação de versões é provada por
`src/shared/update.test.ts`, e a consulta e os links por
`tests/security/rn-sec-33-consulta-de-versao.test.ts`.

## Catálogo

Esta tabela é conferida por teste: precisa listar exatamente os Cenários do
código, na mesma ordem, com as mesmas regras e telas.

| ID | O que prova | Regras | Telas em foco |
|---|---|---|---|
| `scrum-basico` | Um Produto Scrum sem campo customizado: toda tela abre e os indicadores que dependem de campo chegam vazios dizendo o que configurar, em vez de zero | RN-GLB-01, RN-GLB-05, RN-ENT-01, RN-BUG-04, RN-BUG-05, RN-PLN-03, RN-DLY-01 | entregas, bugs, desempenho, daily, planning, descoberta |
| `grupo-de-produtos` | Loja (Scrum) e App (Agile) em projetos, times e cores diferentes, somados num Grupo; sprints unidas pela janela e não pelo nome; iteração de outro time fica de fora | RN-GLB-01, RN-GLB-02, RN-GLB-04, RN-GLB-05, RN-ENT-13, RN-DES-05 | sprint-unificada, entregas, bugs, desempenho, daily, planning |
| `squads` | Três Squads com calendários diferentes: Digital (Loja e App, mesmas sprints), Parceiros (Portal, sprints deslocadas uma semana) e Interno (Backoffice, fluxo contínuo); cada aba vê só as sprints da Squad, a Squad inteira soma os Produtos dela e a capacidade é separada por Squad | RN-GLB-02, RN-GLB-04, RN-GLB-17, RN-PLN-22 | sprint-unificada, entregas, daily, planning, home |
| `entrega-pelo-historico` | Entrega pela primeira entrada em estado de entrega: item movido de sprint depois de entregue, item da sprint entregue na anterior, item reaberto, item nunca planejado | RN-ENT-01, RN-ENT-03, RN-ENT-04 | entregas, desempenho |
| `escopo-injetado` | Item criado dentro da sprint, puxado do backlog na segunda semana, trazido da sprint seguinte e puxado às 10h do primeiro dia: todos injetados | RN-ENT-01, RN-ENT-08 | entregas, daily |
| `bugs-com-criticidade` | Nível pelo prefixo do valor, SLA pelo Due Date: no prazo, fora, reaberto, ativo vencido, sem criticidade, valor sem nível, removido, reincidente, campo inexistente ignorado | RN-BUG-01, RN-BUG-02, RN-BUG-04, RN-BUG-05, RN-BUG-17, RN-DES-03, RN-DES-05 | bugs, desempenho |
| `calendario-com-feriado` | Feriado nacional e feriado extra no meio da sprint, expediente 08:00–12:00 e 13:30–18:00: horas úteis, régua e projeção da Daily | RN-GLB-07, RN-DLY-01, RN-DLY-14, RN-ENT-01, RN-HOM-02 | daily, entregas, desempenho, home |
| `planning-com-remanescentes` | Remanescentes com percentual reaplicado sobre os pontos de agora, dois itens com desenvolvimento antecipado (só front, só back), item desmarcado, reserva de bugs no formato antigo, item removido e bug fora; pedido à IA com token fictício redigido | RN-PLN-01, RN-PLN-02, RN-PLN-03, RN-PLN-04, RN-PLN-09, RN-PLN-10, RN-PLN-12, RN-PLN-15, RN-PLN-16, RN-PLN-17, RN-PLN-18, RN-PLN-19, RN-PLN-20, RN-PLN-21, RN-PLN-23, RN-PLN-24, RN-PLN-25, RN-PLN-26, RN-SEC-24 | planning, pedido-ia, sprint-unificada |
| `desempenho-cinco-sprints` | Seis sprints de histórico com tendência: retrabalho caindo, SLA piorando, sprint corrente aberta | RN-DES-03, RN-DES-05, RN-DES-06, RN-BUG-02, RN-BUG-17 | desempenho, bugs, entregas |
| `processo-customizado` | Tipos e estados que não são os do Scrum nem os do Agile; Produto de fluxo contínuo num Grupo; abrandamento da Daily para item só aguardando teste; sugestão de Perfil de processo | RN-GLB-01, RN-GLB-04, RN-ENT-04, RN-ENT-08, RN-DLY-14, RN-DLY-19, RN-BUG-17 | entregas, daily, bugs, desempenho, planning, descoberta |
| `sprint-vazia` | Sprints sem nenhum item, com os campos configurados: nenhuma tela quebra e nada vira divisão por zero | RN-ENT-01, RN-BUG-02, RN-DES-03, RN-DLY-01, RN-PLN-02 | entregas, bugs, desempenho, daily, planning |
| `vitrine` | O Cenário da demonstração e dos prints: Grupo com dois Produtos no mesmo projeto, cinco sprints de histórico, sprint em andamento com um item em cada situação da Daily e a seguinte pronta para o Planning | RN-GLB-01, RN-GLB-02, RN-GLB-15, RN-ENT-01, RN-ENT-08, RN-BUG-02, RN-DLY-01 | entregas, bugs, desempenho, daily, planning, pedido-ia, home |
| `fluxo-do-po` | O retrato e o quadro do fluxo do PO. Retrato: Features abertas e fechadas há pouco, sem as removidas nem as antigas; filhos, inclusive em outra área; feedbacks ligados por vínculo pai (Loja) e "Related" (App); bugs abertos e fechados na janela, descrição só nos abertos; token fictício redigido. Quadro, sobre a pasta fictícia da Loja: Discovery com pendências e linha não reconhecida, Em quebra com regra repetida entre duas pastas, rascunho, Pronta para quebra parada, fechada no Azure com regra aberta, arquivada e fora do fluxo; o App sem pasta. Reconciliação: PBI com o mesmo título no Azure, PBI colado com título encurtado e o rascunho que ganhou a Feature. Catálogo: a wiki fictícia da Loja e a cópia na pasta, com página igual, mudada só na wiki, em conflito, nova e só local; Publicada pelo catálogo, regra citada que não existe, descontinuada e revalidação; o App consultando o catálogo da Loja. Oportunidades: feedback encaixado pelo vínculo do Azure, feedback proposto com o gesto a fazer, conversa com Feature nova, conversa encaixada, descartada com motivo e bug "A validar". Acompanhamento: bug aberto sem análise, bug ligado à Feature só pelo Azure, bug fechado que chega à Feature só pela regra violada, "Não é bug" fora da conta, bugs por regra e a regra não validada com o PBI de Origem entregue. Roadmap: Janela de Discovery e de Quebra fora da Janela, Janela cumprida, rascunho planejado, rascunho arquivado com Janela pulada, sprints projetadas pela cadência, Produto/UX sobrecarregado e no limite, o App sem pasta fora do plano e um marco com Janela movida, Feature que entrou e arquivada | RN-FLX-01, RN-FLX-02, RN-FLX-03, RN-FLX-04, RN-FLX-05, RN-FLX-06, RN-FLX-07, RN-FLX-08, RN-FLX-09, RN-FLX-10, RN-FLX-11, RN-FLX-12, RN-FLX-13, RN-FLX-14, RN-FLX-15, RN-FLX-16, RN-FLX-18, RN-FLX-19, RN-FLX-20, RN-FLX-21, RN-FLX-22, RN-FLX-23, RN-FLX-24, RN-FLX-25, RN-RDM-01, RN-RDM-02, RN-RDM-03, RN-RDM-04, RN-RDM-05, RN-RDM-06, RN-RDM-07, RN-RDM-08, RN-RDM-09, RN-RDM-10, RN-RDM-11, RN-RDM-12, RN-RDM-14, RN-RDM-15, RN-RDM-16, RN-RDM-17, RN-RDM-18, RN-RDM-19, RN-RDM-20, RN-RDM-21, RN-CAT-01, RN-CAT-02, RN-CAT-03, RN-CAT-04, RN-CAT-05, RN-CAT-06, RN-CFG-14, RN-CFG-15, RN-SEC-24 | retrato, fluxo, oportunidades, acompanhamento, roadmap, catalogo, descoberta |

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
