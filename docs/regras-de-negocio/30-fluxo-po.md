# Fluxo do PO

**Pergunta que esta área responde:** desta oportunidade até a regra publicada e os
bugs que vieram depois, em que ponto cada Feature está, e qual é o próximo passo nela?

O desenho inteiro, com as etapas que ainda não foram implementadas, está em
[docs/fluxo-po/](../fluxo-po/DESENHO.md). As regras `RN-FLX` nascem em
[ETAPAS.md](../fluxo-po/ETAPAS.md) e chegam aqui, sem mudar de ID, junto com o código
de cada fatia.

**Implementado em:**
`src/shared/flow-snapshot.ts` · `src/main/services/azure/flow-snapshot.ts` ·
`src/main/ipc/flow-handlers.ts`

---

## O retrato do Azure

A IA do PO precisa saber quais Features estão abertas, o que cada uma tem embaixo e
o que chegou de feedback. O servidor MCP não fala com o Azure nem lê o PAT
(`RN-SEC-34`). Quem lê é a janela, que grava um **retrato** nos Dados de trabalho, e é
desse arquivo que o servidor lê ([ADR 0011](../adr/0011-retrato-do-azure-para-a-ia-do-po.md)).

### RN-FLX-01 · O que o retrato guarda

Um retrato por Produto, na chave `flow:snapshot:<id do Produto>` (`RN-CFG-08`):

| Coleção | O que entra | Campos |
|---|---|---|
| **Features** | Itens do tipo `poFlow.featureType` no escopo do Produto (projeto e áreas, `RN-GLB-01`), **abertos ou fechados nos últimos 180 dias** | ID, tipo, título, estado, pai, prioridade, criação, última troca de estado, IDs dos filhos |
| **Filhos** | Os filhos de cada Feature, de qualquer tipo, **mesmo em outra área ou outro projeto** | ID, tipo, título, estado, pai |
| **Feedbacks** | Itens do tipo `poFlow.feedback.type`, nos estados declarados, nas áreas do feedback (ou nas do Produto) | ID, tipo, título, estado, pai, descrição, Features ligadas |
| **Bugs** | Itens do `bugType` do Perfil de processo no escopo do Produto, **abertos ou fechados nos últimos 180 dias** | ID, tipo, título, estado, pai, criação, fechamento, aberto ou não, descrição |

- **"Fechado"** é estar num `terminalStates` do Perfil de processo; a data é a da
  última troca de estado (`StateChangeDate`). Item num `removedStates` nunca entra.
- **A Feature ligada ao feedback** segue o vínculo da Configuração (`RN-CFG-14`): o
  feedback é pai da Feature, é filho dela, ou tem vínculo "Related" com ela. Só
  contam as Features que estão no retrato.
- **A descrição vai só no feedback e no bug aberto**, que são o que ainda vai ser
  trabalhado. Bug fechado entra com a descrição vazia.
- **Título e descrição seguem a `RN-SEC-24`:** campo a campo, em texto puro e
  redigidos. Título numa linha, até 300 caracteres; descrição até 4.000 caracteres,
  e o conjunto das descrições até 400.000, em fatias iguais quando passa disso.
- **Prioridade** é o valor numérico de `poFlow.priorityField`. Campo que não existe
  no projeto, ou vazio no item, vira `null`; a leitura não falha por isso.

**Fonte no Azure:** um WIQL por coleção e leituras em lote. As Features são lidas
com os vínculos (`$expand=relations`), e é deles que saem os filhos; o feedback com
vínculo "Related" também. Nenhuma escrita (`RN-SEC-20`).

**Casos de borda:** Produto sem feedback na Configuração grava `feedbacks: null`, para
a IA distinguir "não configurado" de "nenhum feedback". Filho apagado ou sem acesso
fica de fora, sem erro. Feature sem filho tem a lista vazia.

### RN-FLX-02 · O retrato tem data

O retrato guarda quando foi tirado (`takenAt`, com hora) e o primeiro dia da janela
de fechados (`windowStart`). Ele é refeito quando a janela pede (`refreshFlowSnapshot`);
as telas do fluxo, que chegam nas próximas fatias, pedem ao abrir e no botão
Atualizar.

- **A janela recebe só o resumo:** as contagens e a data. A descrição não atravessa
  para ela (`RN-SEC-24`).
- **A IA diz a data ao PO.** Toda ferramenta do servidor MCP que usar o retrato
  devolve a data junto, e a instrução manda a IA dizê-la, porque um PBI criado depois
  do retrato não está nele.

**Casos de borda:** sem retrato gravado, a ferramenta do MCP diz ao PO para abrir o
app. Um retrato maior que 1 MB não é gravado, e o erro diz isso (`RN-CFG-08`).

**Implementado em:** `src/main/services/azure/flow-snapshot.ts` ·
`src/shared/flow-snapshot.ts`
