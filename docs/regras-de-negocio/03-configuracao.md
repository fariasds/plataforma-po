# Configuração

**Pergunta que esta área responde:** como um PO descreve os próprios produtos e o
processo do time sem mexer no código — e como o app impede que esse arquivo vire
um caminho para vazar o PAT?

**Implementado em:**
`src/shared/config/schema.ts` · `src/shared/config/validate.ts` ·
`src/shared/config/secrets.ts` · `src/shared/config/presets.ts` ·
`src/shared/config/import.ts` · `src/shared/config/template.ts`

A Configuração é um arquivo JSON por Perfil (`configuracao.json`), acompanhado do
JSON Schema publicado e de um `AGENTS.md` com as instruções para a IA do PO. Ver
[ADR 0003](../adr/0003-configuracao-em-arquivo-editavel-por-ia-sem-pat.md). O
exemplo completo está em `examples/exemplo-scrum.json`.

---

### RN-CFG-01 · O schema é o contrato

A forma da Configuração é definida uma vez, em zod, e dela saem os tipos do código
e o JSON Schema gravado na pasta do Perfil (`configuracao.schema.json`).

- **Todo objeto é estrito:** chave desconhecida é erro, não é ignorada. É o que pega
  a chave digitada errado (`areaPath` no lugar de `areaPaths`), que de outro modo
  sumiria em silêncio e o indicador mostraria outra coisa.
- **`version` é obrigatório** e hoje só aceita `1`. Uma mudança incompatível de
  formato ganha versão nova.
- Campos com valor padrão podem ser omitidos; o app os preenche ao ler.
- A validação **nunca para no primeiro erro**: devolve todos, com o caminho no
  formato `products[0].areaPaths[1]`, para a tela e a IA corrigirem numa passada.
- O JSON Schema versionado é gerado por `npm run schema:generate`. Um teste falha
  se o arquivo estiver desatualizado em relação ao zod.

**Casos de borda:** regras que cruzam campos (RN-CFG-03) não cabem no JSON Schema;
o editor não as acusa, só o app ao validar.

### RN-CFG-02 · IDs de Produto, Grupo e Squad são imutáveis

Os Dados de trabalho (itens manuais do Planning, capacidade, planejamento) são
guardados pelo ID do Produto, do Grupo ou da Squad. **Mudar o ID órfã esses dados**, mesmo
que o nome continue igual.

- ID começa com letra e usa só letras, números, `_` ou `-`, com até 32 caracteres.
  Espaço e acento ficam de fora porque o ID vira chave de arquivo e de consulta.
- Para mudar o que aparece na tela, muda-se o `name`, nunca o `id`.
- O schema não enxerga a versão anterior do arquivo. Quem salva compara as duas e
  recebe a lista de IDs que sumiram (`removedIds`), para avisar antes de gravar.

### RN-CFG-03 · Referências internas íntegras

A Configuração só é aceita se tudo o que ela cita existe:

| Regra | Mensagem aponta |
|---|---|
| IDs de Produto únicos | o Produto repetido |
| ID de Grupo único e diferente de todo ID de Produto (os dois dividem o mesmo filtro) | o Grupo |
| Grupo cita só Produtos existentes, sem repetir | o item da lista |
| ID de Squad único e diferente de todo ID de Produto e de Grupo | a Squad |
| Squad cita só Produtos existentes, sem repetir, e pelo menos um | o item da lista |
| Cada Produto está em uma Squad só | o item da segunda Squad |
| Com Squads, todo Produto está em alguma (`RN-GLB-17`) | o Produto |
| Com Squads, cada Grupo cabe numa Squad só | o Grupo |
| Produto cita um Perfil de processo existente | `processProfile` |
| `plannableTypes` e `developmentTypes` ⊆ `workItemTypes`; `bugType` ∈ `workItemTypes` | o tipo que sobra |
| `deliveredStates` ⊆ `terminalStates` (entregue é, por definição, terminal) | o estado |
| Faixas de `workingHours` em ordem, sem sobreposição, com fim depois do início | a faixa |
| `productiveHoursPerDay` ≤ horas do expediente | o campo |
| Tabela `storyPoints` com pelo menos duas entradas (a interpolação precisa de vizinhos) | a tabela |

**Casos de borda:** um Grupo precisa somar pelo menos dois Produtos — com um só,
ele seria o próprio Produto com outro nome.

### RN-CFG-04 · Organização por nome, nunca por URL

`organization` guarda **só o nome** da organização no Azure DevOps — o que vem
depois de `dev.azure.com/`. O app sempre monta o endereço como
`https://dev.azure.com/<organização>`.

- Aceita `^[A-Za-z0-9][A-Za-z0-9-]{0,49}$`: letras, números e hífen, começando por
  letra ou número, até 50 caracteres.
- **URL, ponto, barra, dois-pontos e `@` são recusados**, com uma mensagem que
  explica o motivo.
- Não existe nenhum outro campo que aceite endereço de servidor.

**Por quê:** a Configuração pode ser importada de outra pessoa ou editada por uma
IA. Se aceitasse URL, um arquivo alterado mandaria o PAT para qualquer servidor na
primeira consulta. Por isso o Azure DevOps Server (instalação local) fica fora da v1.

**Garantido por:** `tests/security/rn-cfg-04-organizacao-por-nome.test.ts`

### RN-CFG-05 · Nenhum segredo na Configuração

O PAT nunca faz parte da Configuração: ele é informado na tela do app e guardado
cifrado, fora da pasta do Perfil. A validação recusa o arquivo inteiro quando:

- **algum valor de texto, em qualquer profundidade, tem forma de token** — as
  mesmas formas que o hook de `pre-commit` barra (PAT clássico do Azure, tokens do
  GitHub), mais o PAT do formato novo do Azure e o cabeçalho `Basic`;
- **alguma chave se chama `pat`, `token`, `password` ou `secret`**, sozinha ou como
  final do nome (`accessToken`, `azure_pat`).

A varredura roda sobre o JSON cru, **antes** da forma: um arquivo com PAT é
recusado mesmo que o resto esteja certo, e mesmo que o segredo esteja numa chave
que o schema já rejeitaria. A mensagem de erro **nunca repete o valor** — ela vai
para a tela e o log, e repetir o segredo ali seria vazá-lo por outro caminho.

**Garantido por:** `tests/security/rn-cfg-05-sem-segredo.test.ts`

---

## Perfil no disco

**Implementado em:** `src/main/profile/` (`paths.ts`, `profile-store.ts`,
`config-loader.ts`, `work-data.ts`) · `src/main/security/pat-store.ts`

```
<userData>/
  perfis.json                  Perfil ativo e lista de Perfis
  perfis/<id>/                 pasta que o app abre ("Abrir pasta")
    configuracao.json
    configuracao.schema.json
    AGENTS.md
    dados/*.json               Dados de trabalho
  segredos/<id>.bin            PAT cifrado
```

O ID do Perfil é um slug (`^[a-z0-9-]{1,40}$`) gerado do nome. Nenhum caminho vem
da interface: ela fala em "Perfil ativo" e em chave de Dados de trabalho, e o
processo principal resolve onde isso mora.

Um Perfil novo nasce com a organização, o Perfil de processo Scrum e **nenhum
Produto** — por isso a lista de Produtos da Configuração pode ser vazia. Ele só é
criado se o PAT funcionar no Azure e se o sistema operacional oferecer cifragem
(`RN-SEC-09`); do contrário, nada vai para o disco.

### RN-CFG-06 · Segredo fora da pasta do Perfil

O PAT é gravado em `segredos/<id>.bin`, **fora** de `perfis/<id>/`. Nenhum arquivo da
pasta do Perfil contém o PAT, nem em texto puro nem cifrado.

**Por quê:** a pasta do Perfil é justamente a que o app abre para o PO e que a IA
dele lê para editar a Configuração. O que estiver ali pode ser copiado, compartilhado
ou enviado junto num pedido de ajuda. O segredo cifrado não teria utilidade fora da
máquina, mas não há motivo para ele estar ao alcance.

**Garantido por:** `tests/security/rn-cfg-06-segredo-fora-do-perfil.test.ts`

### RN-CFG-07 · Configuração quebrada não derruba o app

O app observa `configuracao.json` e recarrega sozinho quando o arquivo muda
(esperando ~300 ms para juntar gravações seguidas). Cada versão passa pela
validação completa (`RN-CFG-01` a `RN-CFG-05`).

| Situação | Estado | O que a tela mostra |
|---|---|---|
| Arquivo válido | `ready` | o app |
| Arquivo inválido, mas já houve versão válida | `ready`, com erros | o app, na **última versão válida**, com um aviso no topo listando os erros e o botão "Abrir pasta" |
| Arquivo inválido desde que o app abriu | `invalid-config` | a lista de erros e o botão "Abrir pasta" |
| Arquivo corrigido | `ready` | o app, sem aviso |

- **JSON com erro de sintaxe** mostra só a posição (linha e coluna). A mensagem do
  interpretador cita um trecho do texto, e esse trecho poderia ser um token colado
  por engano (`RN-CFG-05`).
- Quando a Configuração em uso muda, a interface descarta **todos** os resultados
  em cache: qualquer um pode ter sido calculado com Produtos, estados ou calendário
  antigos. Salvar o arquivo sem mudar nada não descarta nada.
- **Importar** uma Configuração valida antes de gravar: um JSON recusado não
  chega ao disco. A prévia e o aviso do que sai estão na `RN-CFG-09`.

### RN-CFG-08 · Dados de trabalho indexados por ID

Os Dados de trabalho ficam em `dados/`, um arquivo JSON por chave.

- A chave usa só `a-z`, `0-9`, `:`, `_` e `-`, com até 120 caracteres. Qualquer
  outra coisa é recusada (`WORK_DATA_INVALID_KEY`) — `../x`, barra e letra de
  unidade incluídos —, porque a chave vira nome de arquivo.
- Dado que pertence a um Produto, Grupo ou Squad usa o **ID** dele na chave
  (`<escopo>:<id>`), nunca o nome. A capacidade de uma Squad, por exemplo, fica em
  `planning:capacity:<id da Squad>` (`RN-PLN-22`). O nome o PO troca à vontade; o ID é imutável
  (`RN-CFG-02`).
- Cada valor tem no máximo **1 MB** e é gravado de forma atômica (arquivo
  temporário + troca), para uma queda no meio não deixar um arquivo pela metade.

**Casos de borda:** o ID entra na chave em minúsculas. Dois IDs que só diferem em
maiúsculas (`Loja` e `loja`) dividem os mesmos Dados de trabalho — o que já
aconteceria de qualquer forma no Windows, cujo sistema de arquivos não distingue
caixa.

### RN-CFG-09 · Importar mostra a diferença antes de gravar

Uma Configuração que chega de fora (o arquivo de um colega, a cópia de outra
máquina) passa por um caminho só, que **valida, confere a organização e calcula a
diferença sem gravar nada**. A tela mostra essa diferença; só o "Aplicar" grava, e
grava pelo mesmo cálculo, então o que o PO revisou é o que vai para o disco.

- **A diferença é pelo ID.** Produto, Grupo, Squad e Perfil de processo aparecem
  como **Entra**, **Muda** ou **Sai**. As demais seções (organização, cor de
  destaque, campos customizados, criticidade, marcador de reincidente, calendário,
  tabela de story points, valores iniciais da capacidade) aparecem como **Muda**
  quando o valor é outro.
- **O que sai é avisado antes de aplicar:** um ID que some órfã os Dados de
  trabalho guardados com ele (`RN-CFG-02`), e trocar o ID de um Produto aparece
  como um que sai e outro que entra.
- **A organização do arquivo precisa ser a do Perfil**, sem diferenciar
  maiúsculas. O PAT do Perfil só vale para a organização dele; um arquivo de outra
  é recusado com esse motivo. Na primeira execução não há Perfil, e é a
  organização do arquivo que cria o Perfil.
- **A Configuração completa é gravada como veio**, sem os valores padrão
  preenchidos: ela continua sendo do autor, e a IA dele a lê como foi escrita. O
  Modelo de processo é gravado já somado à Configuração em uso (`RN-CFG-10`).
- Valem as mesmas regras do arquivo no disco: 1 MB no máximo, JSON quebrado mostra
  só a posição, e as `RN-CFG-01` a `05`.
- O Perfil de demonstração não oferece importar: ele é regravado pelo Cenário
  (`RN-GLB-15`).

**Casos de borda:** um arquivo igual à Configuração em uso é aceito e a prévia diz
que nada muda. Uma Squad que só mudou de lugar na lista não aparece como mudança.

### RN-CFG-10 · Modelo de processo leva como o time trabalha, não a empresa

Exportar oferece dois arquivos:

| Arquivo | Leva | Para quem |
|---|---|---|
| **Configuração completa** | tudo o que está em `configuracao.json` | um colega da mesma organização |
| **Modelo de processo** | Perfis de processo, campos customizados, criticidade, marcador de reincidente, calendário, tabela de story points e valores iniciais da capacidade | um PO de outra empresa |

- **O Modelo não leva** organização, Produtos, Grupos, Squads nem a cor de
  destaque: são da empresa de quem exportou. O arquivo é marcado com
  `"kind": "modelo-de-processo"` e `"version": 1`.
- **Importar um Modelo mescla, nunca substitui:** os Perfis de processo do Modelo
  entram ou substituem os de mesmo ID; os demais Perfis de processo, a organização,
  os Produtos, os Grupos e as Squads do Perfil ficam como estão. As outras seções
  do Modelo substituem as do Perfil.
- O resultado passa pela validação completa (`RN-CFG-01` a `05`) e pela prévia
  (`RN-CFG-09`). Um Produto que aponta para um Perfil de processo que não existe
  continua sendo erro.
- **Na primeira execução**, a porta "Importar Configuração" aceita também um
  Modelo. Como ele não tem organização, a tela a pede junto com o token, e o
  Perfil nasce da Configuração inicial (`RN-CFG-07`) com o Modelo aplicado por cima.
- A varredura de segredo (`RN-CFG-05`) vale para o Modelo como para a
  Configuração.

**Casos de borda:** o Modelo traz os feriados extras de quem exportou; o PO de
outra cidade ajusta depois.

### RN-CFG-11 · Mesclar soma pelo ID; Substituir troca tudo

Ao importar uma Configuração completa num Perfil que já está em uso, o PO escolhe
como ela entra:

| Modo | O que acontece |
|---|---|
| **Substituir** (padrão) | A Configuração do Perfil passa a ser a do arquivo. O que só existia no Perfil sai, e a prévia mostra o quê (`RN-CFG-09`). |
| **Mesclar** | O arquivo vence nos IDs iguais e nas seções; o que só existe no Perfil fica. |

No modo Mesclar:

- **Produtos, Grupos e Squads** seguem a ordem do Perfil: o item do arquivo entra no
  lugar do de mesmo ID, e os novos vão para o fim da lista.
- **Perfis de processo** se somam pelo ID, e o do arquivo vence.
- **As demais seções** (campos customizados, criticidade, calendário, story points,
  valores iniciais da capacidade, marcador de reincidente) são as do arquivo.
- **A cor de destaque fica a do Perfil:** ela é de quem usa o app, não da
  Configuração do colega.
- **A soma é validada de novo.** Cada lado pode fechar suas referências e a soma,
  não: um Produto que só existe no Perfil fica fora de toda Squad do arquivo, e com
  Squads todo Produto precisa estar numa (`RN-GLB-17`). O erro aparece na prévia, e
  nada é gravado.
- Sem Perfil anterior (primeira execução), não há com o que somar: vale o arquivo.
- O modo chega da janela e é conferido no processo principal; um modo desconhecido
  é recusado.

**Casos de borda:** mesclar não tira nada. Para remover um Produto que o colega
removeu, use Substituir ou edite a Configuração.

### RN-CFG-12 · A IA propõe, o PO aplica

A IA do PO pode gravar uma **proposta** de Configuração em `proposta.json`, na pasta
do Perfil, em vez de alterar `configuracao.json`. O `AGENTS.md` pede isso, e o
servidor MCP só grava assim, pela ferramenta `propor_configuracao` (ADR 0010,
`RN-SEC-35`).

- **A proposta é a Configuração inteira, como ficaria.** O app a lê como qualquer
  importação: valida, confere a organização e calcula a diferença para a
  Configuração em uso (`RN-CFG-09`). Um Modelo de processo também vale como proposta
  (`RN-CFG-10`).
- **Nada muda até o PO aplicar.** Uma faixa no topo da janela avisa que há proposta
  e leva à tela de Configuração, onde ela aparece com o que entra, muda e sai, e o
  aviso dos IDs que saem (`RN-CFG-02`).
- **Aplicar grava pelo mesmo caminho do Importar**, sempre substituindo, e só então
  apaga a proposta. **Descartar** apaga a proposta sem tocar na Configuração.
- **Proposta recusada continua lá**, com os erros e o caminho de cada um, para a IA
  corrigir e gravar de novo. Aplicar fica indisponível.
- O app observa `proposta.json` como observa `configuracao.json` (`RN-CFG-07`) e
  mostra a versão mais recente, com a hora em que foi gravada.
- A proposta é lida contra a Configuração **em uso**: se ela mudar depois, a
  diferença mostrada muda junto.

**Casos de borda:** uma proposta igual à Configuração em uso aparece dizendo que
nada muda; aplicar ou descartar dá no mesmo. O `AGENTS.md` de um Perfil criado antes
desta regra não fala da proposta: ele é escrito só quando o Perfil nasce.

### RN-CFG-13 · Conectar à sua IA mostra o que colar, e o PO cola

A tela **Conectar à sua IA** (em Configuração, e a porta "Configurar com a sua IA" da
primeira execução) mostra o trecho que liga a IA do PO ao servidor MCP do app
(ADR 0010), para o Perfil em uso.

| IA | O que a tela mostra |
|---|---|
| Claude Desktop, Cursor | `mcpServers.plataforma-po` com `command` e `args`, para colar no arquivo de configuração da IA |
| VS Code | `servers.plataforma-po` com `type: "stdio"`, `command` e `args` |
| Claude Code | O comando `claude mcp add plataforma-po --scope user -- <executável> --mcp --perfil <id>`, para o PowerShell |
| ChatGPT ou outra | Não há trecho: essas IAs só se conectam a servidores na internet, e o app não tem servidor (ADR 0002). A tela aponta o assistente e o Importar |

- **O caminho do executável e o ID do Perfil vêm do processo principal**, já
  prontos; o PO não digita nada. No app empacotado, o executável é o próprio app;
  em desenvolvimento, é o do Electron, com a pasta do app antes do `--mcp`.
- **O trecho não leva o token nem caminho de dado.** Só o executável, `--mcp`,
  `--perfil` e o ID.
- **No comando, o caminho com espaço vai entre aspas simples do PowerShell**, com a
  aspa simples dobrada (`O'Brien` vira `'O''Brien'`). Entre aspas simples o PowerShell
  não interpreta `$`, crase nem barra invertida, então nada do caminho vira comando.
- **O app não mexe na configuração da IA.** Ele mostra e copia; quem cola é o PO,
  na IA dele. O app continua sem iniciar processo (`RN-SEC-23`).
- **Na primeira execução**, a porta "Configurar com a sua IA" cria o Perfil como as
  outras, com a organização e o token, sem nenhum Produto, e abre esta tela. A IA
  então propõe a Configuração (`RN-CFG-12`).

**Casos de borda:** quem já tem outros servidores no arquivo do Claude Desktop
acrescenta só o bloco `plataforma-po`; a tela avisa. Trocar de Perfil muda o ID no
trecho, e a IA conectada antes continua presa ao Perfil antigo até o PO colar o novo.
