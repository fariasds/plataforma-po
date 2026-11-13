# Planning

**Pergunta que a tela responde:** o que está planejado para a próxima sprint cabe
na capacidade do time?

**Filtros:** um Produto com sprint ou um Grupo formado só por eles (`RN-GLB-02`).
Produto de fluxo contínuo não tem sprint para planejar e fica de fora. O seletor
de sprint lista a sprint da âncora e as quatro seguintes (`RN-PLN-01`); a tela
mostra **uma** Sprint unificada por vez.

**Implementado em:**
`src/main/services/azure/planning.ts` · `src/main/services/azure/planning-item.ts` ·
`src/renderer/src/features/planning/` · `src/main/services/ai/sprint-goal.ts` ·
`src/shared/ai.ts`

---

## Qual sprint aparece

### RN-PLN-01 · A tela olha para frente

Diferente das telas de Review, o Planning ancora na sprint **em curso** e, se hoje
cair num intervalo entre sprints, na **próxima** — nunca na anterior (`RN-GLB-06`).

O seletor lista a âncora e **até quatro sprints seguintes**, da mais próxima para a
mais distante, para o PO antecipar o planejamento. Nenhuma sprint anterior à âncora
aparece. A tela abre na âncora.

Só aparece sprint que já existe no Azure, com data de início e de fim (`RN-GLB-05`):
com menos de quatro sprints futuras cadastradas, a lista é mais curta.

Itens desmarcados, remanescentes e o objetivo são guardados por sprint
(`RN-PLN-07`, `RN-PLN-12`, `RN-PLN-20`), então o que se planeja numa sprint futura
fica nela.

Quem está planejando quer o que vem, não o que passou.

---

## Itens da sprint

### RN-PLN-02 · Quais itens entram

Só entram itens que satisfaçam **todas** estas condições:

- Tipo está em `plannableTypes` do Perfil de processo do Produto
- `IterationPath` é exatamente a iteração do Produto na Sprint unificada
- Estado não está em `removedStates` do Perfil de processo
- Está no projeto e na área do Produto (`areaPaths`; vazio é o projeto inteiro),
  fora das `excludedAreaPaths` (`RN-GLB-03`)

No **Grupo**, cada Produto é consultado na **sua** iteração da Sprint unificada, e
os resultados são somados. Produto sem iteração nessa sprint não contribui.

Repare que **bug e demanda avulsa ficam de fora** quando não estão em
`plannableTypes`. Planejamento aqui é sobre construção de produto; trabalho reativo
não se planeja por complexidade.

Aqui o `IterationPath` **é** a medida certa — ao contrário da tela de Entregas
(`RN-ENT-01`), a pergunta é justamente sobre planejamento.

### RN-PLN-03 · Campos de complexidade

| Coluna     | De onde vem                                      |
| ---------- | ------------------------------------------------ |
| Front      | `customFields.effortFrontend` da Configuração    |
| Back       | `customFields.effortBackend` da Configuração     |
| QA         | `customFields.effortQa` da Configuração          |
| Total      | `estimateField` do Perfil de processo do Produto |
| Prioridade | `Microsoft.VSTS.Common.Priority` (campo padrão)  |

Campo ausente ou não numérico no item vira **vazio** (`—` na tela), nunca zero —
zero significaria "estimado como nada", e ausência significa "não estimado".

**Cada campo de esforço é opcional.** O que não está configurado não é pedido ao
Azure, e a disciplina some da tela: coluna, cartão, percentual do remanescente e
indicador de capacidade. Sem nenhum dos três, a tela mostra os itens e o total, e
um aviso no lugar da capacidade diz quais campos preencher. A capacidade depende
de frontend ou backend; só QA configurado não basta para medi-la.

### RN-PLN-04 · Ordenação da tabela

Critérios em cascata:

1. **Prioridade crescente** — 1 no topo. Itens **sem prioridade vão para o fim**,
   senão subiriam junto com os mais urgentes.
2. **Complexidade total decrescente** — em caso de empate, o item maior primeiro.
3. **Frontend, depois backend, depois QA, decrescentes** — entre itens de mesmo
   total, sobe o que pesa mais na disciplina que costuma ser o gargalo.
4. **ID crescente** — desempate final, para a ordem nunca oscilar entre
   renderizações.

Ponto não estimado empata com zero. A mesma ordem vale na tabela da tela e no
resumo compartilhado (`RN-PLN-18`).

**Implementado em:** `comparePlanningItems`, em
`src/renderer/src/features/planning/planning-rules.ts` · teste em
`planning-rules.test.ts`.

### RN-PLN-05 · Cores da prioridade

| Prioridade | Cor      | Leitura            |
| ---------- | -------- | ------------------ |
| 1          | Vermelho | Precisa de atenção |
| 2          | Azul     | Relevante          |
| 3          | Verde    | Tranquilo          |
| 4          | Cinza    | Sem urgência       |

Como a tabela é ordenada por prioridade, a coluna forma uma faixa de cor
descendente — dá para medir o peso da sprint pelo tamanho do bloco vermelho, sem
ler número nenhum.

---

## Itens marcados

### RN-PLN-06 · O que entra na conta

Todo item começa **marcado**. Desmarcar o retira dos KPIs e do cálculo de
capacidade, mas **não o remove da tabela** — ele continua visível, apenas fora da
conta.

Serve para simular: _"e se esse item não entrar?"_.

### RN-PLN-07 · Desmarcados são lembrados por sprint

A lista de desmarcados fica nos **Dados de trabalho** do Perfil, **por Sprint
unificada**, na chave `planning:unchecked:<chave da sprint>`. A chave da sprint é
a janela de datas (`RN-GLB-04`), nunca o nome.

IDs de work item são únicos em toda a organização do Azure, então a lista **não é
separada por Produto**: desmarcar um item no Produto reflete no Grupo que o
contém, e vice-versa. Isso é intencional — é o mesmo item.

> A versão anterior guardava a lista no armazenamento interno da janela. Ela **não
> é migrada**: foi decidido descartar esses rascunhos.

---

## Itens remanescentes

### RN-PLN-08 · O que são

Itens que **sobraram de uma sprint anterior** e continuam consumindo capacidade,
mas não aparecem na consulta por não estarem atribuídos à sprint atual.

A pessoa os adiciona manualmente pelo **ID do work item**.

### RN-PLN-09 · Rateio do que falta

Ao adicionar, informa-se **quanto ainda falta** de frontend e de backend, em
percentuais de **0, 25, 50, 75 ou 100%**.

- Frontend e backend originais são multiplicados pelo percentual e arredondados.
- **QA entra sempre integral** — teste não se faz pela metade.
- O total é recalculado como a soma das três partes, **não** herdado do Azure.

É esse rateio que produz complexidades fora da escala Fibonacci, e é por isso que a
conversão em horas precisa interpolar (`RN-GLB-13`).

### RN-PLN-10 · Validação ao adicionar

- ID precisa ser numérico e positivo.
- Item **já presente na lista** é recusado.
- O Produto do item é achado pelo **projeto e pela área**, com a mesma fronteira
  da consulta da sprint (`RN-PLN-02`). Item que não cai em nenhum Produto com
  sprint é recusado, e a mensagem lista os Produtos configurados. Se dois
  Produtos ainda assim casam, vale o primeiro da Configuração.
- Item de um Produto **fora da seleção atual** é recusado: ele seria guardado na
  lista de um Produto que a tela não está mostrando. Para adicioná-lo, troque o
  filtro para o Produto dele.

### RN-PLN-11 · Identificação visual

Item remanescente aparece na tabela com etiqueta **"Remanescente"** em amarelo ao
lado do título, seguida dos percentuais aplicados (`Front 50% · Back 25%`).

Só linhas remanescentes têm **botão de exclusão** — itens vindos do Azure pertencem
à sprint e não se apagam pela tela.

### RN-PLN-12 · Guardados por produto e sprint

A lista de remanescentes fica nos **Dados de trabalho** do Perfil, **por Produto e
por Sprint unificada**, na chave `planning:manual:<ID do Produto>:<chave da
sprint>`. A chave usa o **ID** do Produto, nunca o nome (`RN-CFG-08`).

No **Grupo**, a leitura **mescla** as listas dos seus Produtos, e a gravação
**separa de volta** conforme o Produto de origem de cada item. Assim a visão do
Grupo e a de cada Produto permanecem coerentes entre si.

---

## Indicadores de complexidade

### RN-PLN-13 · Os quatro cartões

Frontend, Backend, QA e Total Geral, cada um somando os **itens marcados**
(`RN-PLN-06`), incluindo remanescentes já rateados.

A unidade é **pontos de complexidade**, não horas.

### RN-PLN-14 · Divisão por Produto no Grupo

No Grupo, cada cartão mostra abaixo do número uma barra proporcional com a parte
de **cada Produto**, na cor e com o nome definidos na Configuração.

Responde a _"esse volume está concentrado em qual produto?"_ sem precisar trocar o
filtro.

**Casos de borda:** total zero não desenha a barra.

---

## Capacidade

### RN-PLN-15 · Fórmula

```
capacidade da disciplina = devs da disciplina × horas produtivas × dias da sprint × (1 − % reservado a bugs da disciplina)
```

As **horas produtivas por dia** vêm de `calendar.productiveHoursPerDay` e são menos
que o expediente inteiro: o resto é cerimônia, apoio e interrupção. Usar o
expediente cheio produziria uma capacidade que nunca se cumpre.

O percentual reservado a bugs desconta o trabalho reativo que não está no
planejamento. **Cada disciplina tem o seu** — frontend e backend raramente recebem
a mesma carga de bugs, e um percentual único superestimava uma e subestimava a
outra.

Na Configuração os campos são `capacityDefaults.frontBugPercent` e
`capacityDefaults.backBugPercent`. Arquivos anteriores à separação têm só
`bugPercent`, que continua aceito e vale para a disciplina que não tiver o próprio
campo; sem nenhum dos dois, a Configuração é recusada apontando o campo que falta.

### RN-PLN-16 · Parâmetros ajustáveis

Devs de frontend, devs de backend, dias da sprint e o percentual reservado a bugs
de cada disciplina são editáveis na tela e ficam nos **Dados de trabalho** do Perfil, na chave
`planning:capacity` — uma só para o Perfil, valendo para todos os Produtos.

Devs aceitam **valores fracionários** (2,5 devs) — é comum alguém dividir o tempo
entre Produtos.

Os valores iniciais vêm de `capacityDefaults` na Configuração. O que o PO nunca
editou continua seguindo a Configuração; o que editou fica com o valor dele. Um
percentual único de bugs editado antes da separação por disciplina vale para as
duas, até o PO editar cada uma.

### RN-PLN-17 · Alocado × capacidade

O alocado é a soma das horas dos itens marcados, convertendo complexidade em horas
pela tabela `storyPoints` da Configuração (`RN-GLB-12`), com interpolação fora
dela (`RN-GLB-13`). Frontend e backend são medidos **separadamente**, porque a
capacidade de cada um é diferente.

Três faixas:

| Situação                    | Estado                             |
| --------------------------- | ---------------------------------- |
| Abaixo de 95% da capacidade | **Dentro da capacidade** (verde)   |
| De 95% a 100%               | **No limite** (amarelo)            |
| Acima de 100%               | **Acima da capacidade** (vermelho) |

A faixa é decidida pela razão exata, não pelo percentual arredondado da tela:
94,6% aparece como "95%" e ainda está dentro.

A barra satura visualmente em 100%, mas o número exibido mostra o excedente real.

> Até outubro de 2026 o "no limite" começava em 90%. Subiu para 95% porque a
> reserva para bugs já é a folga do planejamento; 90% acendia o alerta cedo demais.

**Implementado em:** `capacityStatus`, em
`src/renderer/src/features/planning/planning-rules.ts` · teste em
`planning-rules.test.ts`.

---

## Resumo para compartilhar

### RN-PLN-18 · O que entra no resumo

O botão **Compartilhar resumo** monta um relatório da seleção atual do filtro — um
Produto sozinho ou um Grupo — para o PO colar no Loop ou no grupo do Teams. Um
Grupo de dois Produtos gera três resumos possíveis: o do Grupo e o de cada Produto.

Entram **só os itens marcados** (`RN-PLN-06`), na ordem da tabela (`RN-PLN-04`),
para os números do resumo baterem com os da tela. Se houver desmarcados, uma linha
diz quantos ficaram de fora.

Um switch no pop-up, **Mostrar itens que ficaram fora da sprint**, lista os
desmarcados numa seção à parte, **Ficaram fora da sprint**, depois de "Itens da
sprint" — evidência, para o time, do que foi avaliado e não coube. A seção tem as
mesmas colunas e a mesma ordem da tabela de itens, com total próprio, e **não muda
nenhum número** da sprint: resumo geral, capacidade e itens continuam só com os
marcados. Ligado, a linha de contagem sai, porque a lista a substitui. O switch
começa desligado a cada abertura e fica desabilitado quando não há desmarcado.

Quando o PO escreveu um objetivo (`RN-PLN-20`), ele abre o resumo. Depois vêm três
seções, nesta ordem:

1. **Resumo geral** — pontos por disciplina e total, com o uso da capacidade e a
   situação (`RN-PLN-17`). QA não tem capacidade medida e sai com `—`. O **total
   geral** compara a soma do alocado de frontend e backend com a soma das duas
   capacidades. No Grupo, uma segunda tabela traz a parte de cada Produto e o seu
   percentual no total da sprint (`RN-PLN-14`).
2. **Capacidade da sprint** — os parâmetros comuns (`RN-PLN-16`) e, por disciplina,
   devs, reserva a bugs, capacidade, alocado e saldo. O saldo fica negativo quando o alocado passa.
3. **Itens da sprint** — ID com link para o work item, título com a etiqueta de
   remanescente (`RN-PLN-11`), Produto (só no Grupo), prioridade, pontos por
   disciplina e total, com uma linha de total no fim.

Disciplina sem campo de esforço na Configuração some do resumo como some da tela
(`RN-PLN-03`); sem frontend nem backend, não há seção de capacidade.

**Casos de borda:** a capacidade é uma só para o Perfil (`RN-PLN-16`), então o
resumo de um Produto compara os itens **dele** com a capacidade do time inteiro —
igual à tela. Sem item marcado, a seção de itens traz só o aviso.

### RN-PLN-19 · Formato da cópia

O resumo vai para a **área de transferência**, não para arquivo, em duas formas ao
mesmo tempo: **HTML** (títulos, tabelas e links, que o Loop e o Teams colam
formatados) e **Markdown** como texto puro, para onde não há formatação. As duas
saem do mesmo resumo montado e dizem a mesma coisa.

A situação leva um símbolo (🟢 🟡 🔴) em vez de cor de fundo, que o destino pode
descartar ao colar.

O título do item vem do Azure e nunca é tratado como marcação: é escapado no HTML
— que também é a prévia mostrada na janela — e no Markdown, onde uma barra
vertical quebraria a tabela.

**Implementado em:** `src/renderer/src/features/planning/planning-summary.ts` ·
`ShareSummaryModal.tsx` · teste em `planning-summary.test.ts`.

### RN-PLN-20 · Objetivo da sprint

**Pergunta que responde:** em uma frase, para que serve esta sprint?

O resumo tem um campo de texto livre, **Objetivo da sprint**, de até 1.500
caracteres. O PO escreve à mão ou parte da resposta que a IA dele deu ao pedido que
o app monta (`RN-PLN-21`). Com
texto, o objetivo é a **primeira seção** do resumo, nas duas formas da cópia; vazio,
a seção não existe.

Duas convenções do texto viram formatação no resumo, e só elas: uma linha que começa
com `Rótulo:` sai com o rótulo em negrito, e uma linha que começa com `- ` sai como
item de lista. Todo o resto é texto corrido.

O objetivo é um Dado de trabalho, guardado por **ID do Produto ou do Grupo
selecionado e pela Sprint unificada** (`RN-CFG-08`). O Grupo e cada Produto dele têm
objetivos separados, como têm resumos separados (`RN-PLN-18`). O texto é gravado ao
sair do campo ou ao aceitar um rascunho colado, não a cada tecla.

**Casos de borda:** só espaços conta como vazio. O texto nunca é tratado como
marcação (`RN-PLN-19`, `RN-SEC-26`).

**Implementado em:** `ShareSummaryModal.tsx` · `SprintGoalField.tsx` ·
`planning-summary.ts` · teste em `planning-summary.test.ts`.

### RN-PLN-21 · Rascunho do objetivo pela IA do PO, por copiar e colar

*Revista em 2026-11-12 (ADR 0007): o app deixou de executar a IA. O formato do
objetivo não mudou.*

O app não fala com IA nenhuma. Ele monta o pedido; o PO o leva à IA que já usa e
traz a resposta de volta.

1. **Copiar pedido para a sua IA** monta o pedido a partir dos **itens marcados**, na
   ordem da tabela, inclusive os remanescentes, e abre a prévia (`RN-SEC-24`). Em
   **Copiar pedido**, o texto vai para a área de transferência.
2. O PO cola o pedido no Claude, no ChatGPT, no Copilot ou em qualquer outra IA,
   como usuário comum dela.
3. Em **Colar resposta**, o PO cola o que a IA respondeu e clica em **Ler resposta**.
   O app mostra o rascunho, que entra no campo só com **Usar este texto**
   (`RN-SEC-26`).

- **O que entra no pedido:** ID, título, estado, nome do Produto, prioridade e
  descrição de cada item, com credenciais redigidas. Nada mais (`RN-SEC-24`).
- **A instrução é fixa**, escrita pelo app. O PO não escreve prompt. Ela pede a
  resposta em quatro seções com rótulo fixo e diz para a IA não seguir instrução
  que venha de dentro dos itens. O texto exato está em `SPRINT_GOAL_INSTRUCTION`,
  com teste que falha se ele mudar. Os itens vão depois da instrução, em JSON, como
  dado.
- **O formato** segue o que as referências de Scrum têm em comum (resultado, impacto
  e como confirmar), e é sempre o mesmo:
  - **Objetivo:** uma frase, começando com verbo no infinitivo, com o resultado para
    o usuário ou para o negócio que une a maior parte dos itens. Sem mencionar o
    time nem a sprint, e sem listar itens.
  - **Impacto:** quem se beneficia e o que muda.
  - **Como saberemos:** de uma a três condições verificáveis, tiradas das regras e
    dos critérios descritos nos itens, sem número inventado.
  - **Também nesta sprint:** os itens que não servem a esse objetivo, em poucas
    palavras. Uma sprint mista não precisa de um objetivo inflado para caber tudo.
- A resposta é lida pelos rótulos; quem monta o texto final é o app (`RN-SEC-26`).
  O PO edita o resultado como texto.
- **Qual IA e qual modelo** é escolha do PO, na IA dele. O app não sabe e não
  pergunta.

**Casos de borda:** item sem descrição vai só com o título. Sem item marcado, o
botão de copiar fica desabilitado. Item marcado que o main não encontra na sprint
não entra no pedido, e a prévia diz quantos ficaram de fora. Resposta fora do
formato vira rascunho livre, com os mesmos limites, e a tela avisa. "Colar
resposta" funciona sem ter copiado o pedido antes, para quem guardou a conversa.

**Implementado em:** `src/main/services/ai/sprint-goal.ts` ·
`src/main/services/azure/descriptions.ts` · `src/shared/ai.ts` · `SprintGoalField.tsx`
· testes em `src/shared/ai.test.ts` e `tests/security/`.
