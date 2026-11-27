# O catálogo de regras de cada Produto é absorvido de uma fonte que o PO define

**Status:** aceita · 2026-11-24

Todo o fluxo do PO ([desenho](../fluxo-po/DESENHO.md)) se apoia nas regras de
negócio do Produto: o Discovery descreve o "como é hoje" a partir delas, o PBI cita
a regra e o bug é julgado contra ela. Essas regras já existem em algum lugar da
organização do PO. O app as **absorve** para a pasta de trabalho do Produto
([ADR 0013](0013-pasta-de-trabalho-do-produto.md)), e é dessa cópia que a IA lê.

Cada Produto declara a sua fonte. Duas são previstas:

- **a wiki do projeto no Azure DevOps**, lida pela janela, só com `GET`;
- **uma pasta local** de arquivos Markdown.

## Por que assim

- **A wiki do Azure é onde muitas organizações já publicam as regras**, e a janela
  já fala com esse host, com o mesmo PAT.
- **Cópia local, e não leitura a cada pergunta.** O servidor MCP não faz rede
  (`RN-SEC-34`), e a IA precisa ler o catálogo inteiro várias vezes numa tarefa.
- **A pasta local cobre o resto:** quem tem as regras em outro sistema exporta
  para Markdown.

## O que sai desta decisão

- **A fonte entra na Configuração**, como nome de wiki e caminho de página, nunca
  como URL (`RN-CFG-04`).
- **`RN-SEC-18` não muda:** a wiki é lida no mesmo host, pelo mesmo `fetch`.
- **Absorver é um gesto do PO**, com a diferença mostrada antes de substituir a
  cópia: uma regra editada localmente e ainda não publicada não pode sumir em
  silêncio.

## Alternativas consideradas

- **O PO manter o catálogo só na pasta de trabalho:** a wiki e a pasta divergiriam
  no primeiro ajuste feito direto na wiki.
- **Ler qualquer URL:** o PAT sairia para outro servidor.

## Como ficou na implementação (2026-11-27)

- **A fonte `local` é a própria pasta `catalogo/`** da pasta de trabalho, e não uma
  segunda pasta de onde se absorve: quem guarda as regras em outro sistema exporta
  para lá.
- **O formato é o do processo rule-first**, reconhecido pelo título (`RN-CAT-02`), e o
  padrão de ID é do Produto. O de fábrica aceita ID com subdomínio (`RN-ELN-APP-001`).
- **A árvore e o conteúdo são lidos separados**: a documentação da API não garante o
  conteúdo das subpáginas na leitura recursiva.

## O que estava em aberto

- **Formato:** resolvido pela decisão M2 do [modelo de domínio](../fluxo-po/MODELO.md):
  o app reconhece a regra pelo título, e o texto vai como está.
- **Wiki de projeto ou wiki de código:** a mesma rota de páginas serve às duas, pelo
  nome da wiki. O escopo de leitura é `vso.wiki`. Falta conferir com uma wiki real se a
  página que só agrupa outras vem sem conteúdo, como o app supõe.

## Consequências

- **Há duas cópias, e uma é a oficial.** A wiki manda; a cópia local é rascunho
  até ser publicada ([ADR 0016](0016-publicacao-opcional-do-catalogo-na-wiki.md)).
- **Catálogo grande** (centenas de regras) é lido pela IA por domínio, não inteiro.
