# Roadmap — modelo de domínio

> **Estado: em desenho.** Nada aqui está implementado. Quando o código existir, as
> regras `RN-RDM-xx` migram para `docs/regras-de-negocio/05-roadmap.md` sem mudar
> de ID — o ID nasce aqui e não é reciclado.
>
> **Remodelado em 2026-11-26** para entrar no [fluxo do PO](../fluxo-po/DESENHO.md)
> (etapa 5). O estudo inicial planejava três fases sem saber o que acontecia
> nelas; agora o plano é comparado com a Fase calculada da Feature. O que mudou:
> a fase planejada virou **Janela**, "Refinamento" virou **Quebra**, o plano saiu
> da máquina para a pasta de trabalho ([ADR 0017](../adr/0017-plano-do-roadmap-na-pasta-de-trabalho.md))
> e o rascunho passou a ser uma pasta de Feature.

---

## As perguntas que a tela responde

*"Se eu quiser trabalhar nestas features, quando cada uma cabe — sem sobrecarregar
ninguém?"*

*"O que eu planejei para esta sprint já aconteceu, e o que falta?"*

E, como consequência: *"o que eu preciso fazer nesta sprint?"*

### O que o Roadmap **não** é

- **Não é compromisso com stakeholder.** Mudar o plano não é atraso. O que o app
  aponta é a distância entre o plano e o que de fato aconteceu, para o PO.
- **Não é gestão de tarefas digitada.** O que falta numa Feature são as pendências
  calculadas dos artefatos (`RN-FLX-10`). Nada é marcado à mão.
- **Não escreve no Azure DevOps.**

---

## Vocabulário

| Termo | Significa |
|---|---|
| **Feature** | O entregável do roadmap. A mesma do [fluxo do PO](../fluxo-po/MODELO.md#feature): o work item do Azure mais a sua pasta. |
| **Janela** | O trecho de sprints em que o PO **planeja** trabalhar uma etapa da Feature. São três: **Discovery**, **Quebra** e **Delivery**. |
| **Fase** | Onde a Feature **está de fato**, calculada dos artefatos (`RN-FLX-05`). Não se planeja. |
| **Trilha** | O grupo de pessoas que pode ficar sobrecarregado: **Produto/UX** e **Time Técnico**. |
| **Peso** | Quanto uma Janela ocupa de uma trilha numa sprint. Não é hora, é ponderação. |
| **Rascunho** | Feature que ainda não tem work item no Azure: uma pasta com `Feature: #a criar`. |
| **Marco** | Uma foto do plano, gravada pelo PO para comparar depois. |

A Janela e a Fase têm nomes parecidos de propósito — Janela de Discovery, Fase
Discovery — porque falam da mesma etapa. A diferença é que **a Janela é o plano, e
a Fase é o fato**. A tela mostra as duas lado a lado, nunca uma no lugar da outra.

**Delivery** continua colidindo com a tela de Entregas (`RN-ENT`): escreve-se sempre
**"Janela de Delivery"** por extenso.

"Área" continua sendo só do Azure (`RN-GLB-01`): o grupo de pessoas chama-se Trilha.

---

## Entidades

```
Feature
├── origem: Azure (ID do work item) | rascunho (pasta com "#a criar")
├── produto: um dos Produtos da Configuração
├── Fase: calculada dos artefatos (RN-FLX-05)
├── progresso de Delivery: PBIs entregues / PBIs do plano (RN-RDM-19)
└── três Janelas, sempre nesta ordem:
    ├── Discovery → sprint de início + duração em sprints
    ├── Quebra    → sprint de início + duração em sprints
    └── Delivery  → sprint de início + duração em sprints
```

### Onde cada coisa mora

| Dado | Dono | Onde |
|---|---|---|
| ID, título, estado, produto, filhos | **Azure DevOps** | o retrato (`RN-FLX-01`) |
| Fase, pendências, progresso de Delivery | **ninguém: calculado** | nunca gravado |
| Janelas, arquivamento, pesos, limites, marcos | **PO** | `roadmap.json` na pasta de trabalho do Produto ([ADR 0017](../adr/0017-plano-do-roadmap-na-pasta-de-trabalho.md)) |

O plano deixa de morar na máquina. Trocou de computador, a pasta vem junto, e o
risco que o [ADR 0001](../adr/0001-camada-de-planejamento-local-sobre-features-do-azure.md)
encarava deixa de existir. Por isso exportar e importar o plano saem da lista de
obrigatórios.

---

## Regras

### A Feature

#### RN-RDM-01 · Duas origens

*Reescrita em 2026-11-26.* Uma Feature no roadmap é **do Azure** (título, estado e
produto vêm do retrato) ou **rascunho**: uma pasta de Feature com
`Feature: #a criar`, que existe só na pasta de trabalho.

Criar um rascunho no roadmap cria a pasta, só com o README. É o mesmo rascunho que o
fluxo do PO conhece, e não um segundo tipo de coisa.

As duas aparecem na mesma linha do tempo e são **visualmente distintas** — como a
etiqueta "Remanescente" do Planning (`RN-PLN-11`).

#### RN-RDM-02 · Adoção

*Reescrita em 2026-11-26.* Adotar é o rascunho ganhar o ID do Azure, pela
reconciliação da `RN-FLX-13`. O plano acompanha: Janelas, durações e âncoras ficam
intactas, e a Feature passa a herdar título, estado e produto do Azure.

O caminho contrário não existe.

#### RN-RDM-03 · Arquivar

Arquivar tira a Feature da tela sem apagar o planejamento. É o único jeito de uma
Feature sumir — **nada some sozinho**. É o mesmo gesto da `RN-FLX-07`.

### As Janelas

#### RN-RDM-04 · Três, fixas e ordenadas

*Reescrita em 2026-11-26 ("Refinamento" virou Quebra).* Toda Feature tem exatamente
**Discovery → Quebra → Delivery**, nesta ordem. Não se cria Janela, não se renomeia,
não se reordena.

A rigidez é o que dá sentido ao cálculo de sobrecarga: é a Janela que diz **quem**
está ocupado. Janela livre tornaria a trilha incalculável.

#### RN-RDM-05 · Duração por feature, editável sempre

Cada Janela de cada Feature tem a sua duração em sprints. O padrão é **2**, ajustável
a qualquer momento — inclusive depois de a Janela ter começado.

**Duração zero significa Janela pulada.** É assim que se representa o Discovery
expresso que cabe na Quebra, ou a Feature que chega pronta.

#### RN-RDM-06 · Ancoragem: cascata na criação, âncora própria depois

Ao criar o plano da Feature, escolhe-se uma sprint de início e as três Janelas são
enfileiradas **coladas**. A partir daí, **cada Janela tem âncora própria** e é
movida sozinha.

O buraco entre Janelas é informação, não erro: *"a Quebra acabou, mas o Delivery só
começa na 112 porque o time está ocupado"*.

**Uma Janela ocupa sprints contíguas.** Não existe pausa no meio.

#### RN-RDM-07 · Janela corrente é do calendário

*Reescrita em 2026-11-26.* Em que Janela a Feature está **hoje** é a Janela que
contém a sprint corrente (`RN-GLB-06`). Isso é o plano. Onde ela está de fato é a
Fase (`RN-FLX-05`). Nenhuma das duas é digitada.

#### RN-RDM-08 · O estado do Azure informa, não manda

Feature do Azure mostra o estado do work item, mas ele **não altera o plano**. Se o
Azure diz `Closed` e o plano ainda tem duas sprints de Delivery, isso é sinalizado
discretamente, como divergência a olhar.

### Plano e fato

#### RN-RDM-17 · Fora da Janela

*Nova em 2026-11-26.* Quando uma Janela termina, o app confere se a Feature chegou
aonde o plano dizia:

| Janela que terminou | A Feature devia estar | Senão |
|---|---|---|
| Discovery | Pronta para quebra, ou adiante | **fora da Janela** |
| Quebra | Publicada, com todos os PBIs de desenvolvimento escritos | **fora da Janela** |
| Delivery | com todos os PBIs do plano entregues | **fora da Janela** |

"Fora da Janela" é um sinal para o PO, não um atraso: o próximo passo é mover a
Janela ou terminar a etapa. A Feature que chegou **antes** da Janela não recebe
sinal nenhum.

#### RN-RDM-18 · A Fase aparece sobre a Janela

*Nova em 2026-11-26.* Na linha do tempo, cada Feature mostra as três Janelas e, na
sprint corrente, a etiqueta da Fase. Assim *"planejada para Quebra, ainda em
Discovery"* se lê sem abrir a Feature.

#### RN-RDM-19 · Progresso de Delivery

*Nova em 2026-11-26.* A Fase termina em Publicada, que é quando as regras chegam ao
catálogo; o desenvolvimento segue depois. O que mede a Janela de Delivery é o
progresso: PBIs de desenvolvimento do plano num estado de entrega do Perfil de
processo, sobre o total ativo do plano. Feature sem plano usa os filhos dela no
Azure.

É o "PBIs feitos/total" que o PO costuma contar à mão, calculado.

### Sobrecarga

#### RN-RDM-09 · Duas trilhas

O roadmap vigia **Produto/UX** e **Time Técnico**.

Duas, e não cinco (Produto, UX, Front, Back, QA), porque a oito sprints de distância
não existe estimativa de frontend versus backend. O detalhe já é resolvido sprint a
sprint pelo Planning (`RN-PLN-13`), onde há dado real.

#### RN-RDM-10 · Peso de cada Janela em cada trilha

*Reescrita em 2026-11-26 (Quebra no lugar de Refinamento).* Uma Janela pesa em
**toda sprint que ela cobre**.

| Janela | Produto/UX | Time Técnico |
|---|:--:|:--:|
| Discovery | 1,0 | — |
| Quebra | 1,0 | 0,5 |
| Delivery | — | 1,0 |

A Quebra pesa nas duas: é quando o PO escreve as regras e os PBIs e o time técnico
refina com ele. Empilhar Quebra com Delivery é o que mais estrangula o time técnico.

**Os pesos são editáveis** e ficam no `roadmap.json`.

#### RN-RDM-11 · Limite e faixas

Cada trilha tem um limite de peso por sprint, ajustável. Proposta inicial: **2,0
para Produto/UX** e **3,0 para Time Técnico**.

| Situação | Estado |
|---|---|
| Peso abaixo do limite | **Dentro** (verde) |
| Peso igual ao limite | **No limite** (amarelo) |
| Peso acima do limite | **Sobrecarregada** (vermelho) |

Na tela, as duas leituras juntas — *"Produto/UX: 3 features · peso 2,5 de 2,0"*.

#### RN-RDM-12 · O cálculo é sempre global

Os Produtos dividem **uma** linha do tempo, mesmo com uma pasta de trabalho cada: o
app lê o `roadmap.json` de todas. O filtro por produto serve **apenas para ler**.

**O cálculo de sobrecarga nunca é filtrado.** Não existem duas capacidades de
Discovery: um PO com dois Discoveries na Loja Online e dois no App Mobile tem quatro.

> O erro mais fácil de cometer: aplicar o filtro de produto antes de somar. O filtro
> entra **depois** do cálculo, na renderização.

#### RN-RDM-13 · Ocupação real substitui o peso quando ela existe

Nas sprints que já têm itens planejados, a trilha **Time Técnico** troca o peso
estimado pela **ocupação real** do Planning (`RN-PLN-15`, `RN-PLN-17`). A tela diz
qual das duas está mostrando.

Produto/UX permanece sempre em peso.

### Uso

#### RN-RDM-14 · O app sugere, nunca decide

Ao criar ou mover uma Janela, o app informa **a primeira sprint em que ela caberia
sem estourar o limite** da trilha. É sugestão: pode ser ignorada.

#### RN-RDM-15 · Linha do tempo contínua

O roadmap rola livremente para trás e para frente. O passado fica à esquerda e não
é apagado. A sprint corrente é destacada.

#### RN-RDM-16 · Painel "Minha sprint"

*Reescrita em 2026-11-26.* Responde *"o que eu preciso fazer nesta sprint"*: as
Janelas ativas agora e, em cada uma, a Fase da Feature e as **pendências** dela
(`RN-FLX-10`). Ao lado, a carga das duas trilhas.

O estudo inicial recusava checklist por fase, porque seria marcado à mão e ficaria
meio preenchido. A recusa continua: as pendências **não são marcadas**, são
calculadas dos artefatos. Somem quando o Brief, a Decisão ou o PBI existem.

#### RN-RDM-20 · Ordem das Features

*Nova em 2026-11-26.* Na lista, as Features seguem o campo de prioridade que a
Configuração declara para o Produto (por padrão, `Business Value`), maior primeiro.
Ao lado, a quantidade de oportunidades encaixadas (`RN-FLX-15`). Rascunho vem por
último.

#### RN-RDM-21 · Marco

*Nova em 2026-11-26.* O PO pode gravar um **marco**: a foto do plano naquele dia,
com nome. Escolhido um marco, a tela mostra o que mudou desde ele — Janela movida,
Feature que entrou, Feature arquivada.

O marco é opcional e não gera "atraso". É a foto do backlog e o registro de alterações
que o PO costuma manter à mão.

---

## Consequências para a implementação

- **O roadmap depende da pasta de trabalho.** Produto sem pasta mostra o estado
  vazio que diz o que apontar (`RN-FLX-03`).
- **Lê do retrato** as Features e os filhos; nenhum método de IPC novo além dos do
  fluxo do PO.
- **A IA lê o plano** pelo servidor MCP e não o grava: o `roadmap.json` é do app,
  como a Configuração. Uma mudança proposta pela IA segue o padrão de proposta.
- **Ajuda na tela (`HelpTip`):** `RN-RDM-10` (por que a Quebra pesa nas duas
  trilhas), `RN-RDM-12` (por que o filtro de produto não muda o número),
  `RN-RDM-13` (unidades diferentes em sprints diferentes) e `RN-RDM-17` (Janela e
  Fase são coisas diferentes).

## A verificar nos dados reais

1. **Se o PBI é filho da Feature** (`System.Parent`). O progresso de Delivery de
   Feature sem plano depende disso.
2. **Onde a Feature vive na hierarquia do Azure.** Um Produto pode ser um projeto ou
   *area paths* num projeto compartilhado (`RN-GLB-01`). A consulta de Features
   precisa saber qual das duas leituras vale.
3. **O campo de prioridade.** `Business Value` existe no processo Scrum; outro
   processo pode usar outro campo, ou nenhum.
