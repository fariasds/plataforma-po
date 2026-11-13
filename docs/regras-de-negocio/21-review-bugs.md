# Review › Análise de Bugs

**Pergunta que a tela responde:** estamos gerando mais ou menos bugs ao longo do
tempo, onde eles estão travados agora, e estamos fechando dentro do prazo?

**Filtros:** produto (`RN-GLB-02`) e sprint (`RN-GLB-04`), mais quatro filtros
cruzados acionados por clique nos próprios gráficos (`RN-BUG-10`).

**Implementado em:**
`src/main/services/azure/bug-analysis.ts` · `src/main/services/azure/bug-state-time.ts` ·
`src/renderer/src/features/bug-analysis/`

---

## Universo de dados

### RN-BUG-01 · Que bugs entram

Itens do tipo `bugType` do Perfil de processo do Produto, no projeto do Produto,
sob qualquer um dos `areaPaths` (lista vazia = projeto inteiro) e fora dos
`excludedAreaPaths` (`RN-GLB-03`). Num Grupo, cada Produto é consultado com o seu
próprio Perfil de processo e os resultados são somados.

Bugs em `removedStates` ficam fora do histórico.

> **Mudou na versão genérica:** a tela de Bugs usa as **mesmas** exclusões de área
> das demais telas, as do Produto. Antes ela tinha uma lista própria, menor. Quem
> quer contar bugs de uma área que as outras telas excluem precisa tirar a área de
> `excludedAreaPaths`.

### RN-BUG-02 · Janela histórica

A tela busca duas janelas simultaneamente:

- **Por sprint:** as sprints do período selecionado (12 por padrão).
- **Por mês:** os **10 meses** que terminam no mês atual.

As duas alimentam o mesmo gráfico histórico, alternado pelo seletor Sprint/Mês.

### RN-BUG-03 · A qual sprint um bug pertence

Um bug pode aparecer em **duas** sprints, com significados diferentes:

| Chave | Significa |
|---|---|
| Sprint de criação | Sprint cujo período contém a **data de criação** do bug |
| Sprint de fechamento | Sprint cujo período contém a **data de conclusão**, quando houver |

A atribuição é feita **pelo período** (`RN-GLB-04`), não pelo `IterationPath`.

O histórico de "bugs criados" usa a sprint de criação. A lista da tela combina as
duas (`RN-BUG-09`).

### RN-BUG-04 · Bug ativo

Bug cujo estado **não** está nos `terminalStates` do Perfil de processo do seu
Produto.

### RN-BUG-05 · Criticidade

Vem do campo configurado em **`customFields.criticality`**. Pode ser um campo ou
uma lista: numa lista, vale o **primeiro campo preenchido**, na ordem da
Configuração (cobre o processo que trocou de campo no meio do caminho).

Cada projeto só é consultado pelos campos da lista que **existem nele**: o Azure
recusa a requisição inteira quando um campo pedido não existe, e Produtos em
projetos diferentes podem ter campos diferentes. Campo que não existe em nenhum
projeto do escopo equivale a campo não configurado.

O gráfico e a lista mostram o **valor do campo como está** — que pode trazer o
prazo no nome, como `Alta SLA - 16h`. A cor sai do **nível** em `criticality[]`:
o valor cai no primeiro nível cujo prefixo em `matches` ele começa, sem diferenciar
maiúsculas.

- **Cor do nível:** a `color` do nível na Configuração; sem ela, um tom do tema
  pela **posição** do nível na lista (o primeiro, mais grave, é o mais quente).
- Valor que não casa com nenhum nível, e bug sem criticidade preenchida (agrupado
  como **"Não informado"**), ficam cinza.
- **Sem campo configurado**, o gráfico de criticidade mostra um estado vazio
  dizendo o que configurar, em vez de uma barra única de "Não informado".

### RN-BUG-06 · Reincidência

Um bug é reincidente quando o **título contém o `recurrentBugTag`** da
Configuração (por exemplo `[reincidente]`) — comparação sem diferenciar
maiúsculas. Sem marcador configurado, a reincidência **não é medida** e o
indicador diz o que configurar.

É uma marcação **manual do time**, não uma detecção automática. O sistema apenas
conta o que foi marcado; se a marcação não for feita, a taxa fica subestimada.

**Taxa de reincidência** = bugs reincidentes ÷ total de bugs criados no período × 100.

---

## Indicadores

### Criados na sprint / no mês

- **Pergunta:** o volume de bugs está subindo ou descendo?
- **Regra (RN-BUG-07):** contagem de bugs **criados** no período — sprint
  selecionada ou mês atual, conforme o modo do gráfico histórico.

### Reincidência

- **Pergunta:** estamos consertando de verdade, ou o mesmo problema volta?
- **Regra:** a taxa da `RN-BUG-06` para o período, com a contagem absoluta abaixo.

### Bugs em tratamento

- **Pergunta:** qual é o passivo aberto agora?
- **Regra:** total de bugs ativos (`RN-BUG-04`). **Não depende do período
  selecionado** — é uma foto do presente, e por isso não muda ao trocar de sprint.

### Fechados no SLA

- **Pergunta:** estamos cumprindo o prazo combinado?
- **Regra (RN-BUG-08):** bugs com `ClosedDate` **anterior ou igual** ao `DueDate`,
  sobre o total de bugs que **têm ambas as datas**.
- **Casos de borda:** bug sem `DueDate` **não entra em nenhum dos dois lados** — não
  conta como cumprido nem como violado. Sem nenhum bug com `DueDate`, exibe
  "Nenhum bug com Due Date definido".
- A base muda conforme o filtro ativo: sprint selecionada, sprint clicada no
  histórico, ou mês.

---

## Lista combinada

### RN-BUG-09 · O que a lista mostra quando não há filtro

Sem filtro ativo, a lista **não** mostra apenas os bugs criados na sprint. Ela
combina três conjuntos, sem repetir:

1. Bugs **criados** na sprint selecionada
2. Bugs **fechados** nela, mas criados em sprints anteriores
3. Bugs **ainda ativos**, de qualquer época

A lógica é a de uma reunião de review: interessa o que nasceu, o que morreu e o que
continua aberto — não só o que nasceu.

---

## Filtragem cruzada

### RN-BUG-10 · Como os filtros interagem

Quatro filtros podem estar ativos, acionados por clique nos gráficos:

| Filtro | Acionado por |
|---|---|
| Sprint | Barra do histórico, modo Sprint |
| Mês | Barra do histórico, modo Mês |
| Criticidade | Barra ou legenda do gráfico de criticidade |
| Estado | Fatia ou legenda do donut |

Clicar de novo no mesmo item remove aquele filtro.

**As regras de convivência não são simétricas, e isso é intencional:**

- **Filtro de período** (sprint ou mês) **troca a base de dados**: passa a valer
  todo o histórico, e não mais a lista combinada da `RN-BUG-09`.
- **Criticidade** limpa período e estado — é uma pergunta nova.
- **Mês** limpa criticidade e estado.
- **Sprint** limpa criticidade **apenas se for uma sprint diferente da selecionada**.
- **Estado é independente** — não limpa nada e nada o limpa. Ele responde "onde está
  travado", pergunta que faz sentido combinada com qualquer outra.

O botão **Limpar filtros** devolve tudo ao estado inicial, inclusive o modo do
gráfico histórico.

---

## Gráficos

### RN-BUG-11 · Histórico de bugs criados

- **Pergunta:** a tendência de criação está piorando?
- **Regra:** barras com a contagem de bugs criados e linha com a taxa de
  reincidência, em eixos separados (a taxa é percentual, a contagem é absoluta).
- **Sempre 5 períodos**, os mais recentes, com o atual à direita. Vale nos dois
  modos.
- A barra do período filtrado fica destacada; as demais esmaecem.

### RN-BUG-12 · Criticidade

- **Pergunta:** a gravidade do que está entrando mudou?
- **Regra:** contagem de bugs **criados** no período visível, agrupados por
  criticidade (`RN-BUG-05`), ordenados do maior para o menor.
- O período visível segue o filtro ativo: sprint clicada, mês clicado, ou a sprint
  selecionada no topo.
- **Casos de borda:** sem bugs no período, mostra estado vazio.

> **Pendência conhecida:** a versão anterior do sistema exibia setas comparando com
> o período anterior. Isso não foi reconstruído.

### RN-BUG-13 · Bugs em tratamento por estado

- **Pergunta:** onde os bugs abertos estão parados?
- **Regra:** bugs ativos (`RN-BUG-04`) agrupados por estado atual, com percentual
  sobre o total ativo.
- As cores dos estados saem do tema pela **posição** do estado no `bugStateOrder`
  do Perfil de processo; estado fora da ordem vem depois, na ordem em que aparece.
  Nenhum nome de estado tem cor fixa.
- **Casos de borda:** nenhum bug ativo, mostra estado vazio.

---

## Tabela

### RN-BUG-14 · Conteúdo

| Coluna | Conteúdo |
|---|---|
| ID | Link para o Azure DevOps |
| Título | Precedido da etiqueta **REINC.** quando reincidente (`RN-BUG-06`) |
| Status | Estado atual, colorido pela regra compartilhada |
| Criticidade | Etiqueta com a cor da `RN-BUG-05` |
| Criação | Data e hora |
| Fechamento | Data e hora, ou `—`, seguida do ícone de SLA |

### RN-BUG-15 · Ícone de SLA

Aparece **apenas** quando o bug tem data de fechamento **e** `DueDate`:

- **Verde** quando fechado dentro do prazo.
- **Vermelho** quando excedeu, com o **excedente em horas úteis** (`RN-GLB-07`) no
  tooltip — não em horas corridas, para o número refletir tempo de trabalho.

### RN-BUG-16 · Título da lista

O cabeçalho descreve os filtros ativos, juntando-os com `·` — por exemplo
`Sprint 12 · Alta SLA - 16h · Em correção`. Sem filtro, mostra o nome da sprint
selecionada.

---

## Tempo por estado

### RN-BUG-17 · Horas em cada estado do bug

Usado pelo gráfico de tempo por estado da tela de Desempenho.

- **Regra:** para cada bug fechado, soma o tempo que ele passou em cada estado, em
  **horas úteis** do Calendário da Configuração (`RN-GLB-07`): feriados e fora do
  expediente não contam.
- O bug nasce no **primeiro estado do `bugStateOrder`** do Perfil de processo do
  seu Produto. O relógio para quando ele entra num dos `terminalStates`.
- O gráfico mostra só os estados do `bugStateOrder`, nessa ordem. Num Grupo, as
  ordens dos Perfis de processo se juntam, na ordem dos Produtos e sem repetir.
- A quebra por criticidade usa os níveis de `criticality[]` (`RN-BUG-05`); bug sem
  nível entra só na média geral.
