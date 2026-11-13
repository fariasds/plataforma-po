# Regras de Negócio — Plataforma do PO

Fonte de verdade sobre **o que o sistema faz e por quê**. Quando o código e este
documento discordarem, um dos dois está errado — e a discussão começa aqui.

Escrito para ser lido por pessoas e por IA: estrutura previsível, cada regra com
identificador próprio e ponteiro para onde ela vive no código.

## Como está organizado

| Arquivo | Conteúdo |
|---|---|
| [01-conceitos-globais.md](01-conceitos-globais.md) | O que vale em todas as telas: Produtos, Sprint unificada, horas úteis, tipos e estados de work item, conversão de complexidade |
| [02-acesso-e-seguranca.md](02-acesso-e-seguranca.md) | O PAT: onde fica, quem o lê, para onde pode ir; a IA do PO: o que sai da máquina e como; e como o instalador é distribuído |
| [03-configuracao.md](03-configuracao.md) | O arquivo de Configuração do Perfil: schema, IDs, referências, organização por nome e ausência de segredo |
| [08-home.md](08-home.md) | Tela **Home** — tela de entrada: momento da sprint e primeiros passos |
| [10-planning.md](10-planning.md) | Tela **Planning** — planejamento da próxima sprint |
| [15-daily.md](15-daily.md) | Tela **Daily** — risco item a item durante a sprint |
| [20-review-entregas.md](20-review-entregas.md) | **Review › Entregas da Sprint** |
| [21-review-bugs.md](21-review-bugs.md) | **Review › Análise de Bugs** |
| [22-review-desempenho.md](22-review-desempenho.md) | **Review › Desempenho da Equipe** (construída, oculta na navegação) |

A numeração tem folga de propósito: uma tela nova em Review entra como `23`,
uma seção nova entra como `03`, sem renumerar nada.

## Como uma regra é escrita

Cada regra tem um **ID estável** no formato `RN-<ÁREA>-<NN>`:

| Prefixo | Área |
|---|---|
| `RN-GLB` | Conceitos globais |
| `RN-SEC` | Acesso e segurança |
| `RN-CFG` | Configuração |
| `RN-HOM` | Home |
| `RN-PLN` | Planning |
| `RN-DLY` | Daily |
| `RN-ENT` | Review › Entregas da Sprint |
| `RN-BUG` | Review › Análise de Bugs |
| `RN-DES` | Review › Desempenho da Equipe |

**O ID nunca é reciclado.** Se uma regra deixa de valer, ela é marcada como
revogada e o número morre com ela — assim uma conversa antiga que cita `RN-ENT-04`
nunca aponta para outra coisa.

Cada elemento de tela (KPI, gráfico, tabela) é descrito com a mesma anatomia:

- **Pergunta que responde** — o motivo de o elemento existir. É o campo mais
  importante: se não há pergunta clara, o elemento provavelmente não deveria existir.
- **Regra** — o cálculo ou o critério, em português, sem código.
- **Fonte no Azure** — campos e estados usados.
- **Casos de borda** — vazio, nulo, divisão por zero, dado ausente.
- **Implementado em** — caminho do arquivo.

## Como manter

1. **Mudou o comportamento? Atualize a regra na mesma alteração.** Documento que
   se atualiza depois não se atualiza.
2. **Regra nova ganha ID novo**, sempre no fim da numeração da área.
3. **Regra que morre vira `~~RN-XXX-NN~~ (revogada em AAAA-MM-DD, motivo)`** — não
   se apaga a linha.
4. **Se a regra vale em mais de uma tela**, ela pertence a `01-conceitos-globais.md`
   e as telas apenas a referenciam pelo ID.

## O que este documento não é

Não é especificação de interface: cor, espaçamento e tipografia estão no tema
(`src/renderer/src/theme/index.ts`), com a cor de destaque vinda da Configuração.
Aqui só entra aparência quando ela **carrega significado** — por exemplo, a cor por
tipo de work item, que é vocabulário do Azure DevOps e não escolha estética.

Também não é documentação de arquitetura. Para decisões técnicas e o porquê delas,
ver os ADRs em [docs/adr/](../adr/) e o [CLAUDE.md](../../CLAUDE.md).
