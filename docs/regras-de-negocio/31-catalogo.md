# Catálogo de regras

**Pergunta que esta área responde:** quais são as regras de negócio do Produto, o que
mudou nelas desde a wiki e o que ainda não foi publicado?

O catálogo é a base do fluxo do PO: o Discovery descreve o "como é hoje" a partir
dele, o PBI cita a regra e o bug é julgado contra ela
([ADR 0015](../adr/0015-catalogo-de-regras-absorvido-de-uma-fonte.md)). São as regras
**dos produtos do PO**, não as do app: o ID delas tem três dígitos (`RN-DOC-045`),
e as do app, dois (`RN-PLN-07`).

**Implementado em:**
`src/shared/flow-catalog.ts` · `src/shared/flow-absorb.ts` · `src/main/services/flow/catalog.ts` ·
`src/main/services/flow/absorb.ts` · `src/main/services/azure/wiki.ts` ·
`src/renderer/src/features/flow/CatalogScreen.tsx`

---

### RN-CAT-01 · A fonte é por Produto

Cada Produto declara de onde vêm as regras dele, em `catalog.source` (`RN-CFG-15`):

- **`wiki`**: a wiki do projeto no Azure DevOps, pelo nome da wiki e pela página raiz
  do catálogo do Produto (por exemplo, `/Catálogo de Regras/Loja`). As páginas abaixo da
  raiz são os domínios. Nunca uma URL (`RN-CFG-04`): o host é sempre o da organização.
- **`local`**: o catálogo é a pasta `catalogo/` da pasta de trabalho, mantida pelo PO.
  Serve a quem guarda as regras em outro lugar e exporta para Markdown.

Nos dois casos, o que o app lê é `catalogo/`, na pasta de trabalho do Produto. Sem
`catalog` na Configuração, o fluxo funciona sem catálogo, e nenhuma Feature chega a
Publicada (`RN-FLX-05`).

**Fonte no Azure:** a árvore de páginas abaixo da raiz (`pages?path=…&recursionLevel=full`)
e, depois, o conteúdo de cada página (`includeContent=true`). Só `GET`, no mesmo
cliente das telas (`RN-SEC-18`, `RN-SEC-20`); o PAT precisa do escopo de leitura da
wiki (`vso.wiki`). Página só de agrupamento, sem texto, não vira arquivo. Até 300
páginas.

### RN-CAT-02 · A regra é reconhecida pelo título

Uma regra é o título `### <ID> · <título>`, e o ID segue o padrão do Produto
(`catalog.ruleIdPattern`). O padrão de fábrica, `RN-[A-Z]+(?:-[A-Z]+)*-\d+`, aceita
`RN-DOC-045` e `RN-ELN-APP-001`. Logo abaixo do título, o app lê:

| Marca | Valores |
|---|---|
| `Status:` | `Ativa`, `Em revisão`, `Descontinuada` |
| `Validação:` | `Não validada`, `Validada (data)`, `Divergente` |
| `Origem:` | os PBIs, sem o que está entre parênteses |
| `Atualizado:` | `AAAA-MM-DD` |

E, no corpo, os PBIs citados no bloco **Atualizações**. O resto do texto é da IA e do
PO. ID que aparece em mais de uma página é apontado; vale o primeiro.

**Casos de borda:** página sem nenhuma regra reconhecida entra como texto, e a tela diz
"nenhuma regra reconhecida". A tabela de varredura no topo da página não é regra.

### RN-CAT-03 · Absorver é gesto, com diferença

Absorver traz a wiki para `catalogo/`, e só acontece quando o PO pede. Antes, a tela
mostra, página a página, o que mudaria e quais regras entram, mudam e saem. A
comparação é com a **última absorção**, anotada em `catalogo/.absorcao.json`:

| Situação da página | O que a absorção faz |
|---|---|
| Nova na wiki | Entra |
| Mudou só na wiki | Entra |
| Igual | Nada |
| Mudou só na pasta | Fica, e continua a publicar (`RN-CAT-06`) |
| Mudou nos dois lados | Fica, a não ser que o PO marque **Usar a da wiki** |
| Saiu da wiki | Fica na pasta, sem vínculo |

- **A wiki é lida de novo na hora de absorver**: entra o que está lá agora.
- **Ou entra tudo, ou nada:** todos os caminhos são conferidos antes do primeiro
  arquivo ser gravado (`RN-SEC-37`).
- O arquivo de cada página sai do caminho dela abaixo da raiz, uma pasta por nível;
  caractere que o Windows não aceita vira hífen.

### RN-CAT-04 · Citação conferida

Com catálogo, o quadro do fluxo confere as regras que cada Feature cita (`RN-FLX-10`):

- regra citada no Brief que **não existe** no catálogo do Produto nem nos consultados
  é pendência, a não ser que esteja no plano, onde ela é regra nova;
- regra **descontinuada**, citada no Brief ou no plano, é pendência.

### RN-CAT-05 · Catálogo consultado

Um Produto pode consultar o catálogo de outro (`catalog.consults`). A regra dele vale
para a citação (`RN-CAT-04`) e a IA a lê, mas o app nunca grava no catálogo de outro
Produto: a regra que pertence a ele muda numa Feature dele. A consulta lê a pasta de
trabalho do outro Produto, que precisa estar escolhida.

### RN-CAT-06 · A publicar

Com a wiki como fonte, a página da pasta que está **diferente da última absorção**, ou
que **nunca veio dela**, está a publicar: a regra está gravada no catálogo da pasta,
mas ainda não na wiki, que é a versão oficial. A comparação ignora a diferença de fim
de linha.

### RN-CAT-07 · Publicar na wiki

*Nova em 2026-11-27 (ADR 0016).* Com a publicação ligada no Perfil (`RN-SEC-39`), o
botão **Publicar na wiki** lista as páginas a publicar; o PO escolhe, e o app confere,
página a página, a wiki **antes** de pedir a confirmação:

- **Página que veio da absorção:** o conteúdo na wiki tem de ser o da última absorção.
  Se mudou (ou sumiu), a publicação inteira é recusada com `CATALOG_CONFLICT`: o PO
  absorve de novo e resolve a diferença primeiro.
- **Página nova, que nunca veio da wiki:** não pode existir na wiki ainda. O caminho é a
  raiz mais o nome do arquivo, sem `.md`; nome que a absorção não devolveria ao mesmo
  arquivo é recusado.

Confirmado o diálogo do sistema (`RN-SEC-41`), cada página vai com o ETag lido, e o Azure
recusa se ela mudou nesse meio-tempo. O que foi publicado vira a nova base da absorção
(`.absorcao.json`) e deixa de estar a publicar.

---

## A tela Catálogo

**Pergunta que responde:** quais regras o Produto tem, e o que falta levar para a wiki?

- **Por Produto**, no `ProductFilter`, como a tela Features.
- A fonte, a data da última absorção e o botão **Absorver da wiki**, que abre a
  diferença (`RN-CAT-03`).
- Uma linha por página, com o título, o arquivo, quantas regras e a marca **a publicar**
  (`RN-CAT-06`); aberta, a tabela das regras com ID, título, status, validação e data.
- Sem catálogo na Configuração, ou sem pasta de trabalho, a tela diz o que configurar.
