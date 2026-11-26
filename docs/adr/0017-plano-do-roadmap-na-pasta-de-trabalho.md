# O plano do Roadmap mora na pasta de trabalho do Produto

**Status:** aceita · 2026-11-26 · substitui em parte o [ADR 0001](0001-camada-de-planejamento-local-sobre-features-do-azure.md)

O ADR 0001 decidiu que o Azure é dono da lista de Features e que o planejamento
delas fica **na máquina**. A primeira metade continua valendo. A segunda muda: o
plano do Roadmap (Janelas, arquivamento, pesos, limites e marcos) passa a morar num
arquivo `roadmap.json` na **pasta de trabalho** do Produto
([ADR 0013](0013-pasta-de-trabalho-do-produto.md)).

## Por que muda

- **O risco que o ADR 0001 encarava some.** Ele dizia que, trocado o computador, o
  plano sumia sem aviso, e por isso exigia exportar e importar. A pasta de trabalho
  é do PO: versionada, sincronizada, levada junto.
- **O plano fica ao lado do que ele planeja.** As Features que ele sequencia já
  moram na mesma pasta.
- **O rascunho deixa de ter dois lugares.** Rascunho de Feature é uma pasta com
  `Feature: #a criar`; o plano dele fica no `roadmap.json` da mesma pasta.

## O que sai desta decisão

- **`roadmap.json` é do app**, como a Configuração: a janela grava, a IA lê pelo
  servidor MCP e, para mudar, propõe. Por isso ele fica fora de `features/`, onde a
  IA grava direto.
- **O Roadmap exige a pasta de trabalho.** Sem ela, o estado vazio diz o que
  apontar.
- **Exportar e importar o plano** deixam de ser requisito da primeira versão.
- **O cálculo de sobrecarga continua global** (`RN-RDM-12`): o app lê o
  `roadmap.json` de todas as pastas.

## Alternativas consideradas

- **Manter nos Dados de trabalho**, como dizia o ADR 0001: mantém o risco de perda e
  obriga a exportação.
- **Uma linha de plano no README de cada Feature:** espalha o plano por dezenas de
  arquivos e obriga a criar pasta para toda Feature do Azure, mesmo as que ainda nem
  começaram.

## Consequências

- **Dois PO na mesma pasta compartilhada** gravariam o mesmo `roadmap.json`. A
  gravação é atômica, mas a última vence; a pasta de trabalho continua sendo de um
  PO.
- **Uma Feature do Azure sem pasta** pode ter plano: a chave no `roadmap.json` é o
  ID do work item.
