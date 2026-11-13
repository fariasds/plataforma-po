# Home — desenho e decisões

> **Estado: fase 1 implementada (12/11/2026).** Este documento registra a conversa
> de desenho da tela Home e serve de referência para o que falta. As regras do que
> já existe estão em `docs/regras-de-negocio/08-home.md` (`RN-HOM-01` a `03`).
>
> **Fase 1 (feito):** Home como tela de entrada e primeiro item do menu (D-01 a
> D-03); quadro B com boas-vindas, primeiros passos e o card da demonstração; quadro
> A com saudação, contexto da sprint, sugestão para agora pela fase da sprint (A-01,
> opção a), ciclo com "Você está aqui" e dicas rápidas; versão no cabeçalho.
> A-03 decidido: `localStorage` por Perfil. A-05 parcial: o link do card do ciclo é
> "Rever primeiros passos", que reabre o quadro B.
>
> **Fase 2 (pendente):** bloco e modal de novidades (D-05, A-02, `changelog.json`);
> "O que vem por aí" (A-04, `roadmap.json`); card Ajuda, "Ajuda e atalhos" e links
> de notas e sugestões, que dependem de revisar a `RN-SEC-21` (hoje o app só abre
> links de `dev.azure.com`); tour com `Tour` do Ant Design; sugestão com dados do
> Azure (A-01, opção b).

---

## Protótipo de referência

- **Canvas de design (Claude):** <https://claude.ai/artifact/CFeqbK3TGFNfMzaWsTo9Js>
  — título "Home – Plataforma PO".
- O link é **privado**: só o dono abre. Para outra pessoa ver, compartilhe pelo
  menu *Share* do próprio canvas.
- Fidelidade: baixa/média. Cores, fonte, raios e moldura já seguem o design system
  do app; o **conteúdo** (textos de novidades, roadmap, nomes) é de exemplo.
  Onde aparece `[entre colchetes]`, é texto a preencher.

O canvas tem três quadros:

| Quadro | Arquivo no canvas | O que é |
| ------ | ----------------- | ------- |
| **A** | `Main.dc.html` | Home do usuário recorrente — **a tela principal** |
| **B** | `PrimeiroAcesso.dc.html` | Home no primeiro acesso (checklist de primeiros passos) |
| **C** | `Novidades.dc.html` | Modal de novidades exibido uma vez após atualizar a versão |

---

## A pergunta que a tela responde

*"Onde eu estou na sprint, para onde devo ir agora, e o que mudou (ou vai mudar)
no app?"*

A Home é **instrutiva**: ensina a navegar pelos três momentos do ciclo (Planning,
Daily, Review), comunica as novidades da versão e antecipa o que vem pelo roadmap.

### O que a Home **não** é

- **Não é um dashboard de indicadores.** Números de capacidade, entregas e bugs
  continuam nas telas de cada momento. A Home aponta para elas.
- **Não substitui a documentação.** Ela dá o mapa; o detalhe fica nos guias e no
  ícone `?` (`HelpTip`) de cada indicador.

---

## Decisões fechadas

| # | Decisão | Consequência no código |
| - | ------- | ---------------------- |
| D-01 | O item de menu chama-se **"Home"** (mantém o padrão em inglês de Planning, Daily, Review). | Nova chave `nav.home` em `i18n/pt-BR.ts`. |
| D-02 | **Home é a rota padrão** do app. | `routes/index.tsx`: rota `index` e curinga `*` passam a `Navigate` para `/home` (hoje vão para `/dashboard/sprint-delivery`). Nova rota `home` → `HomeScreen`. |
| D-03 | Home é o **primeiro item** do menu lateral, acima de Planning. | `AppLayout.tsx`: entrada `{ key: '/home', icon: <HomeOutlined />, label: t('nav.home') }` no início de `MAIN`; o fallback de `current` passa a ser a Home, não `REVIEW[0]`. |
| D-04 | A Home tem **dois estados**: primeiro acesso (quadro B) e recorrente (quadro A). | Precisa de um sinal de "já concluiu/escondeu os primeiros passos" — ver Itens em aberto. |
| D-05 | Novidades aparecem em **dois lugares**: bloco fixo na Home (A) e modal único pós-atualização (C). | Guardar a última versão vista para decidir se o modal abre. |

## Itens em aberto (de propósito)

Ficam para quando a feature for trabalhada a fundo. O desenho já reserva o espaço,
então qualquer resposta cabe sem mudar o layout.

| # | Pergunta | Opções levantadas |
| - | -------- | ----------------- |
| A-01 | **Card "Sugestão para agora"** usa só a fase da sprint ou também dados do Azure? | (a) Só a fase: início → Planning, meio → Daily, fim → Review. Simples, sem consulta extra. (b) Com dados: ex. "3 tarefas paradas há mais de 2 dias". Mais útil, mas faz a Home consultar o Azure. |
| A-02 | **De onde vêm novidades e roadmap?** | (a) Arquivo local versionado no repo (ex. `changelog.json`, `roadmap.json`) — funciona offline e respeita a CSP. (b) Buscar do GitHub (releases/issues). Recomendação registrada: (a). |
| A-03 | Onde guardar "primeiros passos escondidos" e "última versão vista"? | Preferência desta máquina (`localStorage`, como o menu recolhido) ou Dados de trabalho do Perfil. |
| A-04 | O botão **"Quero isso"** do roadmap registra o quê, e onde? | Contador local, link para issue no GitHub, ou só abrir um formulário. |
| A-05 | O link **"Fazer o tour guiado"** abre o quê? | Tour com `Tour` do Ant Design sobre o menu, ou só o quadro B de novo. |

---

## Estrutura de cada quadro

### A · Usuário recorrente (tela principal)

Cabeçalho padrão do `AppLayout` com título **Home**, mais à direita a etiqueta da
versão (`v0.2.0`, em `MONO_FONT`) e o botão "Ajuda e atalhos".

1. **Saudação + contexto da sprint** — "Boa tarde, [Nome]" e a linha
   "Sprint [42] · dia 6 de 10 · [Produto]". Números em fonte mono.
2. **Card "Sugestão para agora"** — fundo `SIDER.bg` (mesma moldura escura do card
   "Editar a Configuração"), rótulo em `SIDER.subtle`, título branco, botão
   primário com o destaque ("Abrir Daily →"). O conteúdo muda conforme A-01.
3. **"Como a plataforma acompanha a sua sprint"** — card com três passos lado a
   lado: **01 · Antes / Planning**, **02 · Durante / Daily**, **03 · Ao fim /
   Review**. Cada um diz para que serve a tela e tem o link "Abrir …". O passo da
   fase atual ganha borda no destaque, fundo suave e a etiqueta "Você está aqui".
   Link "Fazer o tour guiado" no cabeçalho do card.
4. Duas colunas (3:2), que empilham em tela estreita:
   - **Novidades da vX.Y.Z** — lista com etiqueta por tipo (**Novo** em tom do
     destaque; **Melhoria** e **Correção** em neutro), título e uma linha de
     explicação, com link opcional ("Experimentar"). Link "Todas as notas de versão".
   - **O que vem por aí** — cards com nome, etiqueta de estágio (**Em desenho**,
     **Planejado**, em neutro), uma linha sobre o problema que resolve e o botão
     "Quero isso". Exemplo real: **Roadmap de Features** (ver
     `docs/roadmap/DESENHO.md`). Links "Ver roadmap" e "Sugerir uma melhoria".
5. **Dicas rápidas** — três cards curtos com ícone: o `?` explica a regra do
   indicador; clicar no logo recolhe o menu; exportar a Configuração.

### B · Primeiro acesso

1. Título grande "Boas-vindas à Plataforma do PO" e um parágrafo explicando os três
   momentos.
2. **Primeiros passos** (coluna larga) — contador "1 de 4", barra de progresso em
   `STATUS.ok.solid` e quatro itens:
   1. Conectar ao Azure DevOps e cadastrar Produtos (já concluído pelo onboarding);
   2. Montar a primeira Planning — botão primário "Começar";
   3. Acompanhar uma Daily — "Abrir";
   4. Ver as Entregas da sprint — "Abrir".
   Ao final, "Pular e esconder esta lista".
3. Coluna lateral:
   - Card escuro **"Quer só explorar antes?"** apontando para o **modo
     demonstração**.
   - Card **Ajuda**: guia de uso, regras de cada indicador, reportar um problema.

Quando a lista é concluída ou escondida, a Home passa a ser a do quadro A.

### C · Novidades ao atualizar

Modal sobre a Home (fundo escurecido). Conteúdo:

- Área de imagem/GIF do destaque da versão (placeholder no protótipo);
- Etiqueta da versão + data;
- Título e parágrafo do destaque principal;
- Lista curta com as outras novidades e "+ N correções";
- Rodapé: link "Ver todas as notas", botão "Agora não" e botão primário que leva
  à tela da novidade ("Experimentar no Planning").

Abre **uma vez** por versão (D-05). Fechado, não volta até a próxima versão.

---

## Design system aplicado

Fonte única dos valores: `src/renderer/src/theme/index.ts` e
`docs/design-system.md`. O protótipo usou:

| Elemento | Token |
| -------- | ----- |
| Fundo da janela | `NEUTRA[50]` (`#F4F5F7`) |
| Cards | branco, borda `NEUTRA[200]`, raio `borderRadiusLG` (14) |
| Divisórias internas | `NEUTRA[100]` |
| Texto principal / secundário | `NEUTRA[800]` / `NEUTRA[500]` |
| Moldura escura (menu, card de sugestão, card de demonstração) | `SIDER.*` |
| Destaque (botão primário, links, passo atual) | `colorPrimary` / `accentRamp()` |
| Ícone ativo no menu | `accentTones(cor).onDark` |
| Etiquetas neutras | `STATUS.neutral.bg` / `STATUS.neutral.text` |
| Barra de progresso dos primeiros passos | `STATUS.ok.solid` |
| Versão, números da sprint | `MONO_FONT` |
| Fonte | Geist (embarcada) |

**Atenção na implementação (DS-01):** no protótipo, o fundo do passo atual
(`#F5F5FF`) e a etiqueta "Novo" (`#E5E4FF` / `#3730A3`) foram escritos como cor
literal. No código, devem sair da rampa do destaque, por exemplo
`accentTones(token.colorPrimary).soft` / `.softText`, ou de um token novo no tema.
Caso contrário, `npm run verify:design` barra. O mesmo vale para o ícone ativo do
menu (`#B9B6FA` no protótipo → `accentTones().onDark`).

Princípios do DS respeitados: o destaque marca o que é **ativo ou ação
principal**, nunca situação; verde aparece só onde significa "concluído"
(primeiros passos); os estágios do roadmap ficam em neutro, porque não são
situação.

### Mapeamento sugerido para Ant Design

| Bloco | Componentes |
| ----- | ----------- |
| Layout geral | `Flex` com `wrap`, `Row`/`Col` responsivos |
| Cards | `Card` (já com o tema de borda) |
| Etiquetas de tipo e estágio | `Tag` |
| Passos do ciclo | `Card` próprio; avaliar `Steps` só se ficar natural |
| Primeiros passos | lista própria + `Progress` |
| Modal de novidades | `Modal` |
| Tour guiado (se A-05 for por aí) | `Tour` |
| Ícones | `@ant-design/icons` (`HomeOutlined`, `CalendarOutlined`, `FieldTimeOutlined`, `FundProjectionScreenOutlined`, `QuestionCircleOutlined`…) |

---

## Arquivos que a implementação deve tocar

- `src/renderer/src/routes/index.tsx` — rota `home`, padrão e curinga (D-02).
- `src/renderer/src/components/AppLayout.tsx` — entrada no menu e fallback (D-03).
- `src/renderer/src/i18n/pt-BR.ts` — `nav.home` e todos os textos da tela.
- `src/renderer/src/features/home/` — nova pasta: `HomeScreen.tsx` e os blocos
  (saudação, sugestão, ciclo, novidades, em breve, dicas, primeiros passos,
  modal de novidades).
- `src/renderer/src/theme/index.ts` — só se faltar token para algum tom (DS-01).
- Testes: regra de qual estado mostrar (A ou B) e de quando o modal abre.

## Referências

- Canvas do protótipo: <https://claude.ai/artifact/CFeqbK3TGFNfMzaWsTo9Js>
- Design system: `docs/design-system.md`, `src/renderer/src/theme/index.ts`
- Roadmap (usado no bloco "O que vem por aí"): `docs/roadmap/DESENHO.md`
