# Home

**Pergunta que a tela responde:** onde eu estou na sprint, e para onde devo ir
agora?

A Home é **instrutiva**, não um dashboard: ela aponta para a tela de cada momento
do ciclo (Planning, Daily, Review) e, no primeiro acesso, ensina o caminho. Números
de capacidade, entregas e bugs continuam nas telas de cada momento.

O desenho completo, com o que ainda não foi implementado (roadmap, ajuda com links
externos, tour guiado), está em `docs/home/DESENHO.md`.

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

Com Squads, a Home não tem abas (`RN-GLB-17`): a sprint é a Sprint unificada de
**todos** os Produtos com sprint, não a da Squad aberta nas outras telas.

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

### RN-HOM-04 · Novidades da versão

*Nova em 2026-11-20.*

O que mudou em cada versão é escrito para quem usa o app, em
`src/shared/release-notes.json`, no mesmo PR que sobe a `version`. Os títulos de PR
não servem para isso ("Bump @electron/asar…"). Cada item tem tipo (**Novo**,
**Melhoria** ou **Correção**), título, uma linha de explicação e, opcionalmente, a
tela para onde leva. A tela é uma chave de uma lista fixa, nunca um endereço: o
arquivo não tem como abrir nada fora do app (`RN-SEC-21`). Um item por versão pode
ser o **destaque**, com um parágrafo mais longo para o modal.

O arquivo vai dentro do app: as novidades aparecem sem rede e sem consultar o GitHub.
O mesmo arquivo monta a seção "Novidades" da página da Release; a lista de PRs fica
recolhida embaixo, como "Mudanças técnicas".

**Na Home, em dois lugares:**

- **Bloco "Novidades da vX.Y.Z"**, sempre à vista na Home recorrente, com os itens
  da versão instalada.
- **Modal**, uma vez por versão, ao abrir a Home depois de atualizar. Mostra o
  destaque, os outros itens e o botão que leva à tela do destaque. Fechar por
  qualquer caminho (botão, Esc, clique fora) marca a versão como vista.

**Quando o modal abre:**

- **Atualizou:** a versão instalada é mais nova que a última vista. Abre com ela.
- **Pulou versões** (da 1.1.0 para a 1.3.0): abre com a instalada no topo e as
  anteriores desde a última vista recolhidas em "Também desde a sua última versão".
- **Instalação nova:** nada guardado nesta máquina, nem os primeiros passos
  (`RN-HOM-03`). Não abre: tudo é novidade, e a Home de primeiro acesso já ensina o
  caminho. A instalada passa a ser a vista.
- **Usava o app antes desta regra existir:** sem versão vista, mas com primeiros
  passos guardados. Abre só com a instalada.
- **Versão só de bastidor:** nenhuma das versões pendentes tem destaque. Não abre;
  a versão aparece no histórico (`RN-HOM-05`).
- **Demonstração** (`RN-GLB-15`): não abre e não marca como vista.

**Onde fica guardado.** A última versão vista é preferência desta máquina
(`localStorage`), como o menu recolhido, e sem o ID do Perfil: quem atualizou foi o
app da máquina. Sem armazenamento, o modal não abre.

**Garantido por teste:** `npm run test` confere o formato do arquivo, a ordem das
versões (da mais nova para a mais antiga) e que a `version` do `package.json` tem
entrada, no topo. Subir a versão sem escrever as novidades barra o `check`.

**Implementado em:** `src/shared/release-notes.ts` (`releaseModalDecision`) ·
`src/shared/release-notes.json` · `src/renderer/src/features/release-notes/` ·
`src/renderer/src/features/home/HomeScreen.tsx` · `scripts/release-notes.mjs`

**Testado em:** `src/shared/release-notes.test.ts` ·
`tests/esteira/release-notes.test.ts`

### RN-HOM-05 · Histórico de novidades

*Nova em 2026-11-20.*

A tela **Novidades** lista todas as versões, da mais nova para a mais antiga, com a
data e a etiqueta "Instalada" na versão em uso. Não está no menu lateral: abre pela
etiqueta da versão no cabeçalho da Home, pelo link "Todas as notas de versão" do
bloco e pelo "Ver todas as notas" do modal.

- **Busca** no título e na explicação de cada item, sem diferenciar acento nem
  maiúscula ("analise" acha "Análise"), e pelo número da versão, com ou sem `v`
  ("1.2" acha a 1.2.0 e a 1.2.1). O trecho encontrado fica realçado.
- **Filtro por tipo:** Todos, Novo, Melhoria, Correção.
- Versão sem item que passe na busca e no filtro some da lista. Sem resultado, a
  tela diz que nada foi encontrado e oferece limpar a busca.

**Implementado em:** `src/shared/release-notes.ts` (`searchReleaseNotes`) ·
`src/renderer/src/features/release-notes/ReleaseNotesScreen.tsx`

**Testado em:** `src/shared/release-notes.test.ts`
