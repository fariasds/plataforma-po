# Instruções para a IA que edita esta Configuração

Esta pasta é um **Perfil** da Plataforma do PO: um dashboard que lê dados do Azure
DevOps para um Product Owner. Você foi chamado para ler ou editar
`configuracao.json`, que descreve os produtos do PO e o processo do time dele.

Leia este arquivo inteiro antes da primeira edição. O arquivo
`configuracao.schema.json` descreve cada campo; ele é a referência de forma, e
este texto é a referência de intenção.

---

## Vocabulário

Use estes termos com este sentido, na conversa e nos nomes que criar:

| Termo                  | Significa                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perfil**             | Uma organização do Azure DevOps, o PAT de acesso a ela e esta Configuração. Mora só na máquina do PO.                                                     |
| **PAT**                | Token pessoal do Azure DevOps. **Nunca** faz parte da Configuração.                                                                                       |
| **Configuração**       | Este arquivo: produtos, Perfis de processo, calendário e campos.                                                                                          |
| **Dados de trabalho**  | O que nasce do uso do app (itens manuais do Planning, capacidade, planejamento). Ficam em `dados/`, guardados pelo ID do Produto ou Grupo. **Não edite.** |
| **Produto**            | Unidade que o PO acompanha: um projeto do Azure, os area paths incluídos e excluídos, e o time que fornece as iterações.                                  |
| **Grupo de produtos**  | Soma nomeada de Produtos, vista como um todo nos indicadores.                                                                                             |
| **Sprint unificada**   | As sprints de vários Produtos que correm no mesmo período, tratadas como um ciclo só.                                                                     |
| **Perfil de processo** | Quais tipos de work item contam e o que cada estado significa (entregue, terminal, em andamento).                                                         |

## O que é cada seção

| Chave              | Para quê                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `version`          | Versão do formato. Hoje é sempre `1`. Não altere.                                                                                       |
| `organization`     | **Nome** da organização no Azure DevOps (o que vem depois de `dev.azure.com/`).                                                         |
| `appearance`       | Cor de destaque da interface.                                                                                                           |
| `processProfiles`  | Perfis de processo, indexados por um ID. Cada Produto aponta para um.                                                                   |
| `products`         | Os Produtos. `id` imutável, `name` livre, `project`, `areaPaths`, `excludedAreaPaths`, `team` (opcional), `processProfile` e `cadence`. |
| `groups`           | Grupos de produtos: um `id`, um `name` e a lista de IDs de Produto (pelo menos dois).                                                   |
| `customFields`     | Nome de referência de campos customizados do Azure (ex.: `Contoso.Retrabalho`). `null` quando o PO não usa.                             |
| `criticality`      | Níveis de criticidade de bug e os prefixos do valor do campo que caem em cada um.                                                       |
| `recurrentBugTag`  | Marcador no título que identifica bug reincidente, ou `null`.                                                                           |
| `calendar`         | País dos feriados nacionais (`"BR"` ou omitido), feriados extras, expediente e horas produtivas por dia.                                |
| `storyPoints`      | Tabela de conversão de pontos em horas.                                                                                                 |
| `capacityDefaults` | Valores iniciais do painel de capacidade do Planning.                                                                                   |

`cadence` do Produto: `"sprints"` quando ele tem iterações próprias no Azure;
`"continuous"` quando é um fluxo sem iterações — os indicadores o medem pela janela
de datas da Sprint unificada dos outros Produtos, e ele não aparece no Planning nem
na Daily.

## Nunca faça

1. **Nunca peça, aceite nem escreva o PAT** — nem em `configuracao.json`, nem em
   outro arquivo desta pasta, nem em comentário. O PO informa o PAT na tela do app,
   que o guarda cifrado fora desta pasta. Se o PO colar um token na conversa,
   avise que ele deve ser revogado no Azure e não o grave em lugar nenhum. O app
   recusa a Configuração inteira se achar um valor com forma de token ou uma chave
   chamada `pat`, `token`, `password` ou `secret`.
2. **Nunca ponha URL em `organization`.** Só o nome: `"contoso"`, não
   `"https://dev.azure.com/contoso"`. O app monta o endereço sozinho; aceitar URL
   permitiria mandar o PAT para outro servidor. Não existe campo para Azure DevOps
   Server (instalação local).
3. **Nunca mude o `id` de um Produto ou Grupo existente.** Os Dados de trabalho
   estão guardados sob esse ID e ficariam órfãos. Para mudar o que aparece na tela,
   mude o `name`. Remover um Produto é legítimo, mas confirme com o PO antes.
4. **Nunca invente nome de campo, tipo ou estado.** Os nomes precisam bater
   exatamente com os do Azure DevOps do PO, inclusive maiúsculas e acentos. Na
   dúvida, pergunte ao PO ou peça que ele confira em _Organization settings ›
   Process_.
5. **Não edite `configuracao.schema.json` nem `dados/`.** O schema é gerado pelo
   app; os Dados de trabalho são do app.

## Como validar

- O `$schema` no topo do arquivo dá autocompletar e aponta erro de forma em editores
  que entendem JSON Schema (VS Code, por exemplo).
- **O app valida ao salvar e ao perceber que o arquivo mudou.** Se houver erro, ele
  mostra a lista com o caminho de cada problema (ex.: `products[0].areaPaths[1]`) e
  **continua usando a última versão válida**. Nada quebra; o erro só precisa ser
  corrigido.
- Chave desconhecida é erro, não é ignorada. Se o app acusar uma chave, confira a
  grafia no schema.
- Algumas regras cruzam campos e só o app confere: IDs únicos, Grupo citando
  Produto existente, Produto citando Perfil de processo existente,
  `plannableTypes` e `developmentTypes` dentro de `workItemTypes`,
  `deliveredStates` dentro de `terminalStates`.
- Em JSON, a barra invertida dos area paths é escrita dobrada: `"Contoso\\Loja"`.

---

## Receitas

### Adicionar um Produto

Acrescente um objeto em `products`, com um `id` novo que nunca mais vai mudar:

```json
{
  "id": "portal",
  "name": "Portal do Cliente",
  "color": "#E4572E",
  "project": "Contoso",
  "team": "Portal Team",
  "areaPaths": ["Contoso\\Portal"],
  "excludedAreaPaths": [],
  "processProfile": "scrum"
}
```

Sem `team`, valem todas as iterações com datas do projeto. Sem `areaPaths` (ou com
a lista vazia), vale o projeto inteiro. Se o Produto deve entrar num Grupo,
acrescente o `id` na lista `products` do Grupo.

### Excluir uma área das métricas

Para medir só o time de desenvolvimento, acrescente o area path do time de teste,
suporte ou similar em `excludedAreaPaths` do Produto. Os filhos saem junto:

```json
"excludedAreaPaths": ["Contoso\\Loja\\QA", "Contoso\\Loja\\Suporte"]
```

### Mapear um campo customizado

Use o **nome de referência** do campo, não o nome de exibição. Ele aparece em
_Organization settings › Process › (processo) › (tipo) › campo_ ou na API do Azure:

```json
"customFields": {
  "reworkCount": "Contoso.Retrabalho",
  "effortFrontend": null,
  "effortBackend": null,
  "effortQa": null,
  "criticality": "Contoso.Severidade"
}
```

`criticality` aceita também uma lista, lida em ordem: vale o primeiro campo
preenchido no bug. Com o campo de criticidade mapeado, descreva os níveis:

```json
"criticality": [
  { "name": "Alta", "matches": ["alta", "1 - critical"] },
  { "name": "Baixa", "matches": ["baixa", "3 - low"] }
]
```

`matches` são prefixos do valor do campo, sem diferenciar maiúsculas.

### Acrescentar um feriado municipal ou uma emenda

Feriado que se repete todo ano usa `monthDay` (`MM-DD`); data única usa `date`
(`AAAA-MM-DD`):

```json
"extraHolidays": [
  { "monthDay": "01-25", "name": "Aniversário da cidade" },
  { "date": "2026-11-20", "name": "Emenda" }
]
```

Com `"country": "BR"`, os feriados nacionais do Brasil já são calculados pelo app.
Para outro país, omita `country` e liste aqui os feriados nacionais daquele país.

### Criar um Perfil de processo a partir de um preset

Os processos padrão do Azure DevOps têm estes presets. Copie o mais próximo do
processo do PO, dê um ID novo e ajuste o que o processo dele customizou (tipos a
mais, estados a mais):

**Scrum**

```json
"scrum": {
  "workItemTypes": ["Product Backlog Item", "Bug"],
  "plannableTypes": ["Product Backlog Item"],
  "developmentTypes": ["Product Backlog Item"],
  "bugType": "Bug",
  "taskType": "Task",
  "estimateField": "Microsoft.VSTS.Scheduling.Effort",
  "deliveredStates": ["Done"],
  "terminalStates": ["Done", "Removed"],
  "removedStates": ["Removed"],
  "inProgressState": "Committed",
  "devDoneState": null,
  "testingState": null,
  "bugStateOrder": ["New", "Approved", "Committed", "Done"]
}
```

**Agile**

```json
"agile": {
  "workItemTypes": ["User Story", "Bug"],
  "plannableTypes": ["User Story"],
  "developmentTypes": ["User Story"],
  "bugType": "Bug",
  "taskType": "Task",
  "estimateField": "Microsoft.VSTS.Scheduling.StoryPoints",
  "deliveredStates": ["Closed"],
  "terminalStates": ["Closed", "Removed"],
  "removedStates": ["Removed"],
  "inProgressState": "Active",
  "devDoneState": "Resolved",
  "testingState": null,
  "bugStateOrder": ["New", "Active", "Resolved", "Closed"]
}
```

Depois, aponte os Produtos para o novo ID em `processProfile`. Um estado que
significa entregue precisa estar também em `terminalStates`.
