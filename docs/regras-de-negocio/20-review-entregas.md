# Review › Entregas da Sprint

**Pergunta que a tela responde:** o que o time realmente entregou nesta sprint, e
quanto esforço isso custou?

**Filtros:** Produto ou Grupo (`RN-GLB-02`) e sprint (`RN-GLB-04`).

Tudo o que a tela mede sai da Configuração: tipos e estados do **Perfil de
processo** de cada Produto, area paths incluídos e excluídos (`RN-GLB-01`,
`RN-GLB-03`) e o calendário das horas úteis (`RN-GLB-07`). Nenhum Produto tem
tratamento próprio no código.

**Implementado em:**
`src/main/services/azure/sprint-delivery.ts` · `src/renderer/src/features/sprint-delivery/`

---

## Como um item é considerado entregue

### RN-ENT-01 · Entrega se mede pelo histórico, não pelo planejamento

Esta é a regra mais importante da tela, e a que mais surpreende quem vem do Azure.

**O campo `IterationPath` é planejamento, não entrega.** Um item pode ter sido
planejado para a Sprint 100 e concluído na 102 — e pertence à entrega da 102.

Por isso o sistema **não usa a iteração para medir entrega**. Ele lê o **histórico
de revisões** de cada item e localiza a **primeira vez, em toda a vida do item**,
em que ele atingiu um dos `deliveredStates` do seu Perfil de processo
(`RN-GLB-11`). Se essa data cai dentro da
janela da sprint, o item entrou. Se não, ficou de fora.

A consequência que mais confunde: **um item reaberto e concluído de novo não conta
duas vezes.** A primeira conclusão é a que vale, e ela pertence à sprint em que
aconteceu.

### RN-ENT-02 · Janela da sprint

A janela vai da **segunda-feira às 00:00:00** até a **sexta-feira às 23:59:59**,
no horário local.

O fim de semana **não pertence a nenhuma sprint** — item concluído no sábado não
entra na sprint que terminou na sexta.

### RN-ENT-03 · Por que a busca traz mais itens do que os entregues

A consulta ao Azure é deliberadamente ampla e busca por duas condições unidas por
`OU`:

1. Itens cuja **data de mudança de estado** caiu dentro da janela.
2. Itens **planejados naquela sprint** que estão concluídos.

A segunda condição existe para capturar um caso real: um item concluído na sprint
que depois muda de estado outra vez (por exemplo, de um estado de entrega para
outro, ou reaberto e fechado de novo, na sprint seguinte). Sua data de mudança de estado *atual* cai fora da janela, e sem essa
condição ele desapareceria da sprint em que foi de fato concluído.

Os candidatos trazidos passam então pela verificação de histórico da `RN-ENT-01`,
que é quem decide de verdade. **A consulta é o filtro grosso; o histórico é o fino.**

Produto de fluxo contínuo (`cadence: "continuous"`) não tem iteração, então a
consulta usa só a primeira condição.

### RN-ENT-13 · Grupo de produtos

Selecionado um Grupo, cada Produto é medido com o **seu** Perfil de processo, as
suas áreas e a **sua** iteração nesta Sprint unificada, e os resultados são
somados: itens entregues, planejados, injetados e horas por tipo.

- Produto com cadência de sprints **sem iteração** nesta Sprint unificada fica de
  fora da soma.
- Produto de fluxo contínuo entra pela janela de datas, sem planejado.

---

## Indicadores

### Itens entregues

- **Pergunta que responde:** quanto do que estava planejado foi concluído?
- **Regra (RN-ENT-04):** número de itens entregues, sobre o total de itens
  **planejados** na sprint. O total usa `IterationPath` — aqui ele é a medida
  certa, porque a pergunta é sobre planejamento.
- **Percentual de conclusão:** entregues ÷ planejados × 100, arredondado.
- **Casos de borda:** sem itens planejados, o percentual é **0**, não erro de
  divisão. Em Produto de **fluxo contínuo** o total planejado é sempre 0, porque
  não há iteração — o percentual perde o sentido ali.

### Foco em desenvolvimento

- **Pergunta que responde:** quanto do esforço da sprint foi para construir
  produto, e não para apagar incêndio?
- **Regra (RN-ENT-05):** horas de desenvolvimento dentro da sprint gastas em tipos
  de desenvolvimento ÷ total de horas de desenvolvimento na sprint × 100. Tipos de
  desenvolvimento são os `developmentTypes` do Perfil de processo (`RN-GLB-09`);
  num Grupo, vale a união dos Perfis dos seus Produtos.
- **Fonte:** soma das horas de "tempo de dev na sprint" (`RN-ENT-07`) por tipo.
- **Casos de borda:** sem horas registradas, exibe **0%**.

---

## Tempos por item

### RN-ENT-06 · Lead time total

Tempo em **horas úteis** (`RN-GLB-07`) entre o início real do desenvolvimento e o
momento em que o item ficou pronto para entrega.

- **Início:** a primeira vez que o item entrou no `inProgressState` do Perfil de
  processo. Se ele nunca passou por esse estado, usa-se a **data de criação**.
- **Fim:** a primeira vez que o item atingiu o `devDoneState` **depois** de ter
  entrado em desenvolvimento. Se o Perfil não tem `devDoneState`, ou o item nunca
  passou por ele, usa-se a **data de entrega** (`RN-ENT-01`).

A escolha de terminar no fim do desenvolvimento (ex.: `Tested`, `Resolved`) e não
na entrega é intencional: mede-se o ciclo de construção, não o tempo até o item ser
formalmente fechado, que depende de cerimônia.

### RN-ENT-07 · Tempo de dev dentro da sprint

Diferente do lead time: aqui só conta o tempo **gasto dentro da janela desta sprint**.

- Somam-se **todos os períodos** em que o item esteve no `inProgressState` — um item
  que entrou, saiu e voltou tem seus trechos somados.
- Cada período é **recortado pela janela da sprint**: o que aconteceu antes do
  início ou depois do fim não entra.
- Se o item nunca passou por esse estado, usa-se como aproximação o período entre
  criação e conclusão, também recortado pela janela.
- Um período ainda aberto (item em desenvolvimento agora) é contado até o momento atual.

**Por que as duas medidas existem:** o lead time responde *"quanto tempo esse item
levou?"*; o tempo na sprint responde *"quanto dessa sprint esse item consumiu?"*.
Um item longo que atravessa três sprints tem lead time grande e tempo pequeno em
cada uma.

---

## Injeção de escopo

### RN-ENT-08 · O que conta como escopo injetado

Item **atribuído à sprint depois que ela já havia começado**.

A verificação é feita no histórico: procura-se a **primeira atribuição do item à
iteração atual** e compara-se com a data de início da sprint. Se a atribuição veio
depois, é injeção.

- **Casos de borda:** item sem registro de atribuição no histórico **não** conta
  como injeção. Em Produto de **fluxo contínuo** não há medição de injeção, por não
  haver iteração.

> O indicador está calculado e disponível, mas **não é exibido na tela hoje**.
> Continua no resultado da consulta, pronto para uso.

---

## Distribuição por tipo

### RN-ENT-09 · Duas distribuições, dois usos

O sistema calcula a soma de horas por tipo de work item de **duas formas**:

| Distribuição | Soma | Usada em |
|---|---|---|
| Por lead time | `RN-ENT-06` de cada item | Disponível no resultado; não exibida hoje |
| Por tempo na sprint | `RN-ENT-07` de cada item | **Donut e foco em desenvolvimento** |

O donut mostra a segunda, porque a pergunta da tela é sobre o esforço **desta**
sprint. Usar lead time ali inflaria itens que vieram arrastados de sprints anteriores.

### RN-ENT-10 · Lista de tipos e filtro cruzado

Ao lado do donut, cada tipo aparece com sua cor (`RN-GLB-10`), o total de horas e a
contagem de itens, ordenados **da maior contagem para a menor**.

Clicar num tipo **filtra a tabela abaixo**. Clicar de novo remove o filtro.

---

## Tabela de itens entregues

### RN-ENT-11 · Conteúdo e comportamento

| Coluna | Conteúdo |
|---|---|
| ID | Link para o work item no Azure DevOps, abre no navegador padrão |
| Título | Título do item |
| Tipo | Etiqueta com a cor do tipo (`RN-GLB-10`) |
| Status | Estado atual, colorido pela regra compartilhada de estados |
| Criação / fechamento | Data de criação acima, data de conclusão abaixo |
| Dev. total / sprint | Lead time (`RN-ENT-06`) acima, tempo na sprint (`RN-ENT-07`) abaixo |

- Respeita o filtro por tipo da `RN-ENT-10`.
- **Casos de borda:** sem itens no filtro, mostra estado vazio — nunca tabela em branco.

---

## Formatação

### RN-ENT-12 · Como as horas são exibidas

Horas fechadas aparecem sem casa decimal (`18h`); horas fracionárias com uma casa
(`18,5h`). Vale em toda a tela.
