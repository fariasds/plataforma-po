# Plataforma do PO

Dashboard gerencial para Product Owners que trabalham com Azure DevOps. Cada PO
instala na própria máquina e parametriza a ferramenta para os seus produtos e o
processo do seu time.

## Language

### Instalação e acesso

**Perfil**:
Conjunto local formado por uma organização Azure DevOps, o PAT de acesso a ela e a
Configuração correspondente. Existe só na máquina do PO e fica protegido pela conta
do sistema operacional.
_Avoid_: usuário, conta, login, sessão

**PAT**:
Token pessoal do Azure DevOps que o Perfil usa para ler dados da organização.
Nunca faz parte da Configuração.
_Avoid_: token (sozinho), senha, credencial

**Configuração**:
Descrição declarativa do Perfil (produtos, perfil de processo, calendário, campos),
em um arquivo que humanos e a IA do PO podem ler e editar.
_Avoid_: settings, parametrização, setup

**Dados de trabalho**:
Informação que nasce do uso do app (itens manuais do Planning, desmarcações,
capacidade). Pertence ao Perfil e não faz parte da Configuração. O plano do Roadmap
não é Dado de trabalho: mora na pasta de trabalho do Produto (ADR 0017).
_Avoid_: cache, estado local, preferências

**Cenário**:
Uma Configuração fictícia, o estado de um Azure DevOps fictício (projetos, times,
iterações, work items com histórico) e uma data de referência. Alimenta a regressão
das telas e o Perfil de demonstração. O catálogo está em `docs/cenarios.md`.
_Avoid_: mock, seed, demo, fixture

**Perfil de demonstração**:
Um Perfil cujo Azure é o fictício, alimentado por um Cenário. Não tem PAT, não tem
rede e diz isso na tela o tempo todo, com uma faixa fixa no topo.
_Avoid_: modo demo, sandbox, conta de teste

**IA do PO**:
A IA que o PO já usa (Claude, ChatGPT, Copilot ou outra), fora do app e na conta
dele. O app não a executa nem fala com ela: monta o pedido, o PO o copia para lá e
cola a resposta de volta como rascunho.
_Avoid_: Provedor de IA, integração, API de IA, assistente

### Produto e sprint

**Produto**:
Unidade que o PO acompanha. É definida por uma origem no Azure: projeto, area paths
incluídos e excluídos, e o time que fornece as iterações.
_Avoid_: projeto (projeto é do Azure), board, área

**Grupo de produtos**:
Soma nomeada de Produtos, vista como um todo nos indicadores.
_Avoid_: portfólio, "ambos"

**Squad**:
Conjunto dos Produtos com que um time de pessoas trabalha. Cada Produto pertence a
uma Squad só, e cada Squad é uma aba do app: as telas mostram só o que é dela.
_Avoid_: time (time é do Azure), equipe, tribo

**Sprint unificada**:
Conjunto das sprints de vários Produtos que correm no mesmo período, tratado como um
ciclo só.
_Avoid_: iteração (iteração é do Azure)

**Perfil de processo**:
Regras de um processo de trabalho: quais tipos de work item contam, quais estados
significam entrega e quais são terminais.
_Avoid_: template, workflow

### Fluxo do PO

O vocabulário do processo rule-first (Discovery, Brief da Feature, Requisito,
Decisão, Plano de PBIs, Quebra, Fase) está em `docs/fluxo-po/` e entra aqui com o
código de cada fatia.

**Retrato**:
O que a janela leu do Azure para o fluxo do PO, por Produto: Features, os filhos
delas, feedbacks e bugs, com a data em que foi tirado. Fica nos Dados de trabalho, e
é dele que a IA do PO lê, porque o servidor MCP não fala com o Azure.
_Avoid_: cache, snapshot (no texto), sincronização

**Pasta de trabalho**:
A pasta, escolhida pelo PO, onde moram os artefatos do fluxo de um Produto: o Brief,
as Decisões, o Plano de PBIs, os PBIs escritos e o catálogo. Uma por Produto; o
caminho é desta máquina e não entra na Configuração.
_Avoid_: workspace, repositório, diretório do projeto

**Fase**:
Onde uma Feature está no fluxo do PO (Sem Discovery, Discovery, Pronta para quebra,
Em quebra, Publicada, Arquivada, Fora do fluxo), calculada da pasta de trabalho e do
retrato. Nunca é digitada: a linha `Fase:` do README só aparece quando diverge.
_Avoid_: status, etapa (etapa é do fluxo, não da Feature)

**Pendência**:
O que falta para a Feature andar, calculado dos artefatos: Decisão em Proposta, PBI
sem ID, regra em duas Features. Some quando o artefato existe; ninguém a marca.
_Avoid_: tarefa, checklist (o checklist é o do Pronta para quebra)
