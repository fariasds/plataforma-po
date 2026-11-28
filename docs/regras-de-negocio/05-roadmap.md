# Roadmap

**Pergunta que esta área responde:** se eu quiser trabalhar nestas Features, quando
cada uma cabe sem sobrecarregar ninguém? E o que eu planejei para esta sprint já
aconteceu?

O Roadmap é a etapa de planejamento do [fluxo do PO](../fluxo-po/DESENHO.md). O plano
é do PO e mora no `roadmap.json` da pasta de trabalho de cada Produto
([ADR 0017](../adr/0017-plano-do-roadmap-na-pasta-de-trabalho.md)); a Fase de cada
Feature é calculada dos artefatos (`RN-FLX-05`). **A Janela é o plano; a Fase é o
fato.** A tela mostra as duas lado a lado.

O Roadmap **não** é compromisso com stakeholder (mover o plano não é atraso), não é
lista de tarefas digitada (o que falta são as pendências calculadas, `RN-FLX-10`) e
não escreve no Azure DevOps.

O desenho e as alternativas estão em [docs/roadmap/DESENHO.md](../roadmap/DESENHO.md).

**Implementado em:**
`src/shared/roadmap.ts` · `src/main/flow/roadmap.ts` · `src/main/services/flow/roadmap.ts` ·
`src/renderer/src/features/flow/RoadmapScreen.tsx`

---

## A Feature

### RN-RDM-01 · Duas origens

Uma Feature no Roadmap é a mesma do quadro do fluxo do PO: **do Azure** (título,
estado, prioridade e Produto vêm do retrato) ou **rascunho**, uma pasta de Feature com
`Feature: #a criar`. O rascunho tem a etiqueta "Rascunho" e vem por último
(`RN-RDM-20`). Quem cria o rascunho é a IA do PO, na pasta (`gravar_arquivo`), ou o
próprio PO.

A chave da Feature no `roadmap.json` é a do quadro: `#<id>` ou `pasta:<slug>`.
Arquivada e fora do fluxo (`RN-FLX-07`) não entram no Roadmap.

### RN-RDM-02 · Adoção

Quando o rascunho ganha o ID do Azure (`RN-FLX-13`), o plano vai junto: o app acha o
plano pela chave `pasta:<slug>` e, na próxima gravação, troca a chave pela `#<id>`.
Janelas e durações ficam intactas. O caminho contrário não existe.

### RN-RDM-03 · Arquivar

Arquivar no Roadmap tira a Feature da linha do tempo e da carga sem apagar o plano.
"Mostrar arquivadas" traz a Feature de volta, esmaecida, e dá para desarquivar.
Nada some sozinho.

## As Janelas

### RN-RDM-04 · Três, fixas e ordenadas

Toda Feature planejada tem **Discovery → Quebra → Janela de Delivery**. Não se cria,
renomeia nem reordena Janela: é a Janela que diz quem está ocupado (`RN-RDM-10`).
"Delivery" escreve-se sempre "Janela de Delivery", para não confundir com Entregas.

### RN-RDM-05 · Duração por Feature, editável sempre

Cada Janela tem a sua duração em sprints, de 0 a 26. O padrão é **2**. **Duração zero
é Janela pulada**: não aparece, não pesa e nunca fica fora da Janela.

### RN-RDM-06 · Cascata na criação, âncora própria depois

"Planejar a partir da sprint corrente" enfileira as três Janelas coladas, com 2
sprints cada. Depois, cada Janela tem a sua sprint de início e é movida sozinha; o
buraco entre Janelas é informação. Uma Janela ocupa sprints contíguas.

A âncora é a **data de início da sprint**, não o nome: cada Produto numera as suas
sprints do seu jeito (`RN-GLB-04`).

### RN-RDM-07 · Janela corrente é do calendário

A Janela corrente é a que contém a sprint corrente: a Sprint unificada que contém
hoje ou, entre duas, a próxima. É o plano; onde a Feature está de fato é a Fase.

### RN-RDM-08 · O estado do Azure informa, não manda

Se o Azure diz que a Feature fechou (estado de entrega ou terminal do Perfil de
processo) e o plano ainda tem Janela na sprint corrente ou depois, a tela mostra o
estado do Azure como divergência, em cinza. O plano não muda.

## Plano e fato

### RN-RDM-17 · Fora da Janela

Quando uma Janela termina (a última sprint dela é anterior à corrente), o app confere
se a Feature chegou aonde o plano dizia:

| Janela que terminou | A Feature devia estar | Senão |
|---|---|---|
| Discovery | Pronta para quebra, Em quebra ou Publicada | **fora da Janela** |
| Quebra | Publicada, com todos os PBIs ativos do plano escritos | **fora da Janela** |
| Janela de Delivery | com todos os PBIs do progresso entregues (`RN-RDM-19`) | **fora da Janela** |

"Fora da Janela" aparece em âmbar, como contorno da Janela. É sinal, não atraso: o
próximo passo é mover a Janela ou terminar a etapa. A Feature que chegou antes não
recebe sinal. A tela leva `HelpTip`.

### RN-RDM-18 · A Fase aparece sobre a Janela

Na coluna da sprint corrente, cada Feature mostra a Fase abaixo da Janela. Assim
"planejada para Quebra, ainda em Discovery" se lê sem abrir a Feature.

### RN-RDM-19 · Progresso de Delivery

PBIs `DEV` ativos do plano da Feature (com o ID do Azure) num estado de entrega do
Perfil de processo, sobre o total deles. Sem plano, os filhos da Feature no retrato
dos tipos de desenvolvimento (`developmentTypes`), sem os removidos. A tela mostra
"1/2 PBIs".

## Sobrecarga

### RN-RDM-09 · Duas trilhas

**Produto/UX** e **Time Técnico**. A oito sprints de distância não existe estimativa de
frontend contra backend; o detalhe é do Planning.

### RN-RDM-10 · Peso de cada Janela em cada trilha

Uma Janela pesa em **toda sprint que ela cobre**:

| Janela | Produto/UX | Time Técnico |
|---|:--:|:--:|
| Discovery | 1,0 | — |
| Quebra | 1,0 | 0,5 |
| Janela de Delivery | — | 1,0 |

A Quebra pesa nas duas: o time técnico refina com o PO. Os pesos se ajustam em "Pesos
e limites", de 0 a 5. A tela leva `HelpTip`.

### RN-RDM-11 · Limite e faixas

Cada trilha tem um limite por sprint, de 0,5 a 20. Padrão: **2,0 para Produto/UX** e
**3,0 para Time Técnico**.

| Peso | Estado |
|---|---|
| Abaixo do limite | **Dentro** (verde) |
| Igual ao limite | **No limite** (âmbar) |
| Acima do limite | **Sobrecarregada** (vermelho) |

A linha de carga mostra "2 de 2"; a dica, "Produto/UX: 2 features · peso 2 de 2".

Pesos e limites são **do Perfil**, nos Dados de trabalho (`roadmap:settings`), e não
de um Produto: a carga é uma só (`RN-RDM-12`).

### RN-RDM-12 · O cálculo é sempre global

A carga soma as Janelas de **todos** os Produtos, de todas as pastas de trabalho. O
filtro de Produto escolhe só as linhas da lista: a carga não muda com ele. A tela leva
`HelpTip`.

### RN-RDM-13 · Ocupação real substitui o peso quando ela existe

**Ainda não implementada.** Nas sprints que já têm itens planejados, a trilha Time
Técnico passará a mostrar a ocupação real do Planning (`RN-PLN-15`, `RN-PLN-17`) no
lugar do peso. Hoje as duas trilhas mostram sempre o peso.

## Uso

### RN-RDM-14 · O app sugere, nunca decide

Ao editar uma Janela, o app diz a primeira sprint, a partir da corrente, em que ela
cabe sem passar o limite de nenhuma trilha em que pesa, descontada a própria Janela.
Se não cabe na linha do tempo, diz isso. É sugestão: o PO grava o que quiser.

### RN-RDM-15 · Linha do tempo contínua

A linha do tempo vai de três sprints antes da corrente até doze depois. A sprint
corrente é destacada. As sprints que o Azure ainda não tem são **projetadas** pela
cadência da última (o intervalo e a duração dela) e marcadas "projetada". Janela que
começa antes da primeira sprint conhecida conta pela mesma cadência e não é
encurtada.

### RN-RDM-16 · Minha sprint

O painel responde "o que eu preciso fazer nesta sprint": as Features com Janela na
sprint corrente, com a Janela, a Fase e quantas pendências (`RN-FLX-10`) elas têm, e a
carga das duas trilhas. As pendências não se marcam: somem quando o artefato existe.

### RN-RDM-20 · Ordem das Features

O campo de prioridade do Produto (`RN-CFG-14`), maior primeiro; sem prioridade
depois; rascunho por último; empate pelo título. Ao lado, as oportunidades encaixadas
na Feature (`RN-FLX-15`) e o progresso de Delivery.

### RN-RDM-21 · Marco

"Gravar marco" grava a foto do plano, com nome e data, no `roadmap.json` de toda pasta
de trabalho disponível. Escolhido um marco, a tela lista o que mudou desde ele:
Janela movida (de quando e quantas sprints, para quando e quantas), Feature que entrou
no plano, saiu dele ou foi arquivada. O marco não gera "atraso".

## O arquivo

O `roadmap.json` é do app, como a Configuração: **só a janela grava**. A IA o lê pela
ferramenta `ler_roadmap` e, para mudar o plano, diz ao PO o que mudar; o servidor MCP
não grava fora de `features/`, `oportunidades/`, `bugs/` e `catalogo/` (`RN-SEC-38`).

O app valida o arquivo ao ler. Arquivo que não valida aparece como aviso na tela e
**não é sobrescrito**: gravar recusa, para o PO não perder o plano sem ver. A mudança
que chega da janela também é validada: a chave da Feature tem de ser `#<id>` ou
`pasta:<slug>`, e de uma Feature que o quadro conhece.
