# A IA do PO conversa com o app por um servidor MCP local

**Status:** aceita · 2026-11-21 · amplia o [ADR 0007](0007-ia-do-po-por-copiar-e-colar.md)

A IA do PO (Claude Desktop, Claude Code, Cursor, VS Code ou qualquer cliente MCP)
pode ler e propor mudanças na Configuração por um **servidor MCP** que o próprio
app oferece. Quem inicia o servidor é o cliente de IA, com
`plataforma-po-desktop.exe --mcp --perfil <id>`. O servidor fala por stdio, não
abre porta, não faz rede e não lê o PAT. Ele **nunca grava a Configuração**:
grava uma proposta, que o PO revisa e aplica na janela do app.

O ADR 0007 deixou esta porta prevista: "a IA do PO consulta o app, e não o
contrário". Copiar e colar continua valendo para quem usa uma IA sem MCP local,
como o ChatGPT.

## Por que assim

- **stdio, e não HTTP local.** Uma porta aberta, mesmo em `localhost`, pode ser
  chamada por qualquer página aberta no navegador. stdio só existe entre o cliente
  de IA e o processo que ele iniciou.
- **Quem inicia é a IA.** O app continua sem iniciar processo (`RN-SEC-23`). O
  modo `--mcp` é o mesmo executável, chamado de fora.
- **Proposta, e não gravação.** O que vem da IA é rascunho (`RN-SEC-26`). O app
  valida a proposta de novo e mostra a diferença (`RN-CFG-09`) antes de o PO
  aplicar. Isso também evita que dois processos gravem `configuracao.json`: a
  janela grava a Configuração, o servidor grava só a proposta.
- **Um Perfil por conexão.** `--perfil` prende o servidor a um Perfil. Sem ele, o
  servidor recusa: o Perfil ativo pode mudar enquanto a IA trabalha.
- **Protocolo escrito aqui, sem o SDK oficial.** Por stdio, o MCP são poucas
  mensagens JSON-RPC (`initialize`, `tools/*`, `prompts/*`, `resources/*`). O SDK
  traz servidor HTTP e as dependências dele para dentro do instalador, e cada
  pacote a mais é superfície na fronteira de segurança.

## Prova técnica

Feita em 2026-11-21, no Windows, com o binário do Electron do projeto e uma pasta de
dados fictícia (`--user-data-dir`):

- **`process.stdin` chega vazio** no processo principal do Electron no Windows,
  mesmo com o pipe aberto: o evento `end` vem sem nenhum byte.
- **O descritor 0 lido pelo `fs`** (`createReadStream('', { fd: 0 })`) recebe o
  que o cliente escreve, e `process.stdout` entrega as respostas no pipe. É assim
  que o servidor lê a entrada.
- `initialize`, `tools/list`, `ping` e uma linha que não é JSON responderam como o
  protocolo pede; sem `--perfil` o processo sai com código 2, e com um Perfil que não
  existe, com código 1, os dois com a mensagem do que fazer.

O modo Node do Electron (`ELECTRON_RUN_AS_NODE`) também lê o stdin, mas foi
descartado: amarraria o app a manter ligado o fusível `RunAsNode`, que a boa prática
de endurecimento do Electron manda desligar.

## O que sai desta decisão

- **`RN-SEC-34`, nova:** o servidor MCP não faz rede nem lê o PAT.
- **A proposta e as ferramentas** entram com regras próprias, junto com o código
  delas: a IA propõe e o PO aplica, e o servidor grava só a proposta.
- **`RN-SEC-23` não muda.** Nenhum arquivo de `src/` inicia processo.
- **`RN-SEC-31`:** a tela Segurança passa a mostrar as duas garantias novas.

## Alternativas consideradas

- **Servidor HTTP em `localhost`:** abriria a porta para qualquer página do
  navegador e exigiria token, checagem de origem e defesa contra DNS rebinding.
- **Servidor remoto (para o ChatGPT):** exigiria um servidor público, o que o app
  não tem (`ADR 0002`).
- **A IA gravar `configuracao.json` direto:** é o que o `AGENTS.md` permite hoje.
  Continua possível para quem edita à mão, mas a IA conectada pelo MCP passa a
  propor, e o app avisa antes de um ID sumir.
- **Ler o Azure pelo servidor MCP:** exigiria o PAT fora do processo da janela.
  Fica para um ADR próprio.

## Consequências

- O PO instala uma vez na IA dele; a tela "Conectar à sua IA" mostra o trecho
  pronto, com o caminho do executável.
- Funcionalidades futuras (escrever ou refinar PBI, Discovery) entram como prompts
  novos no mesmo servidor, sem nova instalação.
- O modo `--mcp` sobe antes da trava de instância única e sem janela. A janela e
  o servidor podem estar abertos ao mesmo tempo, porque não gravam no mesmo
  arquivo.
