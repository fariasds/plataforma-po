# Review › Desempenho da Equipe

> **Status: construída, oculta na navegação.** A tela existe e funciona, mas foi
> retirada da barra de abas a pedido do PO até ser repensada. A rota continua
> registrada — devolvê-la à navegação é adicionar uma entrada em `SUB_TABS`
> (`src/renderer/src/components/AppLayout.tsx`).

**Pergunta que a tela responde:** o time está melhorando ao longo do tempo — em
prazo, em retrabalho, em fluxo e em foco?

**Filtros:** Produto ou Grupo de produtos (`RN-GLB-02`) e um seletor
**Sprint / Mês** compartilhado pelos quatro gráficos.

**O que vem da Configuração:** os níveis de criticidade (`criticality`), e, do
Perfil de processo de cada Produto, os tipos que contam (`workItemTypes`), os de
desenvolvimento (`developmentTypes`), o estado de desenvolvimento
(`inProgressState`) e a ordem dos estados do bug (`bugStateOrder`). Nenhum nome de
tipo, estado ou criticidade fica fixo no código.

**Implementado em:**
`src/main/services/azure/team-performance.ts` (composição) ·
`rework.ts` · `dev-focus.ts` · `bug-state-time.ts` ·
`src/renderer/src/features/team-performance/`

---

## Comportamento comum

### RN-DES-01 · Cinco períodos, atual à direita

Todos os quatro gráficos mostram os **5 períodos mais recentes**, do mais antigo à
esquerda para o atual à direita. O seletor Sprint/Mês troca os quatro de uma vez.

O histórico buscado é maior (12 sprints) porque a agregação mensal precisa dessa
profundidade para fechar os meses.

### RN-DES-02 · Falha parcial não derruba a tela

Dois dos quatro gráficos — **tempo médio em estado** e **foco em desenvolvimento** —
percorrem o histórico de revisões de **cada item**, o que os torna as consultas mais
lentas e mais sujeitas a falha.

Por isso eles são buscados de forma tolerante: se um falhar, **os outros três
continuam com dados reais** e a tela exibe um aviso nomeando o que não carregou.

A alternativa — derrubar a tela inteira porque um gráfico falhou — seria pior para
quem está conduzindo uma reunião.

---

## Entrega de SLA por criticidade

- **Pergunta:** estamos cumprindo o prazo, e para qual gravidade estamos falhando?
- **Regra (RN-DES-03):** percentual de bugs fechados dentro do prazo, calculado
  **separadamente por nível de criticidade**, em cada período. Uma linha por nível,
  na ordem em que a Configuração os lista (do mais para o menos grave).
- **Nível do bug:** o valor do campo de criticidade (`customFields.criticality`) cai,
  como na Análise de Bugs (`RN-BUG-05`),
  no primeiro nível de `criticality[]` que tenha um prefixo em `matches` casando com
  o começo do valor, sem diferenciar maiúsculas. Valor que não casa com nenhum
  nível fica fora do SLA.
- **Cor da linha:** a `color` do nível; sem ela, a cor da posição do nível.
- **Sem níveis configurados:** o gráfico mostra estado vazio dizendo o que
  configurar.
- **Base:** bugs que têm **data de fechamento e `DueDate`** (`RN-BUG-08`).
- **Período de atribuição:** o bug conta no período em que foi **fechado** — se não
  houver registro de fechamento por sprint, cai na sprint de criação.
- **Casos de borda:** criticidade sem nenhum bug no período **não desenha ponto**,
  em vez de desenhar zero. Zero significaria "falhamos em tudo"; ausência significa
  "não houve caso". Período sem nenhum bug com prazo é omitido do gráfico.

---

## Entregas e rework

- **Pergunta:** o volume entregue está vindo acompanhado de retrabalho?
- **Regra (RN-DES-04):** barras com o total de itens entregues no período, e linha
  com o **percentual dos que passaram por rework**.
- **Fonte:** o campo configurado em `customFields.reworkCount`, que conta quantas
  vezes o item voltou.
- **Sem o campo configurado:** o gráfico mostra estado vazio dizendo que falta
  `customFields.reworkCount`. Nunca mostra zero: sem o campo, o app não sabe se o
  item voltou.
- **Taxa de rework** = itens com pelo menos um retorno ÷ total entregue × 100.
- **Casos de borda:** período sem entregas tem taxa **nula**, não zero — zero diria
  "nenhum retrabalho", quando na verdade não houve o que retrabalhar.

> O serviço também calcula o **detalhamento por número de retornos** (quantos
> voltaram uma vez, duas, três). O dado existe no resultado mas **não é exibido**.

---

## Tempo médio em estado

- **Pergunta:** onde o fluxo trava?
- **Regra (RN-DES-05):** para cada bug **fechado** no período, mede-se quanto tempo
  ele passou em cada estado do ciclo de vida; o gráfico mostra a **média** por
  estado, empilhada.
- **Unidade:** horas úteis (`RN-GLB-07`).
- **Ordem dos estados:** a de `bugStateOrder` no Perfil de processo. É a ordem do
  ciclo, não a ordem de grandeza — a barra empilhada precisa contar a história na
  sequência em que ela acontece. Num Grupo com Perfis de processo diferentes, os
  estados se somam na ordem dos Produtos, sem repetir.
- **Cor do estado:** vem da posição do estado nessa ordem, não do nome.
- **Nível de criticidade do bug:** o mesmo classificador do SLA (`RN-BUG-05`), então
  os dois gráficos põem cada bug no mesmo nível.
- **Estados terminais não acumulam tempo**: a contagem para quando o bug chega a um
  estado de conclusão.
- **Filtro por criticidade:** uma pílula por nível de criticidade da Configuração
  recalcula o gráfico apenas com bugs daquele nível. Sem seleção, mostra a média
  geral. Sem níveis configurados, as pílulas não aparecem.
- **Casos de borda:** estado sem tempo registrado não aparece na pilha. Sem bugs
  fechados, o gráfico fica vazio.

---

## Foco em desenvolvimento

- **Pergunta:** quanto do esforço foi para construir produto?
- **Regra (RN-DES-06):** horas em progresso gastas em tipos de desenvolvimento
  (`RN-GLB-09`) ÷ total de horas em progresso × 100, por período.
- **Horas em progresso:** horas úteis (`RN-GLB-07`) em que o item esteve no
  `inProgressState` do Perfil de processo, recortadas à sprint. Item que nunca
  passou por esse estado conta da criação ao fechamento, também recortado.
- **Base:** itens dos tipos em `workItemTypes` na iteração do Produto na sprint.
  Num Grupo, as horas dos Produtos se somam antes da divisão; cada Produto usa o
  próprio Perfil de processo.
- **Diferença para o indicador da tela de Entregas:** aqui entram **todos os itens
  trabalhados** no período, não apenas os concluídos. Um item que consumiu a sprint
  inteira e não fechou conta aqui, e não lá.
- **Referência visual:** linha tracejada em **50%**, o patamar que o time usa como
  parâmetro de leitura.
- **Casos de borda:** período sem horas registradas resulta em **nulo**, não zero.
  Produto sem iterações (`cadence` diferente de `sprints`) não entra: não há sprint
  que recorte as horas. Uma sprint em que nenhum Produto do escopo tem iteração é
  omitida.

---

## Pendências conhecidas

### RN-DES-07 · Tooltips simplificados

A versão anterior tinha tooltips customizados: no SLA mostrava `3/5 (60%)` por
criticidade; no rework, quantos itens voltaram uma, duas ou três vezes.

A reconstrução usa os tooltips padrão da biblioteca de gráficos. Os dados
necessários **já estão disponíveis** no resultado — falta apenas a exibição.
