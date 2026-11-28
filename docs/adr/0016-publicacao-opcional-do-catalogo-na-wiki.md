# Publicar o catálogo na wiki é opcional, com o mesmo PAT e confirmação a cada escrita

**Status:** aceita · 2026-11-24 · abre uma exceção ao [ADR 0001](0001-camada-de-planejamento-local-sobre-features-do-azure.md) e à `RN-SEC-20`

Ao fim da quebra, as regras novas e alteradas estão na cópia local do catálogo
([ADR 0015](0015-catalogo-de-regras-absorvido-de-uma-fonte.md)) e precisam ir para
a wiki do Azure DevOps. O app passa a poder **publicar essas páginas**, se o PO
ligar a função no Perfil. É a única escrita que o app faz no Azure.

O Perfil continua com **um PAT só**. Quem publica pelo app informa um PAT que
também tenha escrita na wiki; quem não publica segue com o de leitura.

## As travas

Com um token que pode escrever, quem garante o limite é o app:

1. **Desligada por padrão.** Sem o PO ligar a publicação no Perfil, a operação não
   aparece na tela, e o handler recusa.
2. **Um caminho de escrita só, separado do de leitura.** O cliente que alimenta as
   telas continua recusando tudo que não é `GET` ou WIQL. A publicação é outra
   função, a única que escreve, e só aceita o endereço de página de wiki.
3. **Só páginas do catálogo.** O caminho precisa estar sob a página que a
   Configuração indica como catálogo do Produto.
4. **Confirmação a cada publicação, dada ao processo principal.** A janela mostra
   a diferença página a página. Ao publicar, o main abre o diálogo de confirmação
   do sistema com a lista do que será gravado. Sem ela, nada sai.
5. **A IA não publica.** O servidor MCP segue sem rede e sem PAT (`RN-SEC-34`), e
   a confirmação não pode ser dada por ele nem pela janela sozinha.
6. **Sem processo.** A gravação é pela API REST; não há `git push` (`RN-SEC-23`).

## Por que assim

- **Um token, e não dois.** Um segundo PAT só de publicação isolaria a escrita,
  mas o PO teria dois segredos para criar, renovar e proteger. A decisão foi por
  um token e travas no app.
- **A confirmação no main, e não só na janela.** Se a janela for comprometida, ela
  ainda não consegue publicar sem o PO clicar num diálogo que ela não desenha.
- **Opcional.** Quem não quer um token com escrita não é obrigado a ter um, e o
  app dele continua incapaz de escrever.

## O que sai desta decisão

- **`RN-SEC-20` é reescrita:** somente leitura, com uma exceção nomeada e cercada.
  O teste dela passa a provar as duas coisas: o cliente de leitura recusa escrita,
  e a função de publicação recusa tudo que não é página do catálogo.
- **Regras novas de segurança**, uma por trava, cada uma com o seu teste.
- **`RN-SEC-31`:** a tela Segurança diz se a publicação está ligada no Perfil e o
  que isso significa para o token.
- **O README e a tela do Perfil** deixam de dizer "só lê" sem ressalva.

## Alternativas consideradas

- **Segundo PAT, só de publicação:** descartada pelo custo de cuidar de dois.
- **O PO publicar por fora** (script, git): continua possível, e é o que acontece
  com a função desligada.
- **`git push` pelo app:** exigiria iniciar processo.

## Consequências

- **Com a publicação ligada, o PAT do Perfil pode escrever.** Um defeito no caminho
  de leitura passa a ter consequência que hoje não tem. Por isso as travas 2 e 3
  são testadas com a barreira desligada.
- **Conflito de edição:** se a página mudou na wiki depois da absorção, a
  publicação é recusada e o PO absorve de novo.
- **Entra como a última fatia da entrega**, sozinha num PR.
