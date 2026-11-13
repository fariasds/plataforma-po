# Roadmap — modelo de domínio

> **Estado: em desenho.** Nada aqui está implementado. Quando o código existir, as
> regras `RN-RDM-xx` migram para `docs/regras-de-negocio/05-roadmap.md` sem mudar
> de ID — o ID nasce aqui e não é reciclado.

---

## A pergunta que a tela responde

*"Se eu quiser trabalhar nestas features, quando cada uma cabe — sem sobrecarregar
ninguém?"*

E, como consequência: *"o que eu preciso fazer nesta sprint?"*

### O que o Roadmap **não** é

- **Não é compromisso com stakeholder.** Não existe *baseline*, não existe
  "atraso", não existe histórico de versões do plano. Mudou, mudou.
- **Não é gestão de tarefas.** Ele diz que a Feature A está em Refinamento nesta
  sprint. Não diz quais atividades do Refinamento já foram feitas.
- **Não escreve no Azure DevOps.** O app continua sendo leitor.

---

## Vocabulário

### Termos novos

| Termo | Significa |
|---|---|
| **Feature** | O entregável do roadmap: um guarda-chuva que atravessa várias sprints e vira N PBIs lá na frente. |
| **Fase** | Um dos três trechos de uma Feature: **Discovery**, **Refinamento**, **Delivery**. |
| **Trilha** | O grupo de pessoas que pode ficar sobrecarregado: **Produto/UX** e **Time Técnico**. |
| **Peso** | Quanto uma fase ocupa de uma trilha numa sprint. Não é hora, é ponderação. |
| **Rascunho** | Feature que existe só no roadmap, ainda sem work item no Azure. |
| **Adoção** | O ato de vincular um rascunho a um ID de Feature do Azure. |

### Colisões conscientes

Três palavras já estavam ocupadas no projeto. Foram mantidas mesmo assim, por
serem as que o PO usa no dia a dia — o custo é ter que desambiguar por escrito:

| Palavra | Significado antigo | Significado novo | Como desambiguar |
|---|---|---|---|
| **Área** | *Area path* do Azure — `Contoso\Loja`, `Contoso\App\Qualidade` (`RN-GLB-01`, `RN-GLB-03`) | — | **"Área" continua sendo só do Azure.** O grupo de pessoas chama-se **Trilha**. |
| **Delivery** | A tela de Entregas (`RN-ENT`), que mede o que foi concluído | A terceira fase de uma Feature | Escrever sempre **"fase de Delivery"** por extenso. |
| **Feature** | Nada — a hierarquia medida parava no PBI (`RN-GLB-08`) | O entregável do roadmap | Sem conflito interno, mas note que `Feature` também é um **tipo de work item** no Azure. Aqui os dois se referem à mesma coisa quando a Feature é vinculada. |

---

## Entidades

```
Feature
├── origem: vinculada (ID de work item do Azure) | rascunho (só local)
├── produto: um dos Produtos da Configuração (ex.: Loja Online | App Mobile)
├── arquivada: sim | não
└── três Fases, sempre nesta ordem:
    ├── Discovery    → sprint de início + duração em sprints
    ├── Refinamento  → sprint de início + duração em sprints
    └── Delivery     → sprint de início + duração em sprints
```

### Onde cada coisa mora

O Azure é dono da **lista de features**. A máquina é dona do **planejamento**.

| Dado | Dono | Por quê |
|---|---|---|
| ID, título, estado, produto | **Azure DevOps** | Já existe lá; duplicar seria criar divergência. |
| Fases, durações, sprints de início, arquivamento, rascunhos | **Máquina local** | O app não escreve no Azure, e não há onde guardar isso lá. |

É o mesmo padrão que o Planning já usa para desmarcados e remanescentes
(`RN-PLN-07`, `RN-PLN-12`): estado local indexado por ID de work item.

> ⚠️ **A consequência precisa estar clara:** o planejamento vive numa máquina só.
> Trocou de máquina ou reinstalou, o Azure continua com as features e **o
> planejamento some**. Exportar/importar o plano é item obrigatório, não enfeite.

---

## Regras

### A Feature

#### RN-RDM-01 · Duas origens

Uma Feature no roadmap é **vinculada** (espelha um work item de tipo `Feature` do
Azure — título, estado e produto vêm de lá) ou **rascunho** (título e produto
digitados, existe só na máquina).

Rascunho existe porque metade do roadmap ainda é aposta: ideia de trimestre que
vem, pedido de cliente que pode morrer. Exigir work item para tudo transformaria
planejar em burocracia.

As duas aparecem na mesma linha do tempo e são **visualmente distintas** — como a
etiqueta "Remanescente" do Planning (`RN-PLN-11`).

#### RN-RDM-02 · Adoção

Um rascunho pode receber, a qualquer momento, um ID de Feature do Azure. Ao
adotar, ele **passa a herdar título, estado e produto de lá** e mantém intacto
todo o planejamento já feito — fases, durações e âncoras.

O caminho contrário não existe: Feature vinculada não vira rascunho.

#### RN-RDM-03 · Arquivar

Arquivar tira a Feature da tela sem apagar o planejamento. É o único jeito de uma
Feature sumir — **nada some sozinho**.

Serve para a feature cancelada, que senão ocuparia sprint futura para sempre.

### As fases

#### RN-RDM-04 · Três, fixas e ordenadas

Toda Feature tem exatamente **Discovery → Refinamento → Delivery**, nesta ordem.
Não se cria fase, não se renomeia, não se reordena.

A rigidez é o que dá sentido ao cálculo de sobrecarga: é a fase que diz **quem**
está ocupado (`RN-RDM-07`). Fase livre tornaria a trilha incalculável.

#### RN-RDM-05 · Duração por feature, editável sempre

Cada fase de cada Feature tem sua própria duração em sprints. O padrão é **2**,
mas é ajustável a qualquer momento — inclusive depois de a fase ter começado.

**Duração zero significa fase pulada.** É assim que se representa a feature que
chega pronta e não precisa de Discovery — sem inventar um mecanismo de exceção.

#### RN-RDM-06 · Ancoragem: cascata na criação, âncora própria depois

Ao criar a Feature, escolhe-se uma sprint de início e as três fases são
enfileiradas **coladas**, uma após a outra. A partir daí, **cada fase tem âncora
própria** e é movida sozinha.

O buraco entre fases é informação, não erro: *"o Refinamento acabou, mas o
Delivery só começa na 112 porque o time está ocupado"*. Com equipe compartilhada,
essa espera é o estado normal — um modelo que não a representa mente.

**Uma fase ocupa sprints contíguas.** Não existe pausa no meio: se o Discovery
para e volta três sprints depois, a duração é 4 com sprint ociosa dentro.

#### RN-RDM-07 · Fase corrente é derivada, nunca digitada

Em que fase uma Feature está **hoje** é consequência do calendário: a fase cuja
janela contém a sprint corrente (`RN-GLB-06`).

Não existe campo de estado no roadmap. Estado que precisa ser atualizado à mão
diverge do plano em duas semanas, e estado que ninguém mantém é pior que estado
nenhum.

#### RN-RDM-08 · O estado do Azure informa, não manda

Feature vinculada mostra o estado do work item, mas ele **não altera o
planejamento**. Se o Azure diz `Closed` e o plano ainda tem duas sprints de
Delivery, isso é sinalizado discretamente — como divergência a olhar, não como
comando a obedecer.

O roadmap serve ao PO. Se o Azure pudesse apagar o plano, seria o contrário.

### Sobrecarga

#### RN-RDM-09 · Duas trilhas

O roadmap vigia **Produto/UX** e **Time Técnico**.

Duas, e não cinco (Produto, UX, Front, Back, QA), porque a oito sprints de
distância não existe estimativa de frontend versus backend — só chute que vira
número na tela e destrói a confiança. O detalhe de Front/Back/QA já é resolvido
sprint a sprint pelo Planning (`RN-PLN-13`), onde há dado real.

#### RN-RDM-10 · Peso de cada fase em cada trilha

Uma fase pesa em **toda sprint que ela cobre**, não só na primeira.

| Fase | Produto/UX | Time Técnico |
|---|:--:|:--:|
| Discovery | 1,0 | — |
| Refinamento | 1,0 | 0,5 |
| Delivery | — | 1,0 |

O Refinamento é a única fase que pesa nas duas — é por isso que empilhar
Refinamento com Delivery é o que mais estrangula o time técnico, e é justamente a
distinção que uma contagem simples de features perderia.

**Os pesos são editáveis** e ficam guardados na máquina. Os da tabela são o
ponto de partida.

#### RN-RDM-11 · Limite e faixas

Cada trilha tem um limite de peso por sprint, ajustável. Proposta inicial:
**2,0 para Produto/UX** e **3,0 para Time Técnico**.

| Situação | Estado |
|---|---|
| Peso abaixo do limite | **Dentro** (verde) |
| Peso igual ao limite | **No limite** (amarelo) |
| Peso acima do limite | **Sobrecarregada** (vermelho) |

Na tela convém mostrar as duas leituras juntas — *"Produto/UX: 3 features · peso
2,5 de 2,0"* — para não escolher entre o número honesto e o número legível.

#### RN-RDM-12 · O cálculo é sempre global

Os Produtos dividem **uma** linha do tempo. O produto é atributo visual (a cor
do `ProductFilter`) e o filtro por produto serve **apenas para ler**.

**O cálculo de sobrecarga nunca é filtrado.** Somar por produto cegaria a tela no
caso exato que motivou a feature: a Loja Online com dois Discoveries e o App Mobile
com dois Discoveries, cada visão verde, e o PO com quatro Discoveries em cima. Não existem
duas capacidades de Discovery.

> Este é o erro mais fácil de cometer na implementação: aplicar o filtro de
> produto antes de somar. O filtro entra **depois** do cálculo, na renderização.

#### RN-RDM-13 · Ocupação real substitui o peso quando ela existe

Nas sprints que já têm itens planejados, a trilha **Time Técnico** troca o peso
estimado pela **ocupação real** calculada pelo Planning — horas alocadas sobre
capacidade (`RN-PLN-15`, `RN-PLN-17`).

A tela precisa deixar claro **qual das duas** está sendo mostrada: perto do
presente há dado, longe há ponderação, e confundir os dois é o jeito mais rápido
de o roadmap mentir.

Produto/UX permanece sempre em peso — não há capacidade de Produto/UX medida em
lugar nenhum do sistema.

### Uso

#### RN-RDM-14 · O app sugere, nunca decide

Ao criar ou mover uma fase, o app informa **a primeira sprint em que ela caberia
sem estourar o limite** da trilha. É sugestão: pode ser ignorada, e a fase pode
ser colocada em cima do limite de propósito.

Auto-encaixe completo foi rejeitado: o algoritmo decidiria contra o que o PO sabe
(*"essa é política, tem que ser agora"*), o PO passaria a lutar contra a
ferramenta e pararia de usá-la.

É também esta regra que produz a resposta de negociação — *"com esse time, a
quarta feature só começa em setembro"*.

#### RN-RDM-15 · Linha do tempo contínua

O roadmap não tem janela fixa: rola livremente para trás e para frente. O passado
fica à esquerda e não é apagado — é o arquivo natural das features concluídas.

A sprint corrente é destacada.

#### RN-RDM-16 · Painel "Minha sprint"

Um painel derivado responde *"o que eu preciso fazer nesta sprint"*: as fases
ativas agora (*"Feature A em Refinamento, Feature C em Discovery"*) e a carga das
duas trilhas ao lado.

**Sem checklist de atividades.** No minuto em que existe item marcável por fase,
o Roadmap deixa de ser ferramenta de sequenciamento e vira gestão de tarefas —
com estado que precisa ser mantido à mão, na mesma máquina, sem lembrete. Fica
meio preenchido e deixa de ser confiável.

---

## Consequências para a implementação

- **Um método novo de leitura no IPC** para listar Features do Azure. Continua
  valendo `RN-GLB-04`: sprint é identificada por período, não por número.
- **Um armazenamento local novo** para a camada de planejamento, indexado por ID
  de work item (para as vinculadas) e por ID interno (para os rascunhos).
- **Exportar/importar o plano** é obrigatório — ver o aviso em "Onde cada coisa
  mora".
- **Ajuda na tela (`HelpTip`)**: pelos critérios do `CLAUDE.md`, três regras
  contrariam a intuição e merecem balão — `RN-RDM-10` (por que o Refinamento pesa
  nas duas trilhas), `RN-RDM-12` (por que o filtro de produto não muda o número)
  e `RN-RDM-13` (por que a mesma trilha mostra unidades diferentes em sprints
  diferentes).

## A verificar nos dados reais

Conforme o `CLAUDE.md` — confirmar antes de depender:

1. **Em que momento a `Feature` nasce no Azure.** Se ela só é criada quando o
   desenvolvimento vai começar, o Discovery e o Refinamento serão quase sempre
   rascunho, e a `RN-RDM-02` (adoção) passa a ser o caminho principal, não a
   exceção.
2. **Se o PBI é filho da Feature** (`System.Parent`). Nenhuma regra atual depende
   disso, mas é o que abriria, no futuro, o Planning mostrar a que feature cada
   PBI pertence.
3. **Onde a Feature vive na hierarquia do Azure.** Um Produto da Configuração
   pode apontar para um **projeto** próprio ou para *area paths* dentro de um
   projeto compartilhado (`RN-GLB-01`). A consulta de Features precisa saber qual
   das duas leituras vale.
