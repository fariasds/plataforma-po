# Daily

**Pergunta que a tela responde:** durante a sprint, quais itens estão em risco de
não entregar — e dá para agir enquanto ainda há tempo?

A dor que originou a tela: o time só descobria que um item não ia entregar na
sexta-feira da segunda semana, quando já não havia o que fazer.

**Filtros:** um Produto com sprints ou um Grupo formado só por eles (`RN-GLB-02`).
Não há seletor de sprint: a tela mostra sempre a **sprint corrente** — a Sprint
unificada mais recente (`RN-GLB-04`).

**O que vem da Configuração:** tipos, estados e campo de estimativa do Perfil de
processo de cada Produto; o Calendário (feriados e expediente); as horas produtivas
por dia; e, se existir, o campo de retrabalho. Nomes de estado aparecem abaixo pela
**chave** do Perfil de processo (`inProgressState`, `testingState` …), porque cada
PO dá o nome que o seu processo usa.

**Implementado em:**
`src/main/services/azure/daily.ts` · `src/renderer/src/features/daily/`

---

## Fundamento

### RN-DLY-01 · Duas réguas de dia, conciliadas em dias

Este é o ponto que sustenta a tela inteira, e o que mais facilmente produziria um
erro silencioso.

O sistema tem **duas definições de "um dia"**, ambas corretas no seu contexto:

| Régua                | Valor                                      | De onde vem                                          |
| -------------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Trabalho efetivo** | `calendar.productiveHoursPerDay`           | Tabela SP→horas e painel de capacidade (`RN-PLN-15`) |
| **Calendário útil**  | Soma das faixas de `calendar.workingHours` | `calcBusinessHours` — só o expediente (`RN-GLB-07`)  |

A estimativa nasce na primeira; o consumo é medido na segunda. **Comparar as horas
diretamente acusaria atraso em praticamente tudo**, na proporção entre as duas
réguas (com 6h produtivas num expediente de 8h, por volta de 33%) — de forma
sistemática, o que destruiria a confiança na tela.

A solução é converter as duas para **dias**, cada uma pela sua régua:

- **Estimativa em dias** = horas da tabela ÷ horas produtivas por dia
- **Consumo em dias** = horas úteis decorridas ÷ horas de expediente por dia

A estimativa é lida do campo `estimateField` do Perfil de processo. Exemplo, com 6h
produtivas e uma tabela em que 13 SP valem 60h: 13 SP = 60h ÷ 6 = **10 dias = uma
sprint de duas semanas inteira**.

| SP  | Horas | Dias |
| --- | ----- | ---- |
| 1   | 3h    | 0,5  |
| 3   | 12h   | 2    |
| 5   | 24h   | 4    |
| 8   | 36h   | 6    |
| 13  | 60h   | 10   |

**Consequência que orienta a leitura da tela**, com a tabela calibrada assim: nenhum
item, sozinho, é grande demais para a sprint. O risco nunca vem do tamanho — vem de **começar tarde** ou de **passar
da estimativa**.

A exceção é a sprint com feriado: ali o maior item deixa de caber, porque a sprint passa a
ter menos dias do que a estimativa pede. Ver `RN-DLY-17`.

### RN-DLY-02 · O que é "consumido"

Tempo **decorrido**, em horas úteis, entre a **primeira entrada no `inProgressState`** e o
fim do desenvolvimento (`RN-DLY-14`) — ou o momento atual, se o item ainda não chegou lá.

É a mesma definição do lead time da tela de Entregas (`RN-ENT-06`), o que mantém as
duas telas coerentes.

O valor é **arredondado para cima**: dia começado é dia gasto. Um item iniciado hoje
de manhã já conta 1 dia. A tela fala em dias inteiros, nunca em frações.

Três consequências que valem entender:

- **É decorrido, não somatório.** Item que sai e volta do `inProgressState` continua
  envelhecendo no intervalo. Para uma tela de risco isso é o certo: o calendário não
  para porque o item foi pausado.
- **Cobre desenvolvimento e teste.** A estimativa embute front, back e QA, então
  parar no fim do estado de desenvolvimento mediria menos do que a estimativa cobre — e um item travado
  no teste, que é clássico de fim de sprint, pareceria saudável.
- **Como é decorrido, cada item pode ser posicionado no calendário.** É isso que
  permite a linha do tempo.

### RN-DLY-03 · Onde a barra começa

| Situação              | Começa em                                          |
| --------------------- | -------------------------------------------------- |
| Iniciado ou concluído | O dia da sprint em que entrou no `inProgressState` |
| Não iniciado          | **Hoje** — é projeção, não histórico               |

Desenhar os não iniciados a partir de hoje é o que faz o item que já não cabe
**aparecer furando a borda direita da sprint**.

Item que começou **antes** da sprint (arrastado da anterior) é ancorado no dia 1.

---

## Itens

### RN-DLY-04 · Quais entram

Itens atribuídos à iteração do Produto na sprint corrente, fora dos `removedStates`,
dentro dos `areaPaths` do Produto e respeitando os `excludedAreaPaths` (`RN-GLB-03`).
Sem `areaPaths`, vale o projeto inteiro.

Entram **apenas os `plannableTypes`** do Perfil de processo — os mesmos do Planning
(`RN-PLN-02`). Bug e demais tipos ficam de fora: consomem tempo do time, mas não são
trabalho planejado por complexidade — sem estimativa, não há contra o que medir
risco, e a barra não teria o que dizer.

A lista vive num único lugar, o Perfil de processo, para Planning e Daily nunca
divergirem sobre o que é trabalho planejável. Num Grupo, cada Produto usa o Perfil
de processo dele.

Itens desses tipos que estejam **sem estimativa** entram como **sem estimativa**:
mostram há quantos dias estão abertos, em cinza, sem julgamento de risco.

### RN-DLY-05 · Contador de itens em andamento

O cabeçalho mostra quantos itens estão em andamento **ao mesmo tempo**.

Não é decoração. A estimativa assume o time com atenção normal no item; se houver
trabalho demais em paralelo, nenhum item recebe essa atenção e **todos estouram
juntos**. Nesse cenário o diagnóstico correto não é "estimamos mal", é "abrimos
frente demais" — e sem esse número os dois casos se confundem.

---

## Classificação de risco

### RN-DLY-06 · As situações

| Situação                   | Condição                                              | Cor                                              |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **No prazo**               | Dentro da estimativa e termina antes do fim da sprint | Destaque                                         |
| **No limite**              | Termina exatamente no último dia, sem margem          | Âmbar                                            |
| **Projeção fura a sprint** | Término projetado passa do fim da sprint              | Âmbar — salvo no `testingState`, ver `RN-DLY-19` |
| **Passou da estimativa**   | Já consumiu mais dias do que o estimado               | Vermelho                                         |
| **Sem estimativa**         | Item sem valor no `estimateField`                     | Cinza                                            |

### RN-DLY-19 · Aguardando teste abranda a projeção

Item no **`testingState`** do Perfil de processo cuja projeção fura a sprint é
desenhado com o **consumido na cor de destaque**, e não em âmbar — a mesma leitura
de "no limite". O main o classifica como `awaiting-test`.

O critério: no estado de teste o **desenvolvimento acabou** e o que resta é validação. A
projeção continua estourando no papel porque ela mede o trabalho estimado, mas a
realidade quase sempre desmente o alarme. Manter o âmbar treinaria o time a ignorar
a cor.

O **restante segue âmbar**. O destaque diz "vai entregar"; o âmbar preservado evita
fingir que não há aperto nenhum.

Consequência que importa para a leitura: esse item conta em **"Termina dentro da
sprint"**, não em "Projeção fura a sprint" (`RN-DLY-20`). As duas faixas são
disjuntas, e a régua para separá-las é a cor do preenchimento — o que a legenda
mostra é o que o filtro seleciona.

Só o `testingState` abranda. O `devDoneState` já é conclusão (`RN-DLY-14`), e um
estado de retrabalho é o oposto.

**Processo sem `testingState` (`null`) não tem esse abrandamento:** toda projeção
estourada é "Projeção fura a sprint". O ícone de ajuda desta regra só aparece quando
há na tela algum item abrandado — explicar um ajuste que não aconteceu seria
mobília.

### RN-DLY-20 · A legenda é o filtro

As faixas do topo classificam **e** filtram. Clicar filtra os três blocos; clicar de
novo remove — o mesmo gesto do filtro de responsável (`RN-DLY-15`), e os dois se
combinam.

Legenda e filtro dizem a mesma coisa: _"estas são as barras assim"_. Separá-los
obrigaria a pessoa a traduzir de uma lista para a outra.

**Consumido e restante estimado são um botão só.** Os dois desenham a mesma barra
na cor de destaque, e o que ela afirma é uma coisa só: este item termina dentro da sprint. Como
filtro, dois botões devolveriam o mesmo conjunto.

As quatro faixas **particionam** a lista — todo item cai em exatamente uma:

| Faixa                        | Quem entra                                              |
| ---------------------------- | ------------------------------------------------------- |
| **Termina dentro da sprint** | No prazo, no limite, e o aguardando teste (`RN-DLY-19`) |
| **Projeção fura a sprint**   | Estouro projetado que **não** está no `testingState`    |
| **Passou da estimativa**     | Já consumiu mais que o estimado                         |
| **Sem estimativa**           | Item sem estimativa                                     |

O número ao lado de cada faixa **ignora o filtro de faixa** e respeita o de
responsável. A explicação do gesto fica no ícone de ajuda da `RN-DLY-02`, ao lado da
legenda, que aparece sempre. Se ligar um filtro zerasse os outros contadores, a legenda deixaria de
servir para escolher o próximo — que é justamente para o que ela é olhada.

### RN-DLY-07 · Constatação vence projeção

Quando um item **já passou da estimativa** e a projeção **também** fura a sprint, ele
é classificado como _passou da estimativa_.

O critério: vermelho é fato consumado, âmbar é previsão. Mostrar a previsão por cima
do fato enfraqueceria o alerta mais duro.

### RN-DLY-08 · Projeção de término

A projeção **caminha a régua** a partir do dia de início — o real para itens
iniciados, **hoje** para os não iniciados — consumindo um dia de trabalho por casa e
**pulando os feriados** (`RN-DLY-17`). Sem feriado no caminho, o resultado é o mesmo
que `dia de início + estimativa − 1`.

A estimativa é arredondada **para cima**: meio dia de trabalho ainda ocupa um dia do
calendário.

Depois do fim da sprint não há calendário conhecido, e os dias seguintes são contados
como úteis. Se houver feriado logo após a sprint, o excedente reportado sai menor que
o real — erro na direção conservadora, e não o contrário.

**Como o excedente é dito:** quando o término projetado passa do fim da sprint, a
tela informa **quanto** passa, não em que dia cai — _"Excederá a sprint atual em 3
dias"_, no singular quando é um dia só.

O número absoluto do dia (_"termina no dia 13"_) exigia que quem lê fizesse a
subtração de cabeça para saber o tamanho do estouro, que é a informação que importa
na daily.

> **Limite conhecido:** a projeção assume que o item segue sendo trabalhado sem
> interrupção a partir de agora. Ela não prevê fila, dependência nem troca de
> prioridade — é o cenário otimista. Um item marcado como "cabe" pode não caber; um
> marcado como "não cabe" **certamente** não cabe.

---

## Blocos

### RN-DLY-09 · Três blocos, três perguntas

| Bloco             | Quem entra                                                  | Pergunta        |
| ----------------- | ----------------------------------------------------------- | --------------- |
| **Em andamento**  | Entrou no `inProgressState`, não terminou o desenvolvimento | Está no ritmo?  |
| **Não iniciados** | Nunca entrou no `inProgressState`                           | Ainda dá tempo? |
| **Concluídos**    | Terminou o desenvolvimento (`RN-DLY-14`)                    | Estimamos bem?  |

O bloco de **não iniciados é o mais valioso**. É onde o sistema consegue afirmar
_"este item não vai entregar"_ **antes** de alguém encostar nele — com tempo de tirar
do escopo ou dividir. É exatamente a informação que faltava.

No bloco de **concluídos**, a linha do tempo importa menos; o que interessa é o real
contra o estimado, insumo para calibrar estimativas futuras.

---

### RN-DLY-11 · Ordenação

**Maior complexidade total no topo**, em todos os blocos. O item grande é o que mais
ameaça a sprint e precisa ser o primeiro a ser olhado.

Itens sem estimativa vão para o fim. O ID desempata, para a ordem não oscilar entre
atualizações.

### RN-DLY-12 · Tasks do item

Cada item mostra um contador `concluídas/total` das suas tasks filhas, no mesmo
formato do card do Azure DevOps. Clicar abre a lista com o estado de cada uma.

- As tasks são as do `taskType` do Perfil de processo **na mesma iteração**,
  agrupadas pelo campo pai. Uma consulta por Produto, e não uma por item — a tela já
  é a mais cara do sistema.
- Contam como concluídas as que estão em qualquer um dos `terminalStates`: entregue,
  fechada ou removida, a task já não é trabalho pendente.
- Cada task mostra o **próprio responsável**, com foto, que pode ser diferente do
  responsável do item — é o caso comum de front, back e QA repartindo o mesmo item.
- **Os checkboxes são somente leitura.** O app lê o Azure e não escreve nele;
  permitir marcar daria a impressão de ter atualizado o Azure sem atualizar.
- Item sem tasks não exibe o contador.

### RN-DLY-13 · Responsável

Cada item mostra a foto e o nome de quem está com ele, vindos de `System.AssignedTo`.

**A foto exige o escopo `Graph (Read)` no PAT.** Sem ele, o app cai para as
**iniciais** numa cor derivada do identificador — a mesma pessoa recebe sempre a
mesma cor, e nada quebra.

Detalhe de implementação que custou tempo a descobrir: a URL de avatar que o Azure
devolve dentro do work item aponta para uma rota (`dev.azure.com/_apis/GraphProfile/
MemberAvatars/...`) que **recusa autenticação por PAT**, qualquer que seja o escopo.
A foto é obtida no endpoint documentado da Graph API, em outro host
(`vssps.dev.azure.com`), usando o mesmo _subject descriptor_.

A imagem é buscada **no processo principal** e atravessa o IPC já embutida como data
URI: o endpoint é autenticado, então o renderer não conseguiria carregá-la numa tag
`<img>` — e o PAT não sai do main.

O cache de fotos é **esvaziado sempre que o PAT muda**. Ele guarda também as falhas,
e sem isso um token novo com mais escopo herdaria os `null` do anterior — a foto
nunca voltaria a ser buscada.

### RN-DLY-14 · Fim do desenvolvimento

O desenvolvimento termina na **primeira ocorrência de qualquer um** destes estados
do Perfil de processo: o `devDoneState`, se houver, e os `deliveredStates`.

O `devDoneState` é o caminho normal, mas o item pode ir do estado de desenvolvimento
direto para a entrega, e nesse caso o desenvolvimento também acabou. Sem
`devDoneState`, o desenvolvimento termina na entrega.

Vale a **primeira entre todos**, não a primeira de cada: item que chega ao
`devDoneState` na terça e é entregue na quinta conta como concluído na terça, quando
o trabalho de fato terminou.

### RN-DLY-15 · Filtro por responsável

Entre a legenda e o primeiro bloco há uma fileira com as fotos das pessoas, mais
"Todos". Clicar filtra; clicar de novo remove.

**Quem aparece no filtro:** responsáveis de itens **e** de tasks, considerando os três
blocos.

**O que o filtro mostra** — um item pertence à pessoa quando:

- ela é a **responsável pelo item**, **ou**
- ela tem **alguma task** daquele item

A segunda condição é o que faz o filtro funcionar na prática: é comum o item ficar com
um responsável enquanto front, back e QA aparecem só nas tasks. Sem ela, quem
trabalha exclusivamente em tasks sumiria do próprio filtro.

**O filtro age nos três blocos** — em andamento, não iniciados e concluídos. A pergunta
que ele responde é _"o que é meu nesta sprint"_, e ela vale para o que ainda não
começou tanto quanto para o que está em curso.

### RN-DLY-16 · Identificação do produto

Quando a seleção é um **Grupo**, cada item exibe uma etiqueta com o nome do Produto
de origem, na cor daquele Produto na Configuração — a mesma do filtro de produto
(`RN-GLB-02`).

Na visão de um Produto só a etiqueta não aparece: seria repetir em cada linha o que
o filtro no topo já diz.

### RN-DLY-17 · Feriado ocupa casa e não entrega

A régua da sprint tem **uma casa por dia de semana** da janela — normalmente 10, as
duas semanas. **O feriado continua ocupando a sua casa**, marcado com `★` e fundo
cinza, e o cabeçalho passa a exibir quantos dias de fato produzem.

Apagar a casa do feriado seria o caminho fácil e o errado: a sprint pareceria ter 9
dias e **o dia perdido ficaria invisível** — exatamente a informação que precisa
aparecer.

Duas contagens convivem, e a distinção é o ponto da regra:

|                      | O que é                                    | Onde aparece                                         |
| -------------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Casas da régua**   | Dias de semana da janela, feriado incluído | Numeração da linha do tempo                          |
| **Dias de trabalho** | Casas menos os feriados                    | "N dias úteis · 1 feriado" e o "restam" do cabeçalho |

**A projeção pula as casas de feriado** (`RN-DLY-08`). É daí que vem a consequência
que mais surpreende:

> Um item de 13 SP (10 dias) iniciado no dia 1 fecha no dia 10 numa sprint sem
> feriado. Com **um** feriado, os mesmos 10 dias de trabalho terminam no dia 11 — e o
> item passa a **exceder a sprint em 1 dia**, sem que nada tenha mudado nele.

Não é o item que piorou: é a sprint que tem menos dias. Sem essa regra, a tela
prometeria uma entrega que o calendário não comporta.

O calendário de feriados é o mesmo do resto do sistema, o `calendar` da Configuração
(`RN-GLB-07`): os nacionais do país são calculados para qualquer ano, e os extras
(estaduais, municipais, emendas) vêm de `extraHolidays`. **Passar o mouse sobre a
casa do feriado mostra o nome dele**, e o cabeçalho diz em que dia cai e qual é.

### RN-DLY-18 · Retrabalho e estado, no item

Cada item exibe o **estado atual** do work item e, **quando maior que zero**, quantas
vezes voltou para retrabalho.

- **O estado** vem de `System.State` e usa a mesma etiqueta colorida das outras telas
  (`StateTag`). O bloco já diz a fase — em andamento, não iniciado, concluído — mas
  não diz onde dentro dela: aguardando teste e retrabalho são situações bem
  diferentes de "em andamento", e a diferença muda o que se pergunta na daily.
- **O retrabalho** vem do campo `customFields.reworkCount` da Configuração, o mesmo
  que alimenta a tela de Desempenho — uma definição só de retrabalho em todo o
  sistema. Chega junto dos outros campos do item, sem consulta adicional. O Azure
  **omite o campo** em item que nunca voltou: ausência é zero, não erro.
- **Sem o campo na Configuração**, o retrabalho no item simplesmente não aparece: o
  campo não é pedido ao Azure e nada mais muda na tela.

**Zero não é exibido.** Retrabalho zero é o normal; mostrar em todo item transformaria
o dado em mobília e esconderia justamente os itens que importam.

O retrabalho explica consumo que a estimativa não previa: item que passou do estimado
**e** voltou duas vezes não é erro de estimativa, é escopo mal entendido ou qualidade
insuficiente na primeira entrega — diagnósticos diferentes, ações diferentes.

---

## Custo e atualização

### RN-DLY-10 · A consulta é cara

A tela lê o **histórico de revisões de cada item** da sprint, para saber quando ele
entrou no estado de desenvolvimento e quando o terminou. É uma chamada por item, em blocos de 20 em
paralelo. Item cujo histórico falhe é tratado como sem histórico, em vez de derrubar
a tela.

O cache é curto (1 minuto), porque o consumo é medido até "agora" — cache longo
congelaria as barras no meio da manhã.
