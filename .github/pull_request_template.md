## O que muda para quem usa

<!-- Em uma ou duas frases. Para mudança visual, um print. -->

## Regras

<!-- IDs criados ou alterados (RN-...). Um resultado aprovado que mudou precisa
     citar aqui a regra que mudou junto. -->

## Definição de pronto

O check **pronto** confere este PR e comenta o resultado. Marque uma caixa só
quando ela for verdade; a marcação fica registrada no PR.

- [ ] Sem mudança de regra de negócio
- [ ] Sem mudança no que as telas mostram
- [ ] A tela mudou, mas não depende de Cenário; a lógica é provada por teste
- [ ] O teste de segurança novo falhou com a barreira desligada
- [ ] O cálculo que contraria a intuição tem `<HelpTip rule="RN-..." />` na tela

<!-- As quatro primeiras dispensam uma etapa do check: use quando a mudança de fato
     não toca regra (uma refatoração) ou tela; quando a tela mostra algo que não
     vem do Azure e é igual em todo Cenário (o teste da lógica precisa estar no
     PR); e conte abaixo como provou o teste de segurança novo. A última é só sua:
     nenhum script julga se um número contraria a intuição. -->

## Como testei
