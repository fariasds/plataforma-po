# Fluxo do PO de ponta a ponta — desenho

> **Estado: em desenho.** Nada aqui está implementado, e nada começa a ser
> desenvolvido antes de as seis etapas abaixo estarem aprovadas. As regras nascem
> aqui com ID próprio e migram para `docs/regras-de-negocio/` junto com o código,
> sem mudar de ID.

---

## A pergunta que a feature responde

*"Desta oportunidade até a regra publicada e os bugs que vieram depois: em que ponto
cada Feature está, e qual é o meu próximo passo nela?"*

Hoje o app mede o que o time faz (Planning, Daily, Review). Esta feature cobre o
trabalho do próprio PO, antes e depois da sprint.

## O fluxo

```
Oportunidade → Encaixe → Discovery → Quebra → Regras → Acompanhamento
 (feedback do   (Feature   (Brief,     (plano   (regra no  (bugs e ajustes
  Azure ou      aberta     Decisões,   revisado, catálogo)  por Feature
  conversa)     ou nova)   Plano)      PBIs)                e por regra)
```

| Etapa | O PO sai dela com |
|---|---|
| Oportunidade | Uma dor descrita, com a evidência (feedback do Azure ou relato) |
| Encaixe | A oportunidade ligada a uma Feature aberta, ou a proposta de Feature nova |
| Discovery | Brief, Registro de Decisões, Plano de PBIs e os PBIs de design escritos |
| Quebra | Regras candidatas, plano revisado e PBIs de desenvolvimento escritos |
| Regras | As regras gravadas no catálogo do Produto, prontas para o PO publicar |
| Acompanhamento | Cada bug analisado contra a regra, e a regra conferida depois da entrega |

O processo que vem com o app é o **rule-first**: a regra de negócio é definida e
aprovada antes dos PBIs de desenvolvimento, e só entra no catálogo ao final.

---

## Decisões aceitas (2026-11-24)

Os ADRs: D1 [0011](../adr/0011-retrato-do-azure-para-a-ia-do-po.md) ·
D2 [0012](../adr/0012-fluxo-do-po-sem-escrever-work-items.md) ·
D3 [0013](../adr/0013-pasta-de-trabalho-do-produto.md) ·
D4 [0014](../adr/0014-processo-rule-first-nativo-e-alteravel.md) ·
D5 [0015](../adr/0015-catalogo-de-regras-absorvido-de-uma-fonte.md) ·
D6 [0016](../adr/0016-publicacao-opcional-do-catalogo-na-wiki.md).

### D1 · A IA do PO enxerga o Azure por um retrato gravado pela janela

O servidor MCP continua sem rede e sem PAT (`RN-SEC-34`). Quem lê o Azure é a
janela, como hoje. Ela grava nos Dados de trabalho um **retrato** das Features, dos
itens filhos e dos feedbacks, e o servidor MCP lê esse arquivo.

O retrato é atualizado quando o PO abre a tela ou pede para atualizar. Ele traz a
data em que foi tirado, e a IA diz essa data ao PO quando o usa.

O que entra no retrato segue a `RN-SEC-24`: só campos permitidos, redigidos.

*Descartada:* dar o PAT ao servidor MCP para ele consultar o Azure.

### D2 · O app continua sem escrever no Azure

Criar PBI, trocar tag e ligar feedback a Feature continuam sendo gestos do PO no
Azure (`RN-SEC-20`, [ADR 0001](../adr/0001-camada-de-planejamento-local-sobre-features-do-azure.md)).
O app entrega o texto pronto para colar e **reconcilia sozinho**: na leitura
seguinte, reconhece o item criado e preenche o ID.

A única exceção é a publicação do catálogo na wiki (D6).

### D3 · Os artefatos moram numa pasta de trabalho que o PO aponta

Brief, Decisões, Plano de PBIs, PBIs escritos e o catálogo de regras são texto
longo, em Markdown, que o PO quer versionar e abrir fora do app. Eles ficam numa
pasta por Produto, escolhida pelo PO. O app e o servidor MCP leem e gravam só ali.

O caminho da pasta é da máquina: não entra na Configuração, que é compartilhável.

### D4 · O rule-first vem com o app, e o PO pode alterá-lo

O processo padrão vem como prompts do servidor MCP. Os textos de instrução podem
ser substituídos por arquivos na pasta do Perfil, e a própria IA do PO pode propor
a alteração, que o PO revisa e aplica.

### D5 · O app absorve as regras de negócio de cada Produto de uma fonte que o PO define

O catálogo de regras é a base de todo o fluxo: Discovery descreve o "como é hoje"
a partir dele, o PBI cita a regra e o bug é julgado contra ela. Cada Produto diz de
onde vêm as suas regras. Duas fontes previstas:

- **a wiki do projeto no Azure DevOps**, lida pela janela, só com `GET`;
- **uma pasta local** de arquivos Markdown.

A cópia absorvida fica na pasta de trabalho (D3). A publicação de volta na wiki é
a D6.

### D6 · Publicar o catálogo na wiki é opcional, com o mesmo PAT e confirmação a cada escrita

*Aceita em 2026-11-24. É a única exceção à D2.*

O Perfil continua com **um PAT só**. Quem não quer publicar pelo app usa um PAT de
leitura e publica por fora, como já faz. Quem quer, liga a publicação no Perfil e
informa um PAT que também tenha escrita na wiki.

Como o token passa a poder escrever, as travas ficam no app:

- **Desligada por padrão.** Sem o PO ligar a publicação no Perfil, a operação não
  existe na tela nem no contrato de IPC responde.
- **Um caminho de escrita só, separado do de leitura.** O cliente que alimenta as
  telas continua recusando tudo que não é leitura (`RN-SEC-20`). A publicação é
  outra função, a única que escreve, e só aceita gravar página de wiki.
- **Só as páginas que a Configuração indica** como catálogo do Produto.
- **Confirmação a cada publicação, feita pelo processo principal.** A janela mostra
  a diferença página a página; ao publicar, o main abre o diálogo de confirmação do
  sistema com a lista do que será gravado. Sem essa confirmação nada sai, e ela não
  pode ser dada pela janela nem pela IA.
- **O servidor MCP não publica.** Ele segue sem rede e sem PAT (`RN-SEC-34`).
- **Pela API REST.** O app continua sem iniciar processo (`RN-SEC-23`): não há
  `git push`.

Entra como a última fatia da entrega, com ADR e regras de segurança próprios.

*Descartada:* um segundo PAT, só de publicação. Isolaria a escrita, mas o PO teria
dois tokens para criar, renovar e proteger.

---

## Vocabulário

*Aceito em 2026-11-24.* Os termos do rule-first valem como o PO já os usa:
**Discovery**, **Brief da Feature**, **Requisito**, **Decisão**, **Registro de
Decisões**, **Plano de PBIs**, **PBI planejado**, **Quebra**, **Fase** (`Discovery`,
`Pronta para quebra`, `Em quebra`, `Publicada`, `Arquivada`), **Regra de negócio**
(RN), **Catálogo**, **Veredito**, **Regras Afetadas**. Entram no `CONTEXT.md` junto
com o código de cada fatia.

Onde a Plataforma já usava a mesma palavra para outra coisa, quem muda é ela:

| Termo do fluxo | O que muda na Plataforma |
|---|---|
| Discovery | A leitura da organização no Azure, que se chamava `discovery`, passou a `src/shared/organization.ts` e `services/azure/organization.ts` |
| Quebra, Fase | [O estudo do Roadmap](../roadmap/DESENHO.md) é remodelado na etapa 5: "Refinamento" e a "Fase" planejada ganham outros nomes |
| Regra de negócio | Nada na tela. As regras do próprio app (`RN-PLN-07` etc.) só aparecem na documentação de quem desenvolve |

A Fase continua **derivada, nunca digitada** (ver os princípios): os valores são os
do rule-first, mas quem os calcula é o app.

---

## Princípios do desenho

- **Situação derivada, nunca digitada.** Em que ponto uma Feature está sai dos
  artefatos e do Azure: Brief completo, nenhuma Decisão em aberto, PBIs existentes.
  É a mesma ideia da `RN-RDM-07`.
- **A IA propõe, o PO aplica.** Todo checkpoint do fluxo usa o padrão da proposta
  de Configuração (`RN-CFG-12`).
- **Cobertura é validação.** Requisito sem PBI, regra sem PBI e Decisão em aberto
  são acusados por uma ferramenta, e não dependem da disciplina do prompt.
- **O ciclo da regra fecha.** Regra nasce não validada; PBI concluído gera a
  pendência de conferir a regra em uso.
- **Bug realimenta o roadmap.** Bugs por Feature e por regra violada mostram onde o
  Discovery ou a regra falharam.
- **Nada fixo para uma organização.** Domínios do catálogo, formatos de PBI e
  critérios de criticidade vêm do processo do Perfil, nunca do código.

---

## Etapas do desenho

| # | Etapa | Estado |
|---|---|---|
| 1 | Vocabulário: unificar os termos do fluxo com o `CONTEXT.md` | aprovada |
| 2 | Arquitetura: um ADR para cada decisão acima | aprovada |
| 3 | Modelo de domínio: entidades, situações derivadas, rastreabilidade ([MODELO.md](MODELO.md)) | aprovada |
| 4 | Desenho de cada etapa do fluxo: entrada, saída, ferramenta ou prompt, tela, regras ([ETAPAS.md](ETAPAS.md)) | aprovada |
| 5 | Roadmap: juntar o funil de Fase com [a linha do tempo](../roadmap/DESENHO.md) ([ADR 0017](../adr/0017-plano-do-roadmap-na-pasta-de-trabalho.md)) | aprovada |
| 6 | Fatiamento: um PR só, em fatias por commit (abaixo) | em revisão |

---

## Fatiamento: um PR, uma versão, fatias por commit

*Decidido em 2026-11-26: tudo entra num PR só.* O PR é dividido em **fatias**, uma
por commit, na ordem abaixo. Cada fatia:

- passa no `npm run check` sozinha, e é empurrada assim que fica pronta: o PR fica
  aberto como rascunho desde a primeira, e o CI roda a cada fatia;
- leva as suas regras para `docs/regras-de-negocio/` (de `RN-FLX`, `RN-CAT` e
  `RN-RDM`, e as `RN-SEC` e `RN-CFG` numeradas ali), o `HelpTip` quando a regra
  contraria a intuição, e os termos novos no `CONTEXT.md`;
- leva o Cenário das telas que cria. O Cenário do fluxo é a `contoso`, com Features,
  bugs e feedbacks fictícios e uma **pasta de trabalho fictícia** em
  `tests/regression/`;
- leva o teste de segurança de cada barreira nova, que falhou antes de passar.

Só a última fatia sobe a versão e escreve as novidades.

| # | Fatia | Entrega | Regras |
|---|---|---|---|
| 0 | Desenho | Estes documentos e os ADRs 0011 a 0017 | — |
| 1 | Retrato do Azure | Leitura de Features, filhos, feedbacks e bugs; o retrato com data; Configuração de feedback, vínculo e prioridade; o `discovery.ts` atual renomeado | FLX-01, 02 · CFG · SEC (24 ampliada) |
| 2 | Pasta de trabalho e Fase | Escolher a pasta por Produto; ler os artefatos pelas linhas reconhecidas; Fase, checklist, pendências, parada há N dias | FLX-03 a 11, 17 a 20 |
| 3 | Tela Features | Funil por Fase, a Feature aberta com cobertura e pendências, reconciliação de PBI e de Feature com um clique | FLX-12, 13 |
| 4 | Catálogo | Fonte por Produto, absorver da wiki (só `GET`) ou da pasta, com diferença; regra pelo título; citação conferida; catálogos consultados; tela Catálogo | CAT-01 a 06 · CFG |
| 5 | Servidor MCP | As ferramentas de leitura, `gravar_arquivo` presa à pasta, os prompts do rule-first, instrução substituível e `propor_instrucao` | SEC (35 reescrita, caminho, consultado) |
| 6 | Oportunidades e Encaixe | Tela Oportunidades: feedbacks e conversa, encaixe derivado, "A validar" de volta ao começo | FLX-14 a 16, 25 |
| 7 | Acompanhamento | Análises de Bug, bugs por Feature e por regra, regras a conferir | FLX-21 a 24 |
| 8 | Roadmap | `roadmap.json`, Janelas, trilhas e sobrecarga, Fase sobre a Janela, fora da Janela, Minha sprint, marco | RDM-01 a 21 |
| 9 | Publicação na wiki | O caminho de escrita separado, as seis travas, o diálogo do sistema, a tela Segurança | CAT-07 · SEC (20 reescrita, travas) |
| 10 | Versão | `version` e `release-notes.json`, o `CLAUDE.md` e o README atualizados | — |

A ordem vale porque cada fatia usa a anterior: o servidor MCP (5) reaproveita os
leitores de 1, 2 e 4; o Roadmap (8) precisa da Fase (2); a publicação (9) precisa do
catálogo (4) e fica por último, a mais sensível, isolada num commit só.

### O que um PR só custa, e como fica sob controle

- **Revisão.** O PR terá perto de uma centena de arquivos. A revisão é feita **por
  commit**, na ordem das fatias, e não pela diferença inteira.
- **O squash apaga as fatias na `main`.** Ficam no PR, que é para onde o histórico
  aponta.
- **Uma fatia ruim segura todas.** Se uma fatia descoberta depois precisar de
  retrabalho, ela é corrigida num commit novo no mesmo PR; nada é reescrito com
  rebase depois de revisado.
- **A `main` segue sem a feature até o fim.** Correção urgente na `main` durante o
  trabalho entra por PR próprio, e a branch do fluxo é atualizada com rebase.

## Perguntas em aberto

1. **Formato do catálogo absorvido.** A wiki de cada organização tem a sua
   estrutura. O app exige um formato de regra (ID, título, texto) ou absorve o
   texto como está e deixa a IA localizar a regra?
2. **Wiki de projeto ou wiki de código.** O Azure tem as duas. A leitura precisa
   cobrir qual delas, e o PAT do PO precisa de qual escopo de leitura?
3. **De onde vem a oportunidade no Azure.** Tipo de work item, área e estado que
   identificam um feedback entram na Configuração.
4. ~~Relação com o estudo do Roadmap~~ — resolvida na etapa 5: a Janela é o plano,
   a Fase é o fato ([roadmap](../roadmap/DESENHO.md)).
