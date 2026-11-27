# O processo rule-first vem com o app, e o PO pode alterá-lo

**Status:** aceita · 2026-11-24 · concretiza o que o [ADR 0010](0010-servidor-mcp-local.md) previu

O fluxo do PO ([desenho](../fluxo-po/DESENHO.md)) segue um processo: quais passos o
Discovery tem, onde o PO aprova, que formato tem um PBI, como se analisa um bug. O
app traz um processo padrão, o **rule-first**: a regra de negócio é definida e
aprovada antes dos PBIs de desenvolvimento e só entra no catálogo ao final.

O processo chega à IA do PO como **prompts do servidor MCP**, um por tarefa
(Discovery, quebra, PBI de desenvolvimento, PBI de design, análise de bug). O texto
de cada instrução pode ser substituído por um arquivo na pasta do Perfil. A própria
IA pode propor a alteração, que o PO revisa e aplica.

## Por que assim

- **Funciona no primeiro uso.** O PO que não tem processo escrito começa com um
  que já foi usado em produto real.
- **Processo é do PO, não do app.** Cada time escreve PBI de um jeito. Instrução
  fixa no código contrariaria a regra de nada fixo para uma organização.
- **Instrução é texto, estrutura é código.** O que o app verifica (Decisão em
  aberto, Requisito sem PBI, a Fase) é fixo. O que orienta a IA (tom, formato do
  PBI, critério de criticidade) é do PO.

## O que sai desta decisão

- **Os textos padrão moram no repositório**, neutros: sem nome de organização, de
  produto ou de domínio de regra.
- **Alteração de instrução é proposta**, como a da Configuração (`RN-CFG-12`): a
  IA grava a proposta, o PO vê a diferença e aplica.
- **Voltar ao padrão** é apagar o arquivo do Perfil.

## Como ficou na implementação (2026-11-27)

- Os textos de fábrica estão em `resources/mcp/rule-first/`, um por prompt.
- O texto do PO é `instrucoes/<nome>.md`, na pasta do Perfil; a proposta da IA,
  `instrucoes/<nome>.proposta.md`. O PO lê o texto proposto e aplica ou descarta no
  cartão "Instruções do processo", na Configuração (`RN-FLX-26`). A diferença linha a
  linha, que a decisão previa, ainda não existe: o PO lê o texto inteiro.
- O app ainda não avisa quando o texto de fábrica muda numa versão nova e o PO tem o
  dele: fica como pendência do desenho.

## Alternativas consideradas

- **Só o processo fixo:** serviria a um PO.
- **Processo todo configurável, inclusive passos e Fases:** a Fase deixaria de ser
  calculável, e a tela do fluxo não teria o que mostrar.

## Consequências

- **Quem altera a instrução pode piorar o resultado.** O app valida a estrutura
  dos artefatos, não a qualidade do texto.
- **Versão nova do app pode trazer instrução melhor.** Quem substituiu o arquivo
  fica com a sua; o app avisa que o padrão mudou.
