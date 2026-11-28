# A IA do PO enxerga o Azure por um retrato gravado pela janela

**Status:** aceita · 2026-11-24 · resolve a pendência do [ADR 0010](0010-servidor-mcp-local.md)

Para ajudar no fluxo do PO ([desenho](../fluxo-po/DESENHO.md)), a IA do PO precisa
saber quais Features estão abertas, quais PBIs cada uma tem e quais feedbacks
chegaram. O servidor MCP não faz rede nem lê o PAT (`RN-SEC-34`), e isso não muda.

Quem lê o Azure é a janela, como hoje. Ela grava nos Dados de trabalho um
**retrato**: as Features, os itens filhos e os feedbacks dos Produtos do Perfil, com
a data e a hora em que foi tirado. O servidor MCP lê esse arquivo.

O retrato é refeito quando o PO abre a tela do fluxo ou pede para atualizar. A IA
diz ao PO a data do retrato sempre que responde com base nele.

## Por que assim

- **A barreira do servidor MCP fica inteira.** O PAT continua num processo só, o
  da janela.
- **O PO vê o que a IA vê.** O retrato é um arquivo na pasta do Perfil, e é o
  mesmo dado que a tela mostra.
- **Um leitor só do Azure.** Duas consultas independentes, da janela e do
  servidor, dariam respostas diferentes para a mesma pergunta.

## O que sai desta decisão

- **O retrato segue a `RN-SEC-24`:** só campos permitidos, redigidos. Título e
  descrição de work item passam pela redação antes de serem gravados.
- **Regra nova:** o retrato traz a data em que foi tirado, e a ferramenta do MCP a
  devolve junto com o dado.
- **Método novo de leitura no IPC** para Features, filhos e feedbacks.

## Alternativas consideradas

- **Dar o PAT ao servidor MCP:** dois processos com o token, e um deles iniciado
  por um programa de terceiro.
- **O PO colar os dados na conversa:** é o que ele faz hoje, com exportação manual.
  É o atrito que esta feature existe para tirar.

## Consequências

- **O retrato envelhece.** Um PBI criado há um minuto só aparece para a IA depois
  de a janela atualizar. Por isso a data vai junto.
- **A janela precisa ter sido aberta** ao menos uma vez para existir retrato. Sem
  ele, a ferramenta diz ao PO o que fazer.
