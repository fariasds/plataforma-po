# Fluxo do PO — modelo de domínio

> **Estado: em desenho (etapa 3 de [DESENHO.md](DESENHO.md)).** Este arquivo diz
> quais coisas existem, onde cada uma mora, como o app as reconhece e o que ele
> calcula a partir delas. As regras com ID nascem na etapa 4, a partir daqui.

---

## Visão geral

```
Produto ──── fonte do catálogo ───► Catálogo ─► Domínio ─► Regra
   │                                                         ▲  ▲
   │                                          cria/altera    │  │ viola / preserva
   ▼                                                         │  │
Oportunidade ──encaixe──► Feature ─► Requisito ─► PBI planejado ─► PBI no Azure
 (feedback                  │  │          ▲            │
  ou conversa)              │  └► Decisão ┘            └► PBI escrito (design / dev)
                            │
                            └──────────────────────── Análise de Bug ◄── Bug no Azure
```

A cadeia que o app mantém de pé é **Oportunidade → Feature → Requisito → PBI →
Regra**, e de volta, **Bug → Regra violada → PBI de origem → Feature**. É essa volta
que permite contar bugs por Feature mesmo quando o bug não foi ligado a ela no
Azure.

---

## Onde cada coisa mora

| Coisa | Dono | Onde |
|---|---|---|
| Feature, PBI, Bug, feedback (ID, título, estado, pai) | **Azure DevOps** | lidos pela janela, gravados no retrato ([ADR 0011](../adr/0011-retrato-do-azure-para-a-ia-do-po.md)) |
| Catálogo oficial | **Wiki do Azure** ou pasta do PO | absorvido para a pasta de trabalho ([ADR 0015](../adr/0015-catalogo-de-regras-absorvido-de-uma-fonte.md)) |
| Brief, Decisões, Plano de PBIs, PBIs escritos, Análises de Bug, Oportunidades da conversa, cópia do catálogo | **PO** | pasta de trabalho ([ADR 0013](../adr/0013-pasta-de-trabalho-do-produto.md)) |
| Plano do Roadmap (Janelas, pesos, limites, marcos) | **PO**, gravado pela janela | `roadmap.json` na pasta de trabalho ([ADR 0017](../adr/0017-plano-do-roadmap-na-pasta-de-trabalho.md)) |
| Fonte do catálogo, padrão do ID de regra, como o feedback se liga à Feature | **Configuração** | `configuracao.json` |
| Caminho da pasta de trabalho, retrato, última absorção | **Máquina** | Dados de trabalho |
| Fase, pendências, cobertura, bugs por Feature | **ninguém: calculado** | nunca gravado |

### A pasta de trabalho

```
<pasta de trabalho>/
├── roadmap.json                         ← plano do Roadmap; gravado só pela janela
├── catalogo/<domínio>.md                ← cópia absorvida; uma página da wiki = um arquivo
├── features/
│   └── <slug>/
│       ├── README.md                    ← liga a pasta à Feature do Azure
│       ├── plano-pbis.md
│       ├── discovery/
│       │   ├── brief.md
│       │   ├── decisoes.md
│       │   └── apoio/                   ← livre: o app não lê
│       ├── PBI-DESIGN-<id>-<slug>.md
│       └── PBI-<id>-<slug>.md
├── oportunidades/<AAAA-MM-DD>-<slug>.md ← as que nasceram de conversa
└── bugs/BUG-<id>-<slug>.md              ← Análises de Bug
```

É a estrutura do processo rule-first, com duas pastas a mais (`oportunidades/`
e `bugs/`). Cada Produto tem a sua pasta.

---

## Entidades

### Produto *(já existe)*

Ganha dois atributos: a **fonte do catálogo** (na Configuração) e a **pasta de
trabalho** (na máquina). **Cada Produto tem a sua pasta, e duas não se misturam.**

Um Produto pode **consultar** o catálogo de outro, declarado na Configuração. A IA lê
e cita as regras dele, mas não grava lá: a regra que pertence ao outro Produto muda
numa Feature do outro Produto.

### Catálogo, Domínio e Regra

O **Catálogo** é o conjunto das regras de um Produto. Divide-se em **Domínios**, um
por arquivo (uma página da wiki). A **Regra** é reconhecida pelo título:

```
### RN-LOG-001 · Fluxo pós-autenticação
`Status: Ativa` · `Validação: Não validada` · `Origem: 16284; 16925` · `Relacionadas: RN-LOG-002` · `Atualizado: 2026-07-05`

**Descrição:** …
**Comportamento:** …
**Exceções:** …
```

| Atributo | O app usa para |
|---|---|
| ID | citar, validar citação, acusar ID repetido |
| Título | mostrar |
| Status (`Ativa`, `Em revisão`, `Descontinuada`) | não sugerir regra descontinuada |
| Validação (`Não validada`, `Validada (data)`, `Divergente`) | cobrar a conferência depois da entrega |
| Origem (IDs de PBI) | ligar a regra à Feature, e o bug à Feature |
| Atualizado | revalidar o Discovery: a regra mudou depois da Decisão? |
| Corpo (Descrição, Comportamento, Exceções, Atualizações) | só a IA lê; o app não interpreta |

### Oportunidade

Uma dor com evidência, ainda sem Feature. Duas origens: **feedback do Azure** (o
tipo de work item, a área e o estado vêm da Configuração) ou **conversa** (um
arquivo em `oportunidades/`, que a IA grava).

### Feature

O work item de tipo Feature no Azure, mais a sua pasta em `features/`. A ligação é
a linha `Feature: #<id>` do README. Pasta com `Feature: #a criar` é **rascunho**;
Feature do Azure sem pasta ainda não começou o Discovery.

### Brief, Requisito, Decisão

Como no rule-first. O app lê do Brief só o que o checklist precisa: as seções
preenchidas, os Requisitos (`**R1** ·`) com as Decisões de origem e as Perguntas em
aberto com a marca `bloqueia a quebra`. Da Decisão (`### D1 ·`), o `Status` e a
`Data`.

### Plano de PBIs, PBI planejado, PBI escrito

O **PBI planejado** (`### P1 · DEV · Título`) traz `Azure: #<id>`, `Status`,
`Requisitos`, `Decisões` e, depois da revisão do plano, `RNs`. O **PBI escrito** é o
arquivo `PBI-*.md` ou `PBI-DESIGN-*.md`. As **regras da Feature** são a soma das
linhas `RNs` do plano.

### Análise de Bug

Um arquivo por bug do Azure, com **Veredito** (`Bug`, `Não é bug`, `A validar`) e
**Regras Afetadas** (Violada e Preservar). O app lê o veredito e os IDs.

---

## O que o app calcula

### A Fase

Calculada a cada leitura, nunca digitada. A linha `Fase:` do README deixa de ser
lida; se existir e divergir do cálculo, o app mostra as duas.

| Fase | Quando |
|---|---|
| **Sem Discovery** | Feature aberta no Azure sem pasta, ou pasta só com o README (o rascunho recém-criado) |
| **Discovery** | Pasta existe, e o checklist abaixo não fecha |
| **Pronta para quebra** | O checklist fecha, e nenhuma regra da Feature foi escrita |
| **Em quebra** | Há regra na linha `RNs` do plano, e nem todas estão gravadas no catálogo |
| **Publicada** | Toda regra da Feature está no catálogo, com um PBI da Feature na Origem ou nas Atualizações |
| **Arquivada** | O PO arquivou. É o único gesto, e fica no README (`Arquivada: <data> · <motivo>`) |

Checklist de "Pronta para quebra" (o Passo 6 do rule-first, verificado pelo app):

- Brief com Problema, Para quem, Objetivo e Escopo preenchidos
- Nenhuma Decisão em `Proposta`
- Nenhuma Pergunta em aberto marcada `bloqueia a quebra`
- Plano de PBIs existe, e todo Requisito tem PBI ou justificativa
- Todo PBI `DESIGN` e `AJUSTE VISUAL` do plano está `Escrito`

Feature **Publicada** com catálogo local diferente da wiki fica marcada **a
publicar**. O estado da Feature no Azure **informa e não manda**: Feature `Closed`
em Discovery é divergência a olhar, como na `RN-RDM-08`.

### As pendências

O "próximo passo" de cada Feature é a lista das pendências dela. Cada uma vira regra
na etapa 4.

| Pendência | Etapa do fluxo |
|---|---|
| Oportunidade sem encaixe | Encaixe |
| Decisão em `Proposta` · Pergunta que bloqueia | Discovery |
| Requisito sem PBI e sem justificativa | Discovery |
| PBI planejado sem ID do Azure, **com o candidato encontrado** | Discovery |
| Regra da Feature sem PBI de desenvolvimento | Quebra |
| Mesmo ID de regra nova em duas Features | Quebra |
| Regra citada que não existe no catálogo, ou está descontinuada | Discovery, Quebra, Bug |
| Regra citada que mudou depois da Decisão (`Atualizado` > `Data`) | Quebra (revalidação) |
| Catálogo local diferente da wiki | Regras |
| Regra `Não validada` cujo PBI de origem está entregue | Acompanhamento |
| Bug sem Análise · Análise `A validar` sem Feature | Acompanhamento |

### Bugs por Feature e por Regra

Bug com Análise → Regra violada → PBI na Origem → Feature cujo plano tem esse PBI.
O app soma por Feature e por Regra. Regra que acumula bugs aponta Discovery ou regra
mal escrita.

### A reconciliação com o Azure

PBI planejado sem `Azure: #<id>` é comparado com os filhos da Feature no retrato.
Título igual, desconsiderando maiúsculas, acento e espaço, é **candidato**: o app
mostra e o PO confirma com um clique, que grava o ID no plano. Dois candidatos, ou
nenhum, ficam como pendência. O mesmo vale para a Feature de uma pasta rascunho.

---

## Decisões do modelo, para aprovar

**M1 · Markdown com linhas que o app reconhece.** Os artefatos continuam sendo os
arquivos do rule-first. O app só lê as linhas que os templates já têm (`### D1 ·`,
`Status:`, `Azure: #`, `**R1** ·`). Linha fora do padrão aparece como "não
reconhecida", nunca é ignorada em silêncio. *Alternativa:* um JSON ao lado de cada
Markdown, mais robusto e ilegível para o PO.

**M2 · A regra é reconhecida pelo título, com um padrão de ID por Produto.** O
padrão padrão é `### <ID> · <Título>` com ID `RN-<DOMÍNIO>-<NNN>`; outra organização
troca o padrão na Configuração. Página absorvida sem nenhuma regra reconhecida entra
como texto, e o app avisa que ali não consegue validar citação. Responde à pergunta
em aberto do [ADR 0015](../adr/0015-catalogo-de-regras-absorvido-de-uma-fonte.md).

**M3 · A Fase é calculada, e "Arquivada" é o único gesto.** Os valores são os do
rule-first, mais **Sem Discovery** para a Feature do Azure que ainda não tem pasta.

**M4 · O ID da regra nova continua sendo dado na quebra.** O rule-first atribui o
ID no Passo 1 e reconfere no Passo 4. O app não muda isso: ele passa a acusar o
mesmo ID em duas Features, que é o risco que a reconferência cobria à mão.

**M5 · Uma pasta de trabalho por Produto, sem compartilhar.** A Feature pertence a
um Produto só. Quando ela depende de regra de outro Produto, consulta o catálogo
dele, só para ler e citar. Regra a criar ou alterar no outro Produto vira Feature
lá. *Descartada:* pasta compartilhada entre Produtos, que misturaria catálogos que
evoluem em boards diferentes.

**M6 · O app lê apenas o que precisa.** `discovery/apoio/`, o corpo das regras e o
texto dos PBIs são da IA e do PO. O app não interpreta prosa.

## Perguntas em aberto

1. **Como o feedback se liga à Feature no Azure.** Numa organização, o feedback é **pai** da
   Feature. Outra organização pode usar filho ou "relacionado". Proposta: a
   Configuração diz qual vínculo vale.
2. **Bug ligado direto à Feature.** Quando o bug é filho de um PBI ou da Feature no
   Azure, esse vínculo conta junto com o que vem pela regra violada, ou só um deles?
3. **Features anteriores ao fluxo** (pasta sem `discovery/`). Hoje seguem o processo antigo. O app
   as mostra como estão, sem calcular Fase, ou calcula com o que houver?
