# Design system

Como a interface da Plataforma do PO se parece e por quê. Vale para toda tela nova
e para toda mudança numa tela existente.

A fonte única dos valores é o código: `src/renderer/src/theme/index.ts` (tokens) e
os componentes de `src/renderer/src/components/`. Este documento diz **quando usar
cada um**. Se um valor aqui divergir do código, o código vence e este documento
está desatualizado — corrija-o na mesma tarefa.

## Princípios

1. **O dado é o assunto.** A moldura é discreta (cinzas frios, uma cor de destaque);
   quem tem cor é o que o PO precisa ler — situação, Produto, tipo de work item.
2. **Uma cor, um significado.** Verde é "dentro", âmbar é "projeção/atenção",
   vermelho é "constatação/estouro", cinza é "sem dado". Nenhuma tela inventa outro
   sentido para essas cores.
3. **O destaque é do PO.** A cor de destaque vem de `appearance.accentColor` na
   Configuração. Use-a para o que está ativo, selecionado ou é a ação principal —
   nunca para comunicar situação.
4. **Número legível de longe.** Indicador é número grande sobre rótulo pequeno.
   IDs, horas e datas em fonte mono, que alinha em coluna.

## Regras verificadas por teste

| ID      | Regra                                                                                                                                                                                                                                                             | Teste                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DS-01` | Cor de interface sai do tema. Cor literal só em `theme/index.ts`, no desenho do logo (`AppLogo.tsx`), na paleta própria de uma feature (`features/<feature>/constants.ts`) e nas sugestões de cor de Produto (`onboarding/draft.ts`). Branco (`#FFFFFF`) é livre. | `tests/design/ds-01-cores-saem-do-tema.test.ts`  |
| `DS-02` | Família tipográfica sai do tema: texto herda Geist; IDs, horas e datas usam `MONO_FONT`.                                                                                                                                                                          | `tests/design/ds-02-fontes-saem-do-tema.test.ts` |

Rode com `npm run verify:design` (também faz parte do `npm run check`). Se o teste
barrar algo legítimo, a resposta quase sempre é um token novo no tema; ampliar a
lista de permitidos é decisão de design e leva o motivo no comentário.

## Tokens

Todos exportados por `src/renderer/src/theme/index.ts`.

### Neutros — `NEUTRA`

| Token         | Valor     | Uso                                                      |
| ------------- | --------- | -------------------------------------------------------- |
| `NEUTRA[50]`  | `#F4F5F7` | Fundo da janela (vem de `WINDOW_BACKGROUND`)             |
| `NEUTRA[75]`  | `#F7F8FA` | Cabeçalho de tabela e de régua                           |
| `NEUTRA[100]` | `#EEF0F3` | Trilho de seletor, divisória interna, barra vazia        |
| `NEUTRA[200]` | `#E4E7EC` | Borda de card e de controle                              |
| `NEUTRA[300]` | `#C4C9D0` | Borda forte, placeholder                                 |
| `NEUTRA[400]` | `#9AA1AE` | Ponto/ícone "sem dado". **Não use para texto**           |
| `NEUTRA[500]` | `#5B6272` | Texto secundário (mínimo para texto: 4.5:1 sobre branco) |
| `NEUTRA[600]` | `#4A5163` | Texto de apoio em controles                              |
| `NEUTRA[800]` | `#171A23` | Texto principal                                          |

### Moldura escura — `SIDER`

Menu lateral, painel da marca na primeira execução, card "Editar a Configuração" e
o card de total do Planning. Fundo `SIDER.bg` (`#12141B`); texto `SIDER.text`,
`SIDER.textStrong` para o que está ativo, `SIDER.label` para rótulo de grupo. Sobre
a moldura, o destaque aparece no tom claro `accentTones(cor).onDark`.

### Situação — `STATUS`

Cada situação tem três tons: `solid` (barra, ponto), `bg` (fundo da etiqueta) e
`text` (texto sobre o `bg`).

| Chave     | Sentido                        | Exemplos                                                    |
| --------- | ------------------------------ | ----------------------------------------------------------- |
| `ok`      | Dentro, concluído              | "Dentro da capacidade", estado Done, SLA cumprido           |
| `warning` | Projeção, atenção              | "No limite", "Projeção fura a sprint", em andamento demais  |
| `danger`  | Constatação, estouro           | "Acima da capacidade", "Passou da estimativa", SLA excedido |
| `info`    | Em andamento (estado do Azure) | Committed, Active, In Progress                              |
| `neutral` | Sem dado, proposto             | New, Approved, sem estimativa                               |

### Outras paletas

- **`DISCIPLINE_COLORS`** — frontend, backend e QA no Planning (indicador e capacidade).
- **Cor de Produto** — vem da Configuração; derive tons com `productColors(cor)`.
  Na interface aparece como **ponto** ao lado do nome, não como fundo pintado.
- **Tipos de work item** — `workItemColor(tipo)`. São as cores do Azure DevOps e só
  valem dentro de gráficos e tabelas de work item (`RN-GLB-10`). Na tabela, o tipo
  é um quadradinho colorido + o nome, não uma tag preenchida.
- **`BRAND_SPARK`** (`#FF8A5B`) — só no logo. Não é cor de interface.

### Tipografia

| Papel                     | Estilo                                              |
| ------------------------- | --------------------------------------------------- |
| Título da tela            | Geist 700 · 24 px (vem do cabeçalho do `AppLayout`) |
| Número de indicador       | Geist 600 · 36–40 px · `letterSpacing: -0.03em`     |
| Título de card            | Geist 600 · 15 px (token `Card.headerFontSize`)     |
| Corpo                     | Geist 400 · 14 px                                   |
| IDs, horas, datas, sprint | `MONO_FONT` (Geist Mono)                            |
| Cabeçalho de tabela       | 11.5 px · 600 · caixa alta (token da `Table`)       |

As fontes ficam embarcadas em `src/renderer/src/assets/fonts/` (licença OFL):
a CSP só aceita fonte local.

### Forma e espaço

- Raio: 10 px nos controles, 14 px nos cards (`borderRadius`, `borderRadiusLG`), 6 px nas etiquetas.
- Altura de controle: 36 px. Alvo clicável mínimo: 32 px dentro da tela, 40 px no menu.
- Cards separam com **borda** (`NEUTRA[200]`), não com sombra.
- Espaço entre blocos da tela: 16–20 px. Respiro interno do conteúdo: `24px 32px`.

## Componentes

Use antes de criar um novo. Se precisar de uma variação, estenda o componente.

| Componente            | Quando                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppLayout`           | Moldura de toda tela autenticada: menu lateral (expansível, ver abaixo) e cabeçalho com o título. Tela nova entra no menu em `MAIN` ou num grupo |
| `AppLogo` / `AppMark` | Marca do app. `AppMark` sozinho em espaço curto; `AppLogo` com o nome                                                                            |
| `ProductFilter`       | Escolher Produto ou Grupo. Sempre o primeiro controle do topo da tela                                                                            |
| `DashboardFilters`    | `ProductFilter` + seletor de sprint + nome da sprint em cada Produto (telas de Review)                                                           |
| `StateTag`            | Estado de work item. Nunca uma `Tag` com cor escolhida na tela                                                                                   |
| `HelpTip`             | Explicar um cálculo que contraria a intuição (ver Definição de pronto no `CLAUDE.md`)                                                            |
| `ErrorState`          | Falha ao carregar                                                                                                                                |
| `UserMenu`            | Cartão da conta no pé do menu lateral                                                                                                            |
| `DemoBanner`          | Faixa do Perfil de demonstração, presa ao topo com o cabeçalho. Fundo `colorPrimaryBg`, nunca `STATUS`: não é alerta nem situação (RN-GLB-15)    |

## Menu lateral

- **Dois estados.** Expandido (240 px, `SIDER_WIDTH`) mostra ícone e nome;
  recolhido (72 px, `SIDER_COLLAPSED_WIDTH`) mostra só os ícones, com o nome num
  tooltip à direita. Clicar no logo alterna os dois. A escolha fica guardada nesta
  máquina (`localStorage`), não no Perfil.
- **Home vem primeiro** (`RN-HOM-01`): é a tela de entrada e o destino de rota
  desconhecida. Só ela mostra a versão do app no cabeçalho.
- **Itens de primeiro nível** são telas (`MAIN`) ou grupos. Todo item tem ícone de
  `@ant-design/icons` — recolhido, o ícone é tudo o que sobra.
- **Grupo** (hoje só "Review", em `REVIEW`) é um botão com seta que abre e fecha
  os subitens abaixo dele. Ele começa aberto quando a tela atual é dele. Subitens
  não têm ícone e ficam recuados, alinhados ao nome do grupo.
- **Grupo com o menu recolhido** abre os subitens num menu flutuante ao lado do
  ícone (passar o mouse ou clicar), com o nome do grupo no topo.
- **Ativo:** fundo `SIDER.activeBg`, texto `SIDER.textStrong` e ícone no tom
  `accentTones(cor).onDark`. Um grupo com a tela atual dentro dele destaca o ícone
  (e o fundo, quando recolhido).
- **Pé do menu:** Configuração e Segurança, as telas que se consultam e não se
  usam todo dia, ficam acima do `UserMenu`.
- **Tela nova:** entre em `MAIN` se for de uso diário; num grupo se fizer parte de
  uma cerimônia já existente. Grupo novo só quando houver pelo menos duas telas.

## Padrões de tela

- **Ordem do topo:** `ProductFilter` → seletor de sprint/período → contexto
  (dia da sprint, feriados) → indicadores → gráficos → tabela.
- **Card de indicador:** rótulo (13.5 px, `NEUTRA[600]`) com o `HelpTip` à direita;
  número grande; uma linha de apoio em texto secundário; barra de progresso
  opcional, sem rótulo de porcentagem dentro dela. O número fica neutro — a cor
  vai na barra ou na etiqueta de situação.
- **Situação com etiqueta:** `Tag variant="filled"` com `STATUS.x.bg` e
  `STATUS.x.text`, texto que diz a situação e, quando ajuda, o número
  ("No limite · 94%").
- **Legenda que filtra:** botões (`<button>`, `aria-pressed`) com amostra de cor,
  rótulo e contagem; clicar de novo remove o filtro.
- **Proporção:** prefira barra (empilhada ou horizontal) a pizza/rosca —
  comprimento compara melhor que ângulo.
- **Tabela:** `size="small"`; ID em mono como link para o Azure (sem link no Perfil de demonstração: use `useWorkItemHref`); título com peso
  500; colunas numéricas alinhadas à direita.
- **Estado vazio:** diga o que falta e onde configurar ("Defina
  `customFields.criticality` na Configuração"), nunca só "sem dados".

## Não faça

- Cor hexadecimal dentro de tela ou componente (`DS-01`).
- Nome de fonte dentro de tela ou componente (`DS-02`).
- Pintar o fundo inteiro de uma tag com a cor do Produto ou do tipo de work item.
- Usar o destaque para dizer "bom" ou "ruim".
- Texto em `NEUTRA[300]` ou `NEUTRA[400]` (contraste insuficiente).
- Emoji como ícone. Ícones vêm de `@ant-design/icons`.
- Elemento clicável que não é `<button>` ou `<a>` (o Tab pula `div` com `onClick`).

## Marca

- Símbolo "Prioridade": backlog ordenado com o ponto de foco no item do topo.
- Fontes vetoriais em `resources/brand/` (`logo-mark.svg` e `logo-mark-small.svg`,
  a versão de barras grossas para 24 px ou menos).
- Ícones gerados a partir delas: `resources/icon.png`, `build/icon.png`,
  `build/icon.ico` (16–256 px) e `build/icon.icns`. Mudou o SVG, gere os quatro de novo.

## Mudando o design system

Mudança visual que vale para mais de uma tela (cor nova, componente novo, padrão
novo) é feita **na mesma tarefa** em três lugares:

1. o token ou componente em `src/renderer/src/`;
2. este documento;
3. os testes `DS-*`, se a regra mudou ou nasceu uma regra nova verificável.

ID de regra `DS-<NN>` nunca é reciclado: regra que morreu fica marcada como revogada.
