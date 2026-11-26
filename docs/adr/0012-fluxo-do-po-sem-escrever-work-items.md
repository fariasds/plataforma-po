# O fluxo do PO não escreve work items no Azure

**Status:** aceita · 2026-11-24 · confirma o [ADR 0001](0001-camada-de-planejamento-local-sobre-features-do-azure.md)

O fluxo do PO ([desenho](../fluxo-po/DESENHO.md)) produz coisas que terminam no
Azure: PBIs planejados, descrições de PBI, a ligação de um feedback a uma Feature.
O app **não cria nem altera work item**. Ele entrega o texto pronto para colar, e o
PO faz o gesto no Azure.

O que o app faz é **reconciliar sozinho**: na leitura seguinte, reconhece o PBI
criado sob a Feature e preenche o ID no Plano de PBIs, sem o PO informar.

## Por que assim

- **Escrever work item muda a natureza do produto.** O PAT existe sob a premissa
  de que nada no backlog é alterado a partir daqui.
- **O erro de escrita no backlog é caro e público.** Um PBI criado errado aparece
  para o time inteiro; um texto colado errado, o PO vê antes de salvar.
- **A reconciliação tira a parte chata.** O atrito de hoje é informar os IDs de
  volta, e isso a leitura resolve.

## O que sai desta decisão

- **`RN-SEC-20` não muda para work items.**
- **Regra nova:** como o app reconhece que um item do Azure é o PBI planejado
  (filho da Feature, pelo título), e o que faz quando há dúvida.

## Alternativas consideradas

- **Criar e atualizar PBIs pela API:** exigiria escopo de escrita em work items e
  uma confirmação por item. Pode voltar em decisão própria, depois de o fluxo
  estar em uso.

## Consequências

- **O PO continua colando no Azure.** Um PBI é um copiar e colar; uma Feature com
  dez PBIs são dez.
- A única escrita no Azure é a publicação do catálogo na wiki, opcional, no
  [ADR 0016](0016-publicacao-opcional-do-catalogo-na-wiki.md).
