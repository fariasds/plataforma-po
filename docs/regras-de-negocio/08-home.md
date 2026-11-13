# Home

**Pergunta que a tela responde:** onde eu estou na sprint, e para onde devo ir
agora?

A Home é **instrutiva**, não um dashboard: ela aponta para a tela de cada momento
do ciclo (Planning, Daily, Review) e, no primeiro acesso, ensina o caminho. Números
de capacidade, entregas e bugs continuam nas telas de cada momento.

O desenho completo, com o que ainda não foi implementado (novidades da versão,
roadmap, ajuda com links externos, tour guiado), está em `docs/home/DESENHO.md`.

**Implementado em:**
`src/shared/home.ts` · `src/renderer/src/features/home/`

---

### RN-HOM-01 · A Home é a tela de entrada

O app abre na Home. A raiz e qualquer rota desconhecida levam a ela, e ela é o
primeiro item do menu lateral, acima do Planning. Antes da Home, a tela de entrada
era a de Entregas da Sprint.

**Implementado em:** `src/renderer/src/routes/index.tsx` ·
`src/renderer/src/components/AppLayout.tsx`

### RN-HOM-02 · Momento da sprint e sugestão para agora

A Home diz em que momento da sprint corrente o PO está e sugere a tela desse
momento. A sprint é a mesma que a Daily usa (`RN-GLB-04`): a corrente ou, entre
duas sprints, a que acabou de terminar. **A sugestão sai só do calendário**; a Home
não consulta os itens da sprint.

- **Régua de dias:** a mesma da Daily (`RN-DLY-17`). Uma casa por dia de semana da
  janela, feriado incluído; no fim de semana vale a próxima casa. Assim o "dia N
  de M" da Home bate com o da Daily.
- **Planning:** antes de a sprint começar e no primeiro dia.
- **Review:** nos dois últimos dias e, depois do fim, até a próxima sprint começar.
- **Daily:** do segundo dia ao antepenúltimo.
- O passo do momento atual, no bloco "Como a plataforma acompanha a sua sprint",
  ganha a etiqueta "Você está aqui".

**Casos de borda**

- Nenhum Produto com sprint, ou falha ao buscar as sprints: a Home sugere o
  Planning e diz que não encontrou sprint. A tela não quebra.
- Sprint de um ou dois dias: o primeiro dia é Planning e o último é Review.
- Fora da janela da sprint não há "dia N". A linha diz que a sprint ainda não
  começou ou que já terminou.

**Implementado em:** `src/shared/home.ts` (`sprintMoment`) ·
`src/renderer/src/features/home/RecurringHome.tsx`

**Testado em:** `src/shared/home.test.ts` e na tela `home` da regressão
(`docs/cenarios.md`).

### RN-HOM-03 · Primeiros passos

No primeiro acesso, a Home mostra boas-vindas e uma lista de quatro passos:

1. Conectar ao Azure DevOps e cadastrar Produtos. Aparece sempre concluído, porque
   quem chega à Home já passou pelo assistente.
2. Montar a primeira Planning.
3. Acompanhar uma Daily.
4. Ver as Entregas da sprint.

Um passo fica concluído quando o PO **abre a tela dele**. Qualquer tela da Review
conclui o quarto passo.

- **Com os quatro concluídos, a Home passa a ser a recorrente.**
- **"Pular e esconder esta lista"** leva à Home recorrente mesmo com passo
  pendente.
- **"Rever primeiros passos"**, na Home recorrente, mostra a lista de novo, mesmo
  com tudo concluído. Nesse caso, o botão do fim da lista é "Concluir e ir para a
  Home".
- A escolha explícita do PO, esconder ou rever, vale sobre a contagem de passos.
- O card "Quer só explorar antes?" leva à demonstração (`RN-GLB-15`). Dentro da
  demonstração ele não aparece.

**Onde fica guardado.** É preferência desta máquina, como o menu recolhido
(`localStorage`), e não Dados de trabalho: não é dado de Produto nem algo que a IA
do PO precise ler. A chave leva o ID do Perfil, para a demonstração não marcar
como visto o que o Perfil real nunca abriu. Sem armazenamento, a lista só não
lembra.

**Implementado em:** `src/shared/home.ts` (`firstStepsState`, `stepForPath`) ·
`src/renderer/src/features/home/first-steps-storage.ts` ·
`src/renderer/src/features/home/FirstAccessHome.tsx`
