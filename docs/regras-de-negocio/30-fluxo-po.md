# Fluxo do PO

**Pergunta que esta área responde:** desta oportunidade até a regra publicada e os
bugs que vieram depois, em que ponto cada Feature está, e qual é o próximo passo nela?

O desenho inteiro, com as etapas que ainda não foram implementadas, está em
[docs/fluxo-po/](../fluxo-po/DESENHO.md). As regras `RN-FLX` nascem em
[ETAPAS.md](../fluxo-po/ETAPAS.md) e chegam aqui, sem mudar de ID, junto com o código
de cada fatia.

**Implementado em:**
`src/shared/flow-snapshot.ts` · `src/shared/flow-artifacts.ts` · `src/shared/flow-board.ts` ·
`src/main/services/azure/flow-snapshot.ts` · `src/main/services/flow/` ·
`src/main/profile/work-folders.ts` · `src/main/ipc/flow-handlers.ts`

---

## O retrato do Azure

A IA do PO precisa saber quais Features estão abertas, o que cada uma tem embaixo e
o que chegou de feedback. O servidor MCP não fala com o Azure nem lê o PAT
(`RN-SEC-34`). Quem lê é a janela, que grava um **retrato** nos Dados de trabalho, e é
desse arquivo que o servidor lê ([ADR 0011](../adr/0011-retrato-do-azure-para-a-ia-do-po.md)).

### RN-FLX-01 · O que o retrato guarda

Um retrato por Produto, na chave `flow:snapshot:<id do Produto>` (`RN-CFG-08`):

| Coleção | O que entra | Campos |
|---|---|---|
| **Features** | Itens do tipo `poFlow.featureType` no escopo do Produto (projeto e áreas, `RN-GLB-01`), **abertos ou fechados nos últimos 180 dias** | ID, tipo, título, estado, pai, prioridade, criação, última troca de estado, IDs dos filhos |
| **Filhos** | Os filhos de cada Feature, de qualquer tipo, **mesmo em outra área ou outro projeto** | ID, tipo, título, estado, pai |
| **Feedbacks** | Itens do tipo `poFlow.feedback.type`, nos estados declarados, nas áreas do feedback (ou nas do Produto) | ID, tipo, título, estado, pai, descrição, Features ligadas |
| **Bugs** | Itens do `bugType` do Perfil de processo no escopo do Produto, **abertos ou fechados nos últimos 180 dias** | ID, tipo, título, estado, pai, criação, fechamento, aberto ou não, descrição |

- **"Fechado"** é estar num `terminalStates` do Perfil de processo; a data é a da
  última troca de estado (`StateChangeDate`). Item num `removedStates` nunca entra.
- **A Feature ligada ao feedback** segue o vínculo da Configuração (`RN-CFG-14`): o
  feedback é pai da Feature, é filho dela, ou tem vínculo "Related" com ela. Só
  contam as Features que estão no retrato.
- **A descrição vai só no feedback e no bug aberto**, que são o que ainda vai ser
  trabalhado. Bug fechado entra com a descrição vazia.
- **Título e descrição seguem a `RN-SEC-24`:** campo a campo, em texto puro e
  redigidos. Título numa linha, até 300 caracteres; descrição até 4.000 caracteres,
  e o conjunto das descrições até 400.000, em fatias iguais quando passa disso.
- **Prioridade** é o valor numérico de `poFlow.priorityField`. Campo que não existe
  no projeto, ou vazio no item, vira `null`; a leitura não falha por isso.

**Fonte no Azure:** um WIQL por coleção e leituras em lote. As Features são lidas
com os vínculos (`$expand=relations`), e é deles que saem os filhos; o feedback com
vínculo "Related" também. Nenhuma escrita (`RN-SEC-20`).

**Casos de borda:** Produto sem feedback na Configuração grava `feedbacks: null`, para
a IA distinguir "não configurado" de "nenhum feedback". Filho apagado ou sem acesso
fica de fora, sem erro. Feature sem filho tem a lista vazia.

### RN-FLX-02 · O retrato tem data

O retrato guarda quando foi tirado (`takenAt`, com hora) e o primeiro dia da janela
de fechados (`windowStart`). Ele é refeito quando a janela pede (`refreshFlowSnapshot`);
as telas do fluxo, que chegam nas próximas fatias, pedem ao abrir e no botão
Atualizar.

- **A janela recebe só o resumo:** as contagens e a data. A descrição não atravessa
  para ela (`RN-SEC-24`).
- **A IA diz a data ao PO.** Toda ferramenta do servidor MCP que usar o retrato
  devolve a data junto, e a instrução manda a IA dizê-la, porque um PBI criado depois
  do retrato não está nele.

**Casos de borda:** sem retrato gravado, a ferramenta do MCP diz ao PO para abrir o
app. Um retrato maior que 1 MB não é gravado, e o erro diz isso (`RN-CFG-08`).

**Implementado em:** `src/main/services/azure/flow-snapshot.ts` ·
`src/shared/flow-snapshot.ts`

---

## A pasta de trabalho e a Fase

Os artefatos do processo rule-first (Brief, Registro de Decisões, Plano de PBIs, PBIs
escritos) moram numa **pasta de trabalho** por Produto, que o PO escolhe
([ADR 0013](../adr/0013-pasta-de-trabalho-do-produto.md)). O app lê essa pasta e o
retrato e calcula em que ponto cada Feature está. A estrutura e os arquivos estão em
[MODELO.md](../fluxo-po/MODELO.md#a-pasta-de-trabalho).

### RN-FLX-03 · Uma pasta por Produto

Cada Produto tem no máximo uma pasta de trabalho, e duas pastas não se misturam. O PO
a escolhe pelo diálogo do sistema (`RN-SEC-36`). O caminho é desta máquina: fica em
`pastas-de-trabalho.json`, na pasta do Perfil, e não entra na Configuração, que se
compartilha.

- **Sem pasta escolhida,** o quadro mostra as Features abertas do retrato, todas em
  Sem Discovery, e diz o que apontar.
- **Pasta que sumiu** (renomeada, apagada, disco removido) aparece como tal, e o
  quadro também só mostra o retrato até o PO apontar de novo.

As Features ficam em `features/<pasta>/`. Pasta que começa com `_` ou `.` não é
Feature (é onde ficam modelos e rascunhos do PO). Link simbólico não é seguido.

### RN-FLX-04 · O app lê só as linhas reconhecidas

De cada Feature, o app lê quatro arquivos, e deles só as linhas que os modelos do
processo já têm:

| Arquivo | O que o app lê |
|---|---|
| `README.md` | `# Título`, `Fase:` (só para mostrar a divergência), `Feature: #<id>` ou `Feature: #a criar`, `Arquivada: <data> · <motivo>` |
| `discovery/brief.md` | Se as seções Problema, Para quem, Objetivo e Escopo têm texto além do modelo; os Requisitos (`- **R1** ·`) e as Decisões de cada um; as perguntas em aberto (`- [ ]`, `- [x]`) e a marca `bloqueia a quebra` ou `não bloqueia` |
| `discovery/decisoes.md` | `### D1 · <título>` e, logo abaixo, `Status:` (`Proposta`, `Aceita`, `Substituída por Dn`) e `Data:` |
| `plano-pbis.md` | `### P1 · <DEV, DESIGN ou AJUSTE VISUAL> · <título>`; abaixo, `Azure: #<id>` e `Status:` (`Planejado`, `Escrito`, `Quebrado em`, `Unificado em`, `Cancelado`), `Requisitos:`, `Decisões:` e `RNs:`; e a tabela de cobertura |

- **A linha `RNs:` aceita as abreviações do PO:** `RN-DOC-045, 041, 043` continua o
  prefixo, `RN-PED-050 a 053` é uma faixa, e o que está entre parênteses é
  observação.
- **Status com observação vale:** `Escrito (aprovado pelo PO em 28/10)` é Escrito.
- **Linha que parece marca e não bate** (um status que não existe, um tipo de PBI
  desconhecido, `Feature:` sem `#`) **aparece como não reconhecida**, com o arquivo e
  o número da linha. O app nunca adivinha: a Decisão com status desconhecido não conta
  como Aceita.
- O texto do modelo ainda não preenchido (`<...>`) é ignorado.

**Casos de borda:** arquivo maior que 1 MB não é lido. `discovery/apoio/`, os PBIs
escritos e qualquer outro arquivo são do PO e da IA; o app só os conta para saber se
a pasta tem mais que o README.

### RN-FLX-05 · A Fase é calculada

| Fase | Quando |
|---|---|
| **Sem Discovery** | Feature aberta no retrato, sem pasta; ou pasta só com o README |
| **Discovery** | A pasta tem `discovery/` ou o plano, e o checklist da `RN-FLX-06` não fecha |
| **Pronta para quebra** | O checklist fecha, e nenhum PBI ativo tem regra |
| **Em quebra** | Algum PBI ativo tem regra na linha `RNs:`, e nem todas estão no catálogo |
| **Publicada** | Toda regra da Feature está no catálogo, citando um PBI da Feature na Origem |
| **Arquivada** | `RN-FLX-07` |
| **Fora do fluxo** | `RN-FLX-08` |

PBI **ativo** é o Planejado ou o Escrito; os outros são histórico do plano.

- **A linha `Fase:` do README não entra no cálculo.** Quando ela diverge do
  calculado, o quadro mostra as duas.
- **Publicada depende do catálogo de regras absorvido** (ADR 0015). Enquanto o
  Produto não tem catálogo, a Feature com regras fica em Em quebra.

### RN-FLX-06 · O checklist de "Pronta para quebra"

É o Passo 6 do Discovery, verificado:

1. Brief com Problema, Para quem, Objetivo e Escopo preenchidos.
2. Nenhuma Decisão em Proposta.
3. Nenhuma pergunta em aberto que bloqueie a quebra. Pergunta aberta **sem marca**
   conta como bloqueio: o PO precisa dizer.
4. Plano com pelo menos um PBI ativo, e todo Requisito com PBI ativo ou justificado
   na tabela de cobertura.
5. Todo PBI ativo de design ou de ajuste visual Escrito.

O ID do Azure em cada PBI e o BPMN não entram: o primeiro é pendência que não segura
a Fase, o segundo o app não lê.

### RN-FLX-07 · Arquivar é gesto

A linha `Arquivada: <data> · <motivo>` no README arquiva a Feature, qualquer que seja
o resto da pasta. Desarquivar é apagar a linha. Feature arquivada não tem pendência.

### RN-FLX-08 · Fora do fluxo

Pasta sem `discovery/` e sem `plano-pbis.md`, mas com outros arquivos além do README,
é de uma Feature trabalhada antes do processo: aparece como **Fora do fluxo**, sem
checklist e sem pendência.

### RN-FLX-09 · O Azure informa, não manda

O estado do Azure nunca muda a Fase. Ele vira **divergência**, mostrada à parte:

- a Feature está fechada no Azure, e a Fase não é Publicada nem Arquivada;
- já há PBI filho num estado de entrega, e a Feature está em Sem Discovery,
  Discovery ou Pronta para quebra.

### RN-FLX-10 · As pendências

O próximo passo de cada Feature é a lista das pendências dela, cada uma com a etapa
do fluxo a que pertence:

| Pendência | Etapa |
|---|---|
| Falta o Brief, ou uma das quatro seções está vazia | Discovery |
| Decisão em Proposta | Discovery |
| Pergunta em aberto que bloqueia a quebra, ou que não diz se bloqueia | Discovery |
| Falta o plano, ou um Requisito não tem PBI nem justificativa | Discovery |
| PBI ativo sem ID do Azure | Discovery |
| PBI de design ou ajuste visual ainda não escrito | Discovery |
| Linha não reconhecida (`RN-FLX-04`) | Discovery |
| A Feature tem mais de uma pasta | Discovery |
| A Feature da pasta não está no retrato (fechada há mais de 180 dias, removida ou de outro Produto) | Discovery |
| Regra da Feature que não está em nenhum PBI de desenvolvimento | Quebra |
| Regra que outra Feature também tem no plano (`RN-FLX-19`) | Quebra |

As pendências do catálogo, da reconciliação com o Azure e do acompanhamento chegam
com as regras delas.

### RN-FLX-11 · Parada há N dias

Dias desde a última alteração de qualquer arquivo da pasta da Feature. Feature em
Discovery ou Pronta para quebra **parada há mais de 30 dias** é destacada. Em quebra o
trabalho é outro, e a Feature não é destacada.

**Casos de borda:** link simbólico não conta; numa pasta enorme, só as primeiras 2.000
entradas são olhadas.

### RN-FLX-18 · As regras da Feature

São a soma das linhas `RNs:` dos PBIs **ativos** do plano. É com elas que a Feature
entra em quebra (`RN-FLX-05`) e chega a Publicada.

### RN-FLX-19 · Regra em mais de uma Feature

A mesma regra no plano de duas Features que ainda não chegaram a Publicada é
pendência **nas duas**. Se a regra não existe no catálogo, é o mesmo ID de regra nova
reservado duas vezes; se existe, as duas Features a alteram ao mesmo tempo. As duas
situações pedem decisão antes da gravação no catálogo.

Feature arquivada não conta.
