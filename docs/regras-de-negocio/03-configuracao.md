# Configuração

**Pergunta que esta área responde:** como um PO descreve os próprios produtos e o
processo do time sem mexer no código — e como o app impede que esse arquivo vire
um caminho para vazar o PAT?

**Implementado em:**
`src/shared/config/schema.ts` · `src/shared/config/validate.ts` ·
`src/shared/config/secrets.ts` · `src/shared/config/presets.ts`

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

### RN-CFG-02 · IDs de Produto e Grupo são imutáveis

Os Dados de trabalho (itens manuais do Planning, capacidade, planejamento) são
guardados pelo ID do Produto ou do Grupo. **Mudar o ID órfã esses dados**, mesmo
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
- **Importar** uma Configuração colada valida antes de gravar: um JSON recusado não
  chega ao disco. Se o JSON aceito tirou IDs de Produto ou Grupo que existiam, a
  resposta aponta quais (`RN-CFG-02`).

### RN-CFG-08 · Dados de trabalho indexados por ID

Os Dados de trabalho ficam em `dados/`, um arquivo JSON por chave.

- A chave usa só `a-z`, `0-9`, `:`, `_` e `-`, com até 120 caracteres. Qualquer
  outra coisa é recusada (`WORK_DATA_INVALID_KEY`) — `../x`, barra e letra de
  unidade incluídos —, porque a chave vira nome de arquivo.
- Dado que pertence a um Produto ou Grupo usa o **ID** dele na chave
  (`<escopo>:<id>`), nunca o nome. O nome o PO troca à vontade; o ID é imutável
  (`RN-CFG-02`).
- Cada valor tem no máximo **1 MB** e é gravado de forma atômica (arquivo
  temporário + troca), para uma queda no meio não deixar um arquivo pela metade.

**Casos de borda:** o ID entra na chave em minúsculas. Dois IDs que só diferem em
maiúsculas (`Loja` e `loja`) dividem os mesmos Dados de trabalho — o que já
aconteceria de qualquer forma no Windows, cujo sistema de arquivos não distingue
caixa.
