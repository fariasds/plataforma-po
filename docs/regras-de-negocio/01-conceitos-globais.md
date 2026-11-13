# Conceitos Globais

Regras que valem em **todas** as telas. Quando uma tela cita `RN-GLB-xx`, é isto.

---

## Produtos

### RN-GLB-01 · O que é um Produto

**Produto** é a unidade que o PO acompanha. Cada um é declarado na Configuração
(`products`) com:

| Campo                             | O que define                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                              | Identificador **imutável**: os Dados de trabalho são guardados por ele (`RN-CFG-02`) |
| `name` e `color`                  | Como aparece no filtro, nas etiquetas e nos gráficos                                 |
| `project`                         | Projeto do Azure DevOps onde os itens vivem                                          |
| `areaPaths` / `excludedAreaPaths` | Áreas incluídas e excluídas, com os filhos. Vazio inclui o projeto inteiro           |
| `team`                            | Opcional: time que fornece as iterações (`RN-GLB-05`)                                |
| `processProfile`                  | Perfil de processo: quais tipos contam e o que cada estado significa                 |
| `cadence`                         | `sprints` (tem iterações) ou `continuous` (fluxo sem iteração)                       |

Vários Produtos podem morar **no mesmo projeto** do Azure, separados por área. Por
isso toda consulta filtra pela área do Produto, senão traz item do vizinho.

Produto de fluxo **contínuo** não tem iteração: os indicadores o medem pela janela
de datas da Sprint unificada dos demais (`RN-GLB-04`), e ele não aparece no
Planning nem na Daily.

A seleção feita na tela chega ao processo principal como **ID** de Produto ou de
Grupo, e é traduzida para projeto, áreas, time e Perfil de processo num ponto só.
ID que não existe na Configuração em uso é recusado com erro, nunca tratado como
seleção vazia.

**Implementado em:** `src/main/services/azure/scope.ts`

### RN-GLB-02 · Filtro de Produto e Grupos

O filtro lista **primeiro os Produtos e depois os Grupos**, na ordem da
Configuração, cada um com o nome e a cor definidos lá. A tela abre no primeiro
Produto.

**Grupo de produtos** (`groups`) é uma soma nomeada de pelo menos dois Produtos:
os resultados de cada um são buscados e mesclados, e o Grupo é visto como um todo.

| Tela                                | Opções                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Review (Entregas, Bugs, Desempenho) | Todos os Produtos e todos os Grupos                                              |
| Planning e Daily                    | Só Produtos com `cadence: "sprints"`, e só Grupos formados inteiramente por eles |

Não existe planejamento de fluxo contínuo: sem iteração, não há sprint a planejar.

Se a Configuração muda e a opção escolhida deixa de existir, a tela volta para o
primeiro Produto.

**Implementado em:** `src/renderer/src/components/ProductFilter.tsx` e
`src/renderer/src/ipc/useAzure.ts` (`useSelection`)

### RN-GLB-03 · Áreas excluídas das métricas

Nem todo item dentro da área do Produto conta. Cada Produto pode declarar, na
Configuração, áreas a excluir (`excludedAreaPaths`), sempre com os filhos — por
exemplo um time de teste interno, o suporte ao cliente ou um fluxo paralelo fora da
cadência de sprint.

O objetivo é medir **o time de desenvolvimento do Produto**, não todo trabalho
registrado sob aquela área. A exclusão vale nas consultas de Entregas, Bugs,
retrabalho, Planning e Daily.

**Implementado em:** `src/main/services/azure/sprint-delivery.ts`
(`productAreaClauses`), `bug-analysis.ts`, `rework.ts`, `planning.ts`,
`planning-item.ts` e `daily.ts` (mesma pasta)

---

## Sprints

### RN-GLB-04 · Sprint unificada — agrupamento por período

Cada Produto com cadência por sprint tem **numeração própria**: a Sprint 40 de um e
a Sprint 12 de outro podem ser o mesmo intervalo de tempo.

Por isso o sistema **nunca agrupa por número**. A **Sprint unificada** junta as
iterações de todos os Produtos com `cadence: "sprints"` pela chave
`data de início + data de término`. Duas iterações com o mesmo período são a mesma
sprint, independentemente de como cada Produto a numerou. Um período em que só um
Produto tem sprint também vira Sprint unificada, com a iteração só dele.

A sprint guarda a iteração de cada Produto pelo ID do Produto, na ordem da
Configuração. Na interface os nomes aparecem lado a lado, cada um na cor do seu
Produto, para a pessoa reconhecer a sprint pelo nome que usa no dia a dia. Onde só
cabe um nome curto (eixo de gráfico), vale o do primeiro Produto que tem iteração.

Produto de fluxo contínuo não entra no agrupamento: ele é medido pela janela de
datas das Sprints unificadas dos demais.

**Implementado em:** `src/main/lib/sprint-utils.ts` e
`src/main/services/azure/unified-sprints.ts`

### RN-GLB-05 · De onde vêm as iterações

**Sem `team`** na Configuração, as sprints do Produto são lidas da **árvore de
classificação de iterações do projeto** (`classificationnodes`), e não das
iterações atribuídas ao backlog de um time.

A diferença importa: uma sprint criada no Azure mas ainda não atribuída ao time
existe no projeto e **precisa aparecer**. Com o endpoint de time, ela sumia.

**Com `team`**, valem as iterações atribuídas a esse time (`teamsettings`). É o jeito
de separar Produtos que dividem o mesmo projeto e a mesma árvore de iterações — e
quem escolhe esse caminho aceita que uma sprint só aparece depois de atribuída.

Nos dois casos, só entram iterações com data de início e de fim; nós de
agrupamento são ignorados.

**Implementado em:** `src/main/services/azure/iterations.ts`

### RN-GLB-06 · Qual sprint aparece primeiro

A lista é ordenada da mais recente para a mais antiga, e a **âncora** (a sprint que
aparece selecionada) segue esta ordem de decisão:

1. A sprint **em curso** — aquela cujo período contém a data de hoje.
2. Se hoje cai num intervalo entre sprints, depende da tela:
   - **Telas de Review** ancoram na **sprint passada mais recente** — quem está
     analisando quer o resultado do que acabou.
   - **Planning** ancora na **próxima sprint** — quem está planejando quer o que vem.

Nas telas de Review, a lista é a âncora e as sprints **anteriores**. No Planning, a
âncora e as **seguintes**, da mais próxima para a mais distante (`RN-PLN-01`).

**Implementado em:** `src/main/lib/sprint-utils.ts` (parâmetro `preferFuture`)

---

## Tempo

### RN-GLB-07 · Horas úteis

Toda duração exibida pelo sistema é contada em **horas úteis**, nunca em horas
corridas. Um item aberto na sexta às 16h e fechado na segunda às 9h levou **2
horas**, não 65 (com o expediente do exemplo abaixo).

O que é hora útil vem do `calendar` da Configuração:

- **Expediente** (`workingHours`): faixas do dia em que se trabalha, com o almoço
  de fora. Ex.: 08:00–12:00 e 13:00–17:00 dão **8 horas úteis por dia**. Só conta o
  trecho de cada duração que cai dentro dessas faixas.
- **Sábados e domingos não contam**, em qualquer país.
- **Feriados não contam:**
  - **nacionais**, calculados pelo app quando `country` é `"BR"` (o único país
    embutido na v1). Valem para qualquer ano, sem manutenção: os fixos por data e
    os móveis a partir da Páscoa (Carnaval segunda e terça, Sexta-feira Santa e
    Corpus Christi). Carnaval e Corpus Christi são ponto facultativo federal, não
    feriado de lei, mas entram porque quase todo expediente para nesses dias;
  - **extras** (`extraHolidays`), para estaduais, municipais e emendas: de data
    única (`"date": "2026-11-20"`) ou recorrentes todo ano (`"monthDay": "08-12"`).
    Quem está fora do Brasil omite `country` e lista aqui os feriados nacionais do
    seu país.

Acrescentar um feriado muda a história: **todas as durações que atravessam o dia
encolhem** pelo expediente dele — lead time, SLA e tempo por estado. Os números
antigos mudam, e mudam para o valor correto.

A régua da sprint da Daily usa o mesmo calendário para marcar os feriados
(`RN-DLY-17`).

**Implementado em:** `src/shared/calendar.ts` (calendário) e
`src/shared/business-hours.ts` (soma das horas)

---

## Work items

### RN-GLB-08 · Tipos considerados

Só entram nas métricas os tipos listados em `workItemTypes` do **Perfil de
processo** do Produto. Qualquer outro tipo é ignorado. Os nomes precisam bater
exatamente com os do Azure.

Os presets partem dos processos padrão: `Product Backlog Item` e `Bug` no Scrum,
`User Story` e `Bug` no Agile. Processo herdado com tipos próprios acrescenta os
seus.

Itens em estado de descarte (`removedStates`, como `Removed`) ficam fora de todas as
contagens.

**Implementado em:** `src/shared/config/schema.ts` (`processProfileSchema`) e
`src/shared/config/presets.ts`

### RN-GLB-09 · Tipos que contam como desenvolvimento

Para a métrica de foco em desenvolvimento, contam como "desenvolvimento" os tipos
em `developmentTypes` do Perfil de processo — por padrão, o tipo de backlog do
processo (`Product Backlog Item` ou `User Story`).

Bug e trabalho não planejado **não** contam — são trabalho legítimo, mas não são
construção de produto. É essa separação que dá sentido ao indicador.

**Implementado em:** `src/main/services/azure/dev-focus.ts`

### RN-GLB-10 · Cores dos tipos de work item

| Tipo                   | Cor                |
| ---------------------- | ------------------ |
| Bug                    | `#CC293D` vermelho |
| Product Backlog Item   | `#009CCC` azul     |
| Tipo fora desta tabela | `#94A3B8` cinza    |

Estas cores **não pertencem à identidade do app** — são o padrão do Azure DevOps, e
quem usa o Azure já as lê sem legenda. Valem apenas dentro de gráficos e tabelas de
work item; o restante da interface usa a cor de destaque da Configuração.

A tabela do código ainda reconhece alguns tipos de processo herdado com cor própria
(`Tech Debt`, `Ad Hoc`, `Usability`, entre outros). Tipo que ela não conhece, como
`User Story`, fica cinza.

**Implementado em:** `src/renderer/src/theme/index.ts` (`workItemColor`)

### RN-GLB-14 · Cores dos estados de work item

A etiqueta de estado usa a cor da **categoria** do estado no Azure DevOps, só para
os estados padrão dos processos Basic, Agile, Scrum e CMMI:

| Categoria    | Estados                                          | Cor     |
| ------------ | ------------------------------------------------ | ------- |
| Proposto     | `New` · `To Do` · `Approved` · `Proposed`        | cinza   |
| Em andamento | `Active` · `Committed` · `Doing` · `In Progress` | azul    |
| Resolvido    | `Resolved`                                       | laranja |
| Concluído    | `Done` · `Closed`                                | verde   |
| Removido     | `Removed`                                        | cinza   |

Estado criado pelo time (um `Testing` ou `Rework`, por exemplo) fica **cinza**: o
app não adivinha o que ele significa. O que cada estado significa para as métricas
vem do Perfil de processo, não da cor.

**Implementado em:** `src/renderer/src/components/StateTag.tsx`

### RN-GLB-11 · Estados que significam "entregue"

Um item é considerado entregue quando entra em um dos `deliveredStates` do Perfil
de processo: `Done` no preset Scrum, `Closed` no preset Agile. Vale a **primeira
vez** que o item entrou em qualquer um deles.

`terminalStates` é mais largo: são os estados em que o item deixou de estar ativo —
entregue, fechado ou removido — e precisa conter todos os `deliveredStates`.

**Implementado em:** `src/shared/config/schema.ts` e
`src/main/services/azure/sprint-delivery.ts`

---

## Complexidade

### RN-GLB-12 · Conversão de story points em horas

A tabela `storyPoints` da Configuração converte pontos de complexidade em horas: a
chave é a quantidade de pontos e o valor, as horas. Um Perfil novo nasce com esta
tabela, que o PO ajusta à escala do seu time:

| SP        | 1   | 2   | 3   | 5   | 8   | 13  |
| --------- | --- | --- | --- | --- | --- | --- |
| **Horas** | 2   | 4   | 8   | 16  | 32  | 56  |

A tabela pode ter só os valores oficiais da escala (Fibonacci, por exemplo). Pontos
fora dela existem porque **o rateio de itens remanescentes gera pontos fora da
escala** — um item de 8 SP a 50% vira 4 SP — e são tratados pela `RN-GLB-13`.

### RN-GLB-13 · Complexidade fora da tabela

Para valores que não estão na tabela — fracionários, entre duas entradas ou acima
da maior — o sistema **interpola** entre as âncoras vizinhas, em vez de retornar
zero:

- Abaixo da menor entrada: proporcional a ela.
- Entre duas entradas: interpolação linear entre elas.
- Acima da maior entrada: extrapolação pela inclinação do último trecho. Por isso o
  schema exige ao menos duas entradas (`RN-CFG-01`).

Sem isso, um remanescente de 4,5 SP valeria zero hora e sumiria do cálculo de
capacidade.

**Implementado em:** `src/shared/story-points.ts`

---

## Perfil de demonstração

### RN-GLB-15 · Perfil de demonstração

Quem abre o app pela primeira vez pode escolher **"Explorar com dados de exemplo"**
em vez de criar um Perfil. Nasce então um **Perfil de demonstração**: um Perfil cujo
Azure é o fictício, alimentado pelo Cenário `vitrine` (`docs/cenarios.md`). Ele não
tem PAT nem rede (`RN-SEC-27`).

- **A Configuração vem do Cenário.** Ela é gravada na pasta do Perfil, como a de
  qualquer outro, e pode ser editada; vale a última versão válida (`RN-CFG-07`).
- **Os Dados de trabalho começam vazios** e funcionam como num Perfil real
  (capacidade, itens manuais do Planning).
- **Uma faixa "Dados fictícios de demonstração" fica sempre visível** no topo, com
  dois caminhos: sair da demonstração e **"Restaurar demonstração"**, que apaga os
  Dados de trabalho e regrava a Configuração do Cenário.
- **Um Perfil com Azure de verdade, no máximo** (ADR 0002). Sem ele, a saída da
  faixa é **"Conectar ao meu Azure"**, que cria o Perfil. Com ele, é **"Voltar para
  o meu Perfil"**: criar um segundo deixaria o primeiro sem caminho de volta, já que
  a v1 não tem seletor de Perfis. Do Perfil real, **"Explorar com dados de
  exemplo"**, no menu da conta, entra na demonstração.
- **A tela do PAT não aparece**, e o item mostra o ID sem link para o Azure.
- **Criar o Perfil com o próprio Azure não apaga a demonstração.** O Perfil novo
  passa a ser o ativo, e a demonstração continua na lista de Perfis, com os Dados de
  trabalho dela.
- O pedido para a IA do PO funciona como num Perfil real (`RN-SEC-24`), com as
  descrições fictícias do Cenário.

**Implementado em:** `src/main/demo/demo-profile.ts` · `src/main/profile/profile-store.ts` ·
`src/renderer/src/components/DemoBanner.tsx`

### RN-GLB-16 · Datas da demonstração andam com o calendário

O Cenário é gravado com uma data de referência, o "hoje" dele. Na demonstração,
**todas as datas do Azure fictício são deslocadas em semanas inteiras**, até a
semana da data de referência cair na semana de hoje. Assim a sprint corrente do
Cenário é sempre a sprint corrente de quem abre o app.

Semanas inteiras preservam o dia da semana: dia útil continua dia útil, e o horário
de cada mudança de estado é o mesmo. O que não acompanha o deslocamento são os
feriados: o calendário é o do ano real, então um feriado pode cair numa sprint da
demonstração que, no Cenário, não tinha nenhum.

Quem compara a tela com o Cenário vê datas diferentes. Isso é esperado. A
regressão das telas (`npm run test:regression`) **não desloca nada**: roda na data
de referência.

**Implementado em:** `src/main/demo/demo-profile.ts` (`shiftWeeks`, `shiftAzureState`)
