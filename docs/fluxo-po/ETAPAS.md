# Fluxo do PO — as etapas

> **Estado: em desenho (etapa 4 de [DESENHO.md](DESENHO.md)).** Para cada etapa do
> fluxo: o que entra, o que sai, o que a IA do PO faz, o que a tela mostra e as
> regras. As regras `RN-FLX` e `RN-CAT` nascem aqui e migram sem mudar de ID para
> `docs/regras-de-negocio/30-fluxo-po.md` e `31-catalogo.md`. As regras de
> segurança e de Configuração entram em `RN-SEC` e `RN-CFG`, numeradas na fatia que
> as implementar.
>
> Termos e entidades: [MODELO.md](MODELO.md).

---

## Peças comuns

### O retrato do Azure

**RN-FLX-01 · O que o retrato guarda.** Por Produto: as Features abertas e as
fechadas nos últimos 180 dias; os itens filhos delas (tipo, título, estado, pai);
os feedbacks (RN-FLX-14); os bugs abertos e os fechados nos últimos 180 dias.
Título e descrição passam pela redação e pelo limite da `RN-SEC-24`.

**RN-FLX-02 · O retrato tem data.** É refeito ao abrir uma tela do fluxo e no botão
"Atualizar". Toda ferramenta do MCP que usa o retrato devolve a data dele, e a
instrução manda a IA dizê-la ao PO. Sem retrato, a ferramenta responde o que fazer:
abrir o app.

### A pasta de trabalho

**RN-FLX-03 · Uma pasta por Produto.** O PO escolhe a pasta na tela do Produto. O
caminho fica na máquina. Produto sem pasta mostra o estado vazio que diz o que
apontar; pasta que sumiu, o mesmo.

**RN-FLX-04 · O app lê só as linhas reconhecidas** (decisão M1). Linha que parece
uma marca mas está fora do padrão (`Status: aceita`, `### D 3`) aparece na Feature
como "não reconhecida", com o arquivo e a linha.

### O servidor MCP

Ferramentas novas, todas presas ao Perfil do `--perfil`:

| Ferramenta | Faz | Grava? |
|---|---|---|
| `ler_retrato` | Features, itens, feedbacks e bugs de um Produto, com a data | não |
| `ler_feature` | Os artefatos de uma Feature, a Fase e as pendências | não |
| `validar_feature` | As pendências de uma Feature, as mesmas da tela | não |
| `buscar_regra` | Regras por ID ou por texto, no catálogo do Produto e nos consultados | não |
| `ler_catalogo` | Um domínio do catálogo, inteiro | não |
| `listar_features` | As Features do Produto, com a Fase e as pendências | não |
| `listar_oportunidades` | Oportunidades e o encaixe de cada uma | não |
| `ler_acompanhamento` | Bugs sem análise, por Feature e por regra, e as regras a conferir | não |
| `gravar_arquivo` | Grava um arquivo dentro da pasta de trabalho de um Produto | **sim** |
| `propor_instrucao` | Grava a proposta de instrução alterada (ADR 0014) | só a proposta |

Prompts do rule-first (ADR 0014), cada um com a instrução padrão substituível:

| Prompt | Etapa |
|---|---|
| `resumir_feedback` | Oportunidade |
| `encaixar_oportunidade` | Encaixe |
| `discovery` | Discovery (Passos 0 a 6, com os PBIs de design) |
| `quebra` | Quebra (Passos 0 a 4 da task de feature) |
| `analisar_bug` · `reescrever_bug` | Acompanhamento |

**RN-FLX-17 · Uma fonte de pendências.** `validar_feature` e a tela calculam as
pendências pelo mesmo código. A IA não tem checklist próprio.

### As telas

Um item novo no menu lateral, **Fluxo do PO**, com quatro telas:

| Tela | Pergunta |
|---|---|
| **Oportunidades** | O que chegou e ainda não tem Feature? |
| **Features** | Em que Fase está cada Feature, e qual é o próximo passo? |
| **Catálogo** | Quais regras existem, quais mudaram e não foram publicadas, quais faltam conferir? |
| **Acompanhamento** | Quais bugs faltam analisar, e onde eles se concentram? |

A Fase é etiqueta neutra: ela não é situação, e as cores de `STATUS` não se aplicam
a ela.

---

## 1. Oportunidade

| | |
|---|---|
| **Entra** | Um feedback do Azure, ou um relato do PO na conversa |
| **Sai** | Uma Oportunidade: a dor e a solicitação, com a evidência |
| **IA** | `resumir_feedback` lê o feedback no retrato e devolve as duas seções, prontas para colar no ticket. Na conversa, a IA grava a oportunidade em `oportunidades/` |
| **Tela** | Oportunidades: feedbacks e oportunidades da conversa, numa lista só |

**RN-FLX-14 · Duas origens.** Feedback é o work item do tipo, da área e dos estados
que a Configuração declara para o Produto. Sem essa declaração, a tela diz o que
configurar e mostra só as oportunidades da conversa.

---

## 2. Encaixe

| | |
|---|---|
| **Entra** | Oportunidades sem encaixe e as Features abertas do retrato |
| **Sai** | Para cada oportunidade, a Feature onde ela entra, ou a proposta de Feature nova |
| **IA** | `encaixar_oportunidade` compara a dor com as Features abertas e os Briefs, e propõe o encaixe com o motivo. É a análise de encaixe que o PO faz hoje à mão |
| **Tela** | Oportunidades, com o encaixe de cada uma |

**RN-FLX-15 · O encaixe é derivado.**

| Encaixe | Quando |
|---|---|
| **Sem encaixe** | Nenhuma Feature indicada |
| **Proposto** | A oportunidade indica uma Feature (`Feature: #<id>`) ou uma Feature nova, e o Azure ainda não tem o vínculo |
| **Encaixada** | O Azure tem o vínculo |
| **Descartada** | O PO descartou, com motivo. É o único gesto |

**RN-FLX-16 · O vínculo vem da Configuração.** Pai, filho ou relacionado: o Produto
declara qual tipo de vínculo liga o feedback à Feature. Ligar no Azure é do PO
(ADR 0012); o app entrega a lista "ligar o feedback X à Feature Y".

---

## 3. Discovery

| | |
|---|---|
| **Entra** | A Feature (do Azure ou rascunho), as oportunidades encaixadas e o catálogo |
| **Sai** | Brief, Registro de Decisões, Plano de PBIs, PBIs de design escritos e o resumo para a descrição da Feature |
| **IA** | `discovery` conduz os Passos 0 a 6, com checkpoint em cada um. Lê o catálogo para o "como é hoje", grava os arquivos com `gravar_arquivo`, roda `validar_feature` antes de fechar |
| **Tela** | Features: a Fase, o checklist e as pendências. A Feature aberta mostra a cobertura Requisito → PBI |

**RN-FLX-05 · A Fase é calculada** (tabela de [MODELO.md](MODELO.md#a-fase)).

**RN-FLX-06 · O checklist de "Pronta para quebra"** é o Passo 6 do rule-first.

**RN-FLX-07 · Arquivar é gesto.** Fica no README (`Arquivada: <data> · <motivo>`).
Desarquivar é apagar a linha.

**RN-FLX-08 · Fora do fluxo.** Pasta sem `discovery/` e sem `plano-pbis.md`, mas com outros
arquivos além do README, aparece como **Fora do fluxo**, sem Fase calculada e sem
pendências. Pasta só com o README é rascunho recém-criado: Sem Discovery.

**RN-FLX-09 · O Azure informa, não manda.** Feature fechada no Azure com Fase antes
de Publicada, ou com PBIs entregues em Discovery, aparece como divergência.

**RN-FLX-10 · As pendências** são as da tabela em [MODELO.md](MODELO.md#as-pendências),
cada uma com a etapa a que pertence.

**RN-FLX-11 · Parada há N dias.** Dias desde a última alteração de um arquivo da
pasta da Feature. Feature em Discovery ou Pronta para quebra parada há mais dias que
o limite do Perfil (padrão 30) é destacada.

**RN-FLX-12 · Reconciliação do PBI.** PBI planejado sem `Azure: #` é comparado com
os filhos da Feature no retrato, pelo título normalizado (sem maiúscula, acento,
pontuação e espaço repetido) e, sem igual, pelo título parecido, porque o PO encurta
o título ao colar. Um candidato: o app mostra, e o clique do PO grava o ID no plano.
Mais de um: o PO escolhe. Até o clique, fica a pendência.

**RN-FLX-13 · Reconciliação da Feature.** A pasta rascunho (`Feature: #a criar`) é
comparada com as Features do Produto da mesma forma. Confirmada, o app grava o ID
no README.

---

## 4. Quebra

| | |
|---|---|
| **Entra** | Feature Pronta para quebra, o catálogo |
| **Sai** | Regras candidatas com a cobertura Requisito → Regra, o plano revisado, os PBIs de desenvolvimento escritos e as regras gravadas no catálogo local |
| **IA** | `quebra` conduz os Passos 0 a 4. No Passo 0, usa as pendências de revalidação. No Passo 4, grava as regras no catálogo com `gravar_arquivo` e lista os domínios alterados |
| **Tela** | Features: a cobertura Regra → PBI e as pendências da quebra |

**RN-FLX-18 · As regras da Feature** são a união das linhas `RNs` dos PBIs do plano.

**RN-FLX-19 · Regra em mais de uma Feature.** A mesma regra nas linhas `RNs` de duas
Features que ainda não estão Publicadas é pendência nas duas: é ID de regra nova
reservado duas vezes, ou duas Features alterando a mesma regra ao mesmo tempo.

**RN-FLX-20 · Revalidação.** Regra citada num Requisito, com `Atualizado` posterior à
`Data` da Decisão de origem, é pendência: "RN-X mudou depois da D2".

---

## 5. Regras

| | |
|---|---|
| **Entra** | A fonte do catálogo e a cópia local |
| **Sai** | A cópia local atualizada; com a publicação ligada, as páginas gravadas na wiki |
| **IA** | Lê com `buscar_regra` e `ler_catalogo`. Não absorve nem publica: os dois gestos são da janela |
| **Tela** | Catálogo: domínios e regras com Status e Validação, o que está a publicar, os botões Absorver e Publicar |

**RN-CAT-01 · A fonte é por Produto.** Wiki do projeto no Azure (nome da wiki e
página raiz, nunca URL) ou `local`: a própria pasta `catalogo/`, mantida pelo PO.

**RN-CAT-02 · A regra é reconhecida pelo título** (decisão M2). O padrão de ID é do
Produto, na Configuração; o padrão de fábrica é `RN-<DOMÍNIO>-<NNN>`.

**RN-CAT-03 · Absorver é gesto, com diferença.** O app mostra, página a página, o
que muda na cópia local. Página que mudou nos dois lados (local e wiki) desde a
última absorção é recusada até o PO escolher qual fica.

**RN-CAT-04 · Citação conferida.** Regra citada num artefato e que não existe no
catálogo, ou está `Descontinuada`, é pendência no artefato.

**RN-CAT-05 · Catálogo consultado** (decisão M5). Outro Produto declarado na
Configuração é lido e citado, nunca gravado.

**RN-CAT-06 · A publicar.** Página da cópia local diferente da última absorção.

**RN-CAT-07 · Publicar** segue o [ADR 0016](../adr/0016-publicacao-opcional-do-catalogo-na-wiki.md):
desligado por padrão, só páginas sob a raiz do catálogo, diferença na janela e
confirmação pelo diálogo do sistema. Depois de publicar, a página publicada vira a
última absorção.

---

## 6. Acompanhamento

| | |
|---|---|
| **Entra** | Bugs do retrato, as Análises de Bug, o catálogo e os planos |
| **Sai** | A Análise de cada bug; bugs por Feature e por regra; as regras a conferir |
| **IA** | `analisar_bug` entrega o Veredito, o Comentário do PO, os Comportamentos e as Regras Afetadas, e grava em `bugs/`. `reescrever_bug` monta o Bug Report |
| **Tela** | Acompanhamento: bugs sem análise, bugs por regra e por Feature, regras a conferir |

**RN-FLX-21 · Análise de Bug.** Um arquivo por bug, com o Veredito e as Regras
Afetadas. Bug do retrato sem arquivo é "sem análise".

**RN-FLX-22 · Bugs por Feature.** Um bug conta para a Feature por dois caminhos: o
vínculo no Azure (filho da Feature ou de um PBI dela) e a regra violada (Origem →
PBI → plano). Conta uma vez, mesmo que os dois caminhos levem à mesma Feature.
Veredito "Não é bug" não conta.

**RN-FLX-23 · Bugs por regra.** Soma dos bugs com Veredito "Bug" por regra violada.

**RN-FLX-24 · Regra a conferir.** Regra `Não validada` cujo PBI de Origem está num
estado de entrega do Perfil de processo.

**RN-FLX-25 · "A validar" volta ao começo.** Análise com Veredito "A validar" e sem
Feature indicada aparece em Oportunidades: regra ausente é oportunidade de Feature.

---

## Regras de segurança e de Configuração

Numeradas na fatia que as implementar, cada uma com o seu teste:

| Área | Regra |
|---|---|
| `RN-SEC` | O servidor MCP grava a proposta e, além dela, só dentro das pastas de trabalho dos Produtos do Perfil (reescreve a `RN-SEC-35`) |
| `RN-SEC` | Caminho com `..`, absoluto ou por link que sai da pasta é recusado |
| `RN-SEC` | Catálogo consultado não é gravável pelo servidor MCP |
| `RN-SEC` | O retrato segue a `RN-SEC-24` (amplia o alcance dela) |
| `RN-SEC` | As seis travas da publicação ([ADR 0016](../adr/0016-publicacao-opcional-do-catalogo-na-wiki.md)), e a `RN-SEC-20` reescrita com a exceção |
| `RN-CFG` | Fonte do catálogo, padrão de ID e catálogos consultados, por Produto |
| `RN-CFG` | Feedback (tipo, área, estados) e o vínculo que o liga à Feature, por Produto |

## Ajuda na tela

Pelo critério do `CLAUDE.md`, três regras contrariam a intuição e levam `HelpTip`:

- **RN-FLX-05:** a Fase não é a linha `Fase:` do README.
- **RN-FLX-22:** a Feature tem bug que não está ligado a ela no Azure.
- **RN-CAT-06:** a regra está gravada, mas ainda não está na wiki.

---

## Uma mudança de princípio, para aprovar

O [DESENHO.md](DESENHO.md) dizia "a IA propõe, o PO aplica" para todo checkpoint.
Na pasta de trabalho, isso pesaria: cada parágrafo de um Brief passaria por um
Aplicar na janela. A proposta é:

- **Onde o app é o dono** (Configuração, instruções do processo): a IA propõe, o PO
  aplica na janela, como hoje.
- **Na pasta de trabalho**: a IA grava direto, e o checkpoint é a conversa, como no
  processo rule-first em uso. A porta de saída é que tem trava: a publicação na wiki e o que o
  PO cola no Azure.

Quem versiona a pasta com git ganha de graça o histórico do que a IA gravou.
