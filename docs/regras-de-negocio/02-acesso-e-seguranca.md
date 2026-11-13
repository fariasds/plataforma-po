# Acesso e Segurança

**Pergunta que esta área responde:** como o aplicativo alcança os dados do Azure
DevOps sem que o token saia da máquina de quem o usa?

**Implementado em:**
`src/main/security/pat-store.ts` · `src/main/security/network-guard.ts` ·
`src/main/security/redact.ts` · `src/main/services/azure/client.ts` ·
`src/main/services/azure/directory.ts` · `src/renderer/src/auth/` ·
`src/main/services/ai/` · `src/shared/ai.ts` · `scripts/scan-secrets.mjs`

**Provado por:** `tests/security/` — cada arquivo começa com o ID da regra que prova.

## Credenciais: onde cada uma mora e o que a protege

**O app não tem credencial própria, não usa conta de IA de ninguém e não manda o
PAT para lugar nenhum além do Azure.** A única credencial que ele guarda é o PAT de
cada PO, e só na máquina dele.

| Credencial | De quem | Onde mora | O que impede o vazamento |
|---|---|---|---|
| PAT do Azure | de cada PO | `segredos/<id>.bin`, cifrado pelo sistema operacional, fora da pasta do Perfil | `RN-SEC-09`, `10`, `18`, `19`, `20`, `RN-CFG-05`, `06` |
| Conta de IA (Claude, ChatGPT e outras) | de cada PO | na própria IA; o app nunca a usa | `RN-SEC-23` (sem processo) e `RN-SEC-18` (rede só para o Azure) |
| Token colado no conteúdo do Azure | de terceiros | no work item | `RN-SEC-24` (redação antes da prévia e da cópia) |
| Credenciais do mantenedor e de quem contribui | do mantenedor e de quem abre PR | fora do repositório | `RN-SEC-28`, `RN-SEC-22` |
| Perfil de demonstração | ninguém | não tem nenhuma: não tem PAT e recusa um | `RN-SEC-27` |

Cada regra aponta para o seu teste no índice abaixo.

## Índice

| Regra | Assunto | Garantida por |
| ----- | ------- | ------------- |
| RN-SEC-01 a 08 | Autenticação da versão interna | Revogadas (ADR 0002) |
| RN-SEC-09 | PAT cifrado, só na máquina | `tests/security/rn-sec-09-cifragem-obrigatoria.test.ts` |
| RN-SEC-10 | O PAT nunca chega à interface | `tests/security/rn-sec-10-contrato-ipc.test.ts` · `rn-sec-10-envelopes-sem-pat.test.ts` |
| RN-SEC-11 | Validação antes de guardar | Sem teste automático |
| RN-SEC-12 | Trocar o PAT limpa o cache | Sem teste automático |
| RN-SEC-13 | O pacote não carrega segredo | Auditoria do pacote (`docs/DISTRIBUICAO.md`) |
| RN-SEC-14 | Sem assinatura de código | Decisão, não barreira |
| RN-SEC-15 | Fonte privado, binário público | Revogada (substituída pela RN-SEC-22) |
| RN-SEC-16 | Dono do PAT, visto pelo Azure | Sem teste automático |
| RN-SEC-17 | Autenticação da versão interna | Revogada (ADR 0002) |
| RN-SEC-18 | O main só fala com o Azure | `tests/security/rn-sec-18-fronteira-de-rede.test.ts` |
| RN-SEC-19 | O PAT é apagado de log e erro | `tests/security/rn-sec-19-redacao.test.ts` |
| RN-SEC-20 | Somente leitura no Azure | `tests/security/rn-sec-20-somente-leitura.test.ts` |
| RN-SEC-21 | Link externo só para a organização | `tests/security/rn-sec-21-links-externos.test.ts` |
| RN-SEC-22 | Instalador público pela esteira, com hash | `.github/workflows/release.yml` |
| RN-SEC-23 | O app não inicia processo | `tests/security/rn-sec-23-fronteira-de-processo.test.ts` |
| RN-SEC-24 | Só campos permitidos vão no pedido, redigidos e com prévia | `tests/security/rn-sec-24-dado-minimo-para-ia.test.ts` |
| RN-SEC-25 | O app executa só a IA que ele localiza | Revogada (ADR 0007) |
| RN-SEC-26 | A resposta colada é texto, e é rascunho | `tests/security/rn-sec-26-resposta-da-ia.test.ts` |
| RN-SEC-27 | Perfil de demonstração sem rede e sem PAT | `tests/security/rn-sec-27-perfil-de-demonstracao.test.ts` |
| RN-SEC-28 | Nenhuma credencial entra no repositório | `tests/security/rn-sec-28-varredura-de-credenciais.test.ts` · CI |
| RN-SEC-29 | A janela é endurecida | `tests/security/rn-sec-29-janela-endurecida.test.ts` |
| RN-SEC-30 | Varredura do Electron sem apontamento novo | `npm run verify:electron` · `tests/security/electronegativity-aceitos.json` |
| RN-SEC-31 | A tela Segurança só promete o que é provado | `src/renderer/src/features/security/guarantees.test.ts` |
| RN-SEC-32 | Para o GitHub só sai o que já é público | `tests/security/rn-sec-32-publicacao-so-da-historia-publica.test.ts` · hook de `pre-push` |

As regras da Configuração que protegem o PAT (`RN-CFG-04`, `05` e `06`) estão em
[03-configuracao.md](03-configuracao.md), cada uma com o seu teste.

---

## Regras revogadas

A versão pública não tem autenticação: cada instalação tem um Perfil local, protegido
pela conta do sistema operacional ([ADR 0002](../adr/0002-sem-autenticacao-perfil-local-por-maquina.md)).

- RN-SEC-01 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-02 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-03 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-04 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-05 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-06 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-07 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-08 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-17 — revogada (ADR 0002): a versão pública não tem autenticação.
- RN-SEC-15 — revogada em 2026-09-29 (ADR 0004): o código passa a ser público, e o
  instalador sai da esteira pública. Substituída pela `RN-SEC-22`.
- RN-SEC-25 — revogada em 2026-11-12 (ADR 0007): o app deixou de executar o Provedor
  de IA. A IA do PO passou a ser por copiar e colar.

---

## Token do Azure

### RN-SEC-09 · Guardado criptografado, só na máquina

O token é gravado com o **`safeStorage` do sistema operacional** (DPAPI no Windows),
em `segredos/<perfilId>.bin` na pasta de dados do usuário — um por Perfil, fora da
pasta do Perfil (ver `RN-CFG-06`).

**Sem cifragem, não grava.** Se o sistema operacional não oferece a cifragem, o app
recusa guardar o token (`ENCRYPTION_UNAVAILABLE`) e nenhum arquivo é criado — nem em
texto puro, nem provisório. Ao criar um Perfil, essa checagem vem antes de criar a
pasta.

**Regra de ouro:** o token nunca vai a servidor nenhum além do Azure. Vive e morre
na máquina, e só sai por **HTTPS para o Azure DevOps** — o destino legítimo.

**Ausência e falha de acesso são coisas diferentes.** Só `ENOENT` significa que não
há token. Qualquer outro erro ao consultar o arquivo — permissão, antivírus,
bloqueio momentâneo — vira `PAT_UNREADABLE` e chega à tela como erro, com o caminho
e o código.

O motivo é concreto: `existsSync` responde `false` nos dois casos. Tratar os dois
igual fazia o app **pedir um token a quem já tinha um guardado** — e convidava a
substituir por engano um token válido, que o Azure não mostra duas vezes.

**Garantido por:** `tests/security/rn-sec-09-cifragem-obrigatoria.test.ts`

### RN-SEC-10 · O token nunca chega à interface

Não existe operação de leitura do token exposta à janela. Ele entra uma vez, e a
partir daí **somente o processo principal o lê**, ao montar cada requisição.

A interface consegue saber _se existe_ um token, salvar um novo e apagar o atual —
nunca ler o valor.

Também nenhum **resultado nem erro** de handler carrega o token. O caso que obriga
isso é o servidor que ecoa o cabeçalho `Authorization` no status da resposta: o
status entra na mensagem do erro, e o erro atravessa o IPC. A mensagem passa pela
redação da `RN-SEC-19` antes de sair.

**Provado por:** `tests/security/rn-sec-10-contrato-ipc.test.ts` (o contrato não
tem leitura) e `tests/security/rn-sec-10-envelopes-sem-pat.test.ts` (chama todos
os canais contra um servidor que ecoa o token e confere cada envelope).
A ponte da janela é só o objeto `api`; não existe `window.electron` com um
`ipcRenderer` genérico (`RN-SEC-29`).

### RN-SEC-11 · Validação antes de guardar

Ao cadastrar, o token é testado contra o Azure com uma chamada mínima. **Só é
gravado se funcionar.**

Sem isso, um token errado seria aceito em silêncio e só falharia depois, no
dashboard, com um erro fora de contexto.

Os erros são distinguidos: token inválido ou sem escopo, falta de conexão, e
sistema operacional sem criptografia disponível.

**Teste:** nenhum automático. A recusa sem criptografia é coberta pela `RN-SEC-09`;
a chamada ao Azure é conferida à mão, com um PAT inválido.

**Implementado em:** `src/main/ipc/pat-handlers.ts` e
`src/main/services/azure/client.ts` (`checkCredentials`)

### RN-SEC-12 · Trocar o token limpa o cache

Ao remover ou trocar o token, todo o cache de dados é invalidado — na janela e,
no processo principal, o de fotos e o do dono do PAT (`RN-SEC-16`). Dado obtido
com o token antigo não pode sobreviver à troca.

**Teste:** nenhum automático.

**Implementado em:** `src/renderer/src/ipc/usePat.ts` e
`src/main/ipc/pat-handlers.ts`

### RN-SEC-16 · Quem é o dono do token, visto pelo Azure

O menu do usuário mostra **foto e nome de quem é dono do PAT**, e saúda pelo
primeiro nome. Não há login: o token é a única identidade que o app conhece.

Quem diz a quem o token pertence é o próprio Azure, em
`GET https://dev.azure.com/<org>/_apis/connectionData`. O campo `authenticatedUser`
traz o nome (`providerDisplayName`, ou `customDisplayName` quando a pessoa definiu
um) e o `id`. Nenhum email entra na conta, e nada é varrido no diretório.

A foto vem do **mesmo endpoint de avatar** dos responsáveis (`RN-DLY-13`), que pede
o _subject descriptor_. Quando `connectionData` não o traz, ele é obtido a partir do
`id` em `/_apis/graph/descriptors/<id>`. Os dois passos usam o escopo **Graph
(Read)** do PAT.

**Nada disso autoriza acesso.** É exibição. Sem o escopo Graph, ou sem foto no
Azure, o menu mostra as **iniciais**; sem nome, o ícone genérico. A falha é
registrada no log, não na tela.

O perfil é cacheado no processo principal e o cache é esvaziado junto com o de fotos
**sempre que o PAT muda**: o token novo pode ser de outra pessoa, e um `null` gravado
pelo antigo impediria nova busca.

**Teste:** nenhum automático. O que importa para a segurança — nenhum envelope
carrega o PAT — é coberto pela `RN-SEC-10`.

**Implementado em:** `src/main/services/azure/directory.ts` e
`src/renderer/src/components/UserMenu.tsx`

---

## Fronteira de rede

As quatro regras abaixo fecham os caminhos por onde o token sairia do lugar certo.
Cada uma é uma barreira no código **e** um teste que já falhou com a barreira
desligada.

### RN-SEC-18 · O processo principal só fala com o Azure

Toda requisição com o token sai de **um único `fetch`**, em
`src/main/services/azure/client.ts`, logo depois de `assertAllowedAzureUrl`. A URL
precisa ser `https:`, com host **exatamente** `dev.azure.com` ou
`vssps.dev.azure.com`, sem usuário, senha ou porta, e com a organização como
primeiro segmento do caminho (sem distinguir maiúsculas).

Host exato, e não "contém", porque `dev.azure.com.evil.com` e
`evil.com/dev.azure.com` contêm o texto. A checagem vale também para a URL de foto
que o próprio work item traz: ela vem de resposta do Azure e é seguida com o token.

O `fetch` do Node **não passa** pelo `session` do Electron — por isso a barreira é o
`client.ts`, e um teste estático garante que nenhum outro arquivo de `src/main`
abre conexão (`fetch`, `net`, `http.request`, `undici`). A janela, por sua vez, tem
toda requisição de rede cancelada: só carrega arquivos do pacote, DevTools, `data:`
e `blob:`, e em desenvolvimento o servidor do Vite. É defesa em profundidade atrás
da CSP.

Foto de pessoa só vem de `dev.azure.com` ou `vssps.dev.azure.com`. Organização
antiga que ainda devolva link em `*.visualstudio.com` fica sem foto — a tela cai
para as iniciais — em vez de o token ir para um host fora da lista.

**Provado por:** `tests/security/rn-sec-18-fronteira-de-rede.test.ts`.

### RN-SEC-19 · O token é apagado de log e de erro

Tudo que o processo principal escreve no console, e toda mensagem de erro que vai
para a janela, passa por `redact` (`src/main/security/redact.ts`). Duas redes:

- **O token conhecido.** Cada PAT que monta um cabeçalho é registrado e apagado
  cru e em base64 — inclusive o que está sendo validado e ainda não foi guardado.
- **A forma.** PAT clássico e novo do Azure, tokens do GitHub (as mesmas formas do
  hook de pre-commit e da `RN-CFG-05`), `Basic <base64>` e o valor de qualquer
  `Authorization:`.

O log da janela encaminhado ao terminal também passa pela redação.

**Provado por:** `tests/security/rn-sec-19-redacao.test.ts`.

### RN-SEC-20 · Somente leitura no Azure

O app faz `GET`, e o **único `POST` permitido é a consulta WIQL**
(`/_apis/wit/wiql`), que é leitura apesar do verbo. `PATCH`, `PUT`, `DELETE` e
`POST` para qualquer outro caminho são recusados antes de sair.

Um PAT criado com escopo de escrita, por engano, continua sem conseguir escrever
pelo app.

**Provado por:** `tests/security/rn-sec-20-somente-leitura.test.ts`.

### RN-SEC-21 · Link externo só para a organização

A janela nunca abre outra janela. Um link — de `target="_blank"` ou de navegação
da própria janela — só vai para o navegador se for `https://dev.azure.com/<organização>/…`.
O resto, inclusive `javascript:`, `file:` e outra organização, é negado e registrado
no log (já redigido).

Isso protege contra link injetado em título ou descrição de work item.

**Provado por:** `tests/security/rn-sec-21-links-externos.test.ts`.

### RN-SEC-27 · Perfil de demonstração sem rede e sem PAT

O Perfil de demonstração (`RN-GLB-15`) é servido pelo Azure fictício dos Cenários.
Ele abre um segundo caminho de dados ao lado do único `fetch` do main
(`RN-SEC-18`), e por isso é cercado por quatro garantias:

1. **O desvio é decidido só no main, por um ponto único.** O `client.ts` pergunta
   ao Perfil ativo, lido de `perfis.json`, se ele é de demonstração; só então
   entrega o pedido ao Azure fictício em vez do `fetch`. Nenhum dado vindo da
   janela decide isso: nenhum método de IPC recebe parâmetro que escolha o caminho.
   O nome da organização também não decide: um Perfil real com organização
   `contoso` vai para o Azure de verdade.
2. **Sem PAT, e recusa um.** Com o Perfil de demonstração ativo, gravar um PAT é
   recusado antes de qualquer checagem no Azure, `hasPat` responde não, nenhum
   arquivo nasce em `segredos/` e o PAT nunca é lido no caminho de demonstração.
3. **Sem cache que atravesse a troca.** Cada pedido vai para o caminho do Perfil
   ativo naquele momento. Ao entrar na demonstração ou sair dela, os caches de foto
   e de perfil do Azure são esvaziados; na demonstração, a foto é sempre vazia e a
   tela cai para as iniciais.
4. **Sem link externo.** A organização é fictícia, e `dev.azure.com/contoso`
   abriria a organização de outra pessoa. Na demonstração, o ID do item aparece sem
   link, e o main nega qualquer link externo (`RN-SEC-21`).

**Provado por:** `tests/security/rn-sec-27-perfil-de-demonstracao.test.ts`.

---

## Janela

### RN-SEC-29 · A janela é endurecida

A janela que mostra o app roda com as proteções do Electron ligadas e escritas no
código, não herdadas de padrão:

- **sandbox**: o código da janela não alcança o sistema operacional;
- **isolamento de contexto**: a página e o preload não compartilham objetos;
- **sem Node** (`nodeIntegration: false`) e sem `<webview>`;
- **sem permissões**: câmera, microfone, notificação, localização e o resto são
  negados, tanto no pedido quanto na consulta. A única exceção é **escrever** na
  área de transferência, que o Planning usa para copiar o pedido à IA do PO e o
  resumo da sprint;
- **a ponte é só `api`**: o preload expõe à janela apenas os métodos do contrato de
  IPC. O `electronAPI` do `@electron-toolkit/preload`, que vinha do modelo do
  electron-vite, saiu: ele dava à janela um `ipcRenderer` que chama qualquer canal.
  Sem isolamento de contexto, o preload não expõe nada.

Nenhum arquivo do main pode afrouxar essas opções (`sandbox: false`,
`contextIsolation: false`, `nodeIntegration: true`, `webSecurity: false` e
semelhantes).

**Provado por:** `tests/security/rn-sec-29-janela-endurecida.test.ts`, que lê o
código do main e do preload. Visto falhar contra a versão anterior (`sandbox: false`,
`window.electron` e sem handler de permissão) em 2026-11-13.

### RN-SEC-30 · Varredura do Electron sem apontamento novo

O `npm run check` roda o **Electronegativity** (Doyensec) sobre `src/`, em versão
fixa, com a versão do Electron instalada. Todo apontamento precisa estar em
`tests/security/electronegativity-aceitos.json`, com o **motivo** por escrito: falso
positivo, coberto por outra regra ou risco aceito. Apontamento novo, sem aceite,
reprova o portão.

Um aceite que deixou de aparecer também reprova, para a lista não acumular motivo
de coisa que já não existe.

A CSP com `style-src 'unsafe-inline'` é o risco aceito que fica: o Ant Design
injeta estilos em tempo de execução. `script-src 'self'` continua fechado.

**Provado por:** `npm run verify:electron` (`scripts/verify-electron.mjs`), que entra no `npm run check`, e `tests/security/rn-sec-30-varredura-electron.test.ts` (a comparação com os aceites). Visto reprovar contra a versão anterior da janela, com 3 apontamentos sem aceite, em 2026-11-13.

### RN-SEC-31 · A tela Segurança só promete o que é provado

O app tem uma tela **Segurança**, no pé do menu, ao lado da Configuração. Ela
lista, em linguagem de quem usa, o que o app garante sobre o token e os dados, e
para cada garantia mostra a regra e o arquivo que a prova. Mostra também a versão
instalada, como conferir o instalador e os testes, e o que o app **não** protege.

A tela não roda teste nenhum e não acessa a rede: ela aponta para a prova pública.
Um link para a Release fica para quando o endereço do repositório público for
fixado (T-21), porque hoje a RN-SEC-21 só deixa ir ao navegador o Azure da
organização.

Toda regra que a tela cita precisa existir aqui e não estar revogada, todo arquivo
de prova precisa existir no repositório, e toda regra da tela precisa estar também
em `docs/seguranca.md`. Assim a tela não promete o que o código não prova.

**Provado por:** `src/renderer/src/features/security/guarantees.test.ts`.

---

## IA do PO

O app **não executa IA nem fala com serviço de IA** ([ADR 0007](../adr/0007-ia-do-po-por-copiar-e-colar.md)).
Ele monta o pedido, o PO o copia para a IA que já usa (Claude, ChatGPT, Copilot ou
qualquer outra), como usuário comum dela, e cola a resposta de volta. A `RN-SEC-18`
continua valendo como está: o main só fala com o Azure. As regras abaixo cercam o
que entra no pedido e o que volta dele.

### RN-SEC-23 · O app não inicia processo

*Reescrita em 2026-11-12 (ADR 0007). Antes: uma porta só para iniciar processos,
para executar o Provedor de IA.*

No app empacotado, **nenhum processo é iniciado**. Nenhum arquivo de `src/` importa
`child_process`, `execa` ou módulo equivalente, nem usa o `utilityProcess` do
Electron.

**Exceção documentada:** `src/main/dev/snapshot.ts` roda `git` para a captura de
referência dos dashboards, só em desenvolvimento: quem o chama verifica
`app.isPackaged` antes.

**Provado por:** `tests/security/rn-sec-23-fronteira-de-processo.test.ts`, um teste
estático sobre `src/`.

### RN-SEC-24 · Só campos permitidos vão no pedido, redigidos e com prévia

*Reescrita em 2026-11-12 (ADR 0007). O consentimento por Perfil saiu: quem leva o
texto para fora é o próprio PO, ao colar.*

**O que vai.** De cada item marcado: ID, título, estado, nome do Produto,
prioridade e **descrição**. Comentários, pessoas, pontos, anexos e qualquer outro
campo ficam. A cópia é campo a campo; não existe repassar o objeto do Azure.

**A descrição** é o campo que mais carrega informação da organização (regras,
contexto, nomes de cliente), e por isso tem tratamento próprio:

- é buscada no Azure **só para os itens que vão no pedido**, no momento do pedido;
  nenhuma tela carrega esse campo;
- vai **só o texto**: a marcação HTML sai, junto com script, estilo, comentário e
  endereço de link ou de imagem;
- é cortada em 4.000 caracteres por item, e o conjunto em 120.000: com muitos
  itens, cada um recebe uma fatia igual.

**Redação.** Um token colado num work item iria para a IA do PO. Título e descrição
passam pela **mesma redação da `RN-SEC-19`** antes de entrar no pedido: formas de PAT
do Azure, tokens do GitHub, `Basic <base64>`, o valor de `Authorization:` e o PAT que
o cliente do Azure acabou de usar, cru e em base64. A redação vem depois da
conversão do HTML, para um token escrito com entidade não escapar. O trecho sai
como `[REDACTED]`.

**Quem decide.** A janela manda só os IDs dos itens. O main busca título, estado e
descrição de novo, no Azure, e monta o texto. Texto livre vindo da janela não entra.
O código da IA não lê o PAT e não abre conexão.

**Prévia.** Antes de copiar, o PO vê a lista exata e abre cada linha para ler a
descrição que vai junto, já redigida. O texto copiado é montado dos mesmos itens que
a prévia mostra: o que o PO vê é o que ele leva.

**Para onde vai.** Para onde o PO colar, sob os termos daquela IA. A tela avisa: "o
que você colar numa IA vai para a conta dela, sob os termos dela". O app não envia
nada e não tem como garantir o que o fornecedor faz depois.

**Provado por:** `tests/security/rn-sec-24-dado-minimo-para-ia.test.ts`.

### ~~RN-SEC-25~~ · O app executa só a IA que ele localiza

Revogada em 2026-11-12 (ADR 0007): o app deixou de executar o Provedor de IA.

### RN-SEC-26 · A resposta colada é texto, e é rascunho

*Reescrita em 2026-11-12 (ADR 0007). Antes: a resposta do Provedor de IA.*

A instrução pede a resposta em **quatro seções com rótulo fixo** (`RN-PLN-21`). Ao
ler o que o PO colou, o app procura esses rótulos, tolerando o que um chat costuma
acrescentar: preâmbulo, negrito, título, cerca de código, numeração de lista, rótulo
sem acento. Cada seção é limpa sozinha, como texto de uma linha, e as listas são
cortadas (três evidências, seis itens fora do foco). Rótulo repetido não reabre a
seção. O formato do objetivo quem dá é o app, sempre o mesmo.

**Fora do formato,** o texto colado inteiro vira **rascunho livre**, com os mesmos
limites, e a tela diz que ele não veio no formato pedido.

Nos dois casos o resultado é **texto puro, curto e de poucas linhas**: caracteres de
controle saem, e o limite é de 1.500 caracteres e 14 linhas, o mesmo para o que o PO
digita. Do que se cola, só os primeiros 20.000 caracteres são lidos. No resumo, cada
pedaço é escapado em HTML e em Markdown como qualquer título vindo do Azure
(`RN-PLN-19`).

**Nada é gravado sem o PO aceitar.** A leitura da resposta é lógica pura, em
`src/shared/ai.ts`, sem disco; quem grava o objetivo nos Dados de trabalho é a tela,
depois de "Usar este texto". Montar o pedido também não grava nada.

**Provado por:** `tests/security/rn-sec-26-resposta-da-ia.test.ts`.

---

## Repositório

### RN-SEC-28 · Nenhuma credencial entra no repositório

O código é público, e um token commitado fica no histórico mesmo depois de
apagado. A varredura mora em `scripts/scan-secrets.mjs`, com as formas da
`RN-SEC-19` e da `RN-CFG-05`, e roda em três lugares:

- **no hook de `pre-commit`**, nas linhas adicionadas do stage. Depende de cada
  clone rodar `git config core.hooksPath .githooks`;
- **no CI, em todos os arquivos do repositório, em todo PR.** É a barreira que vale
  para quem não roda o hook. Com ocorrência, o CI falha e o PR não entra;
- **no destino da exportação (T-21)**, antes do primeiro push.

Arquivos chamados `pat.bin` e `.env` são barrados pelo nome. A saída diz arquivo,
linha e forma, **nunca o valor**: o log do CI é público.

**Provado por:** `tests/security/rn-sec-28-varredura-de-credenciais.test.ts`, que acha
cada forma num arquivo temporário, não acha nada no repositório e confere que o CI e
o hook chamam o script.

### RN-SEC-32 · Para o GitHub só sai o que já é público

Um repositório público não esquece nada do que um dia recebeu: apagar depois não
basta. Por isso a barreira fica **antes** do push, no hook de `pre-push`
(`scripts/verify-push.mjs`), e recusa o envio se:

1. **o clone guarda alguma história além da pública.** Toda história publicada
   nasce do commit que inaugurou o repositório; um clone com outra raiz não publica
   nada, nem uma branch limpa. O que nunca esteve no disco não tem como ser enviado;
2. **um commit enviado não descende só dessa raiz** — um merge com história alheia;
3. **autor ou committer de commit novo não é um endereço noreply do GitHub;**
4. **um commit novo cria um caminho que não pode ser público**, qualquer que seja o
   conteúdo (dados de Perfil, planos internos, artefatos de build, `.env`);
5. **uma linha adicionada ou a mensagem de um commit tem forma de credencial**
   (`RN-SEC-28`) **ou um termo da lista de termos** — a mesma do `verify:neutral`.

Cada commit novo é olhado, não só o último: um termo que entra num commit e sai no
seguinte continua no histórico. A lista vem de `git config plataforma.denylist` (ou
`PO_NEUTRAL_DENYLIST`) e **é obrigatória**: sem ela o push é recusado. Quem contribui
e não tem a lista abre mão dela explicitamente com `PO_PUSH_SEM_LISTA=1`. A saída diz
commit, arquivo, linha e o número do termo, **nunca o termo**.

**Provado por:** `tests/security/rn-sec-32-publicacao-so-da-historia-publica.test.ts`,
que monta repositórios de verdade com um remoto local e confere cada recusa, o termo
que some no commit seguinte, o escopo dos termos, e que um `git push` real com o hook
é barrado sem o remoto receber nada.

---

## Distribuição

### RN-SEC-13 · O pacote não carrega segredo

O instalador contém apenas o código compilado, o `package.json`, o ícone e os
modelos da pasta `resources/` (o modelo de Configuração, o schema e o `AGENTS.md`
de um Perfil novo). Ficam de fora: código-fonte, arquivos de configuração,
**documentação** e qualquer arquivo de ambiente. **Nenhum PAT e nenhuma
Configuração de alguém vão no pacote**: cada Perfil nasce vazio na máquina de quem
instala.

A lista do `electron-builder.yml` é **por exclusão**, e isso tem uma consequência
que já mordeu uma vez: **pasta nova entra no pacote sozinha**. Ao publicar a
v0.2.0, `docs/`, `CLAUDE.md` e `.githooks/` estavam viajando dentro do instalador —
as regras de negócio, os caminhos de área do Azure e as práticas do time, num
arquivo que qualquer um baixa. Não é credencial, mas é interno, e foi pego pela
auditoria do pacote (`docs/DISTRIBUICAO.md`) antes de publicar.

Mordeu de novo no aceite da mesma versão, em build local: `.claude/` (com worktrees
de agente, cada uma uma cópia do projeto), `tests/`, `scripts/` e uma pasta local de
dados privados entraram no pacote, que quase triplicou de tamanho. **Um salto de
tamanho do instalador é sinal de pasta indevida**, e a auditoria vale também para o
build feito na própria máquina, onde existem pastas que a esteira nunca vê.

Daí a regra prática: **auditar o conteúdo do `app.asar` a cada versão** não é
formalidade. É o único ponto onde esse tipo de vazamento aparece.

**Garantida por:** a auditoria do pacote, em `docs/DISTRIBUICAO.md`. Não há teste
automático.

### RN-SEC-14 · Sem assinatura de código, por ora

O instalador não é assinado, então o Windows exibe o aviso do SmartScreen
("editor desconhecido"). É esperado e aceito nesta fase.

O risco real de segurança do projeto é a integridade do canal
de distribuição, ou seja, garantir que o binário na máquina da pessoa é mesmo o seu.
A assinatura de código e os updates assinados endereçam isso, e ficaram para depois.
Enquanto isso, o hash publicado pela esteira (`RN-SEC-22`) é o que permite conferir
o arquivo.

### ~~RN-SEC-15~~ · Fonte privado, binário público

Revogada em 2026-09-29 ([ADR 0004](../adr/0004-repositorio-publico-novo-gpl.md)):
o código passa a ser público e o instalador sai da esteira pública. Ver `RN-SEC-22`.

### RN-SEC-22 · O instalador público sai da esteira pública, com hash publicado

O instalador distribuído é construído pelo **GitHub Actions** do repositório
público, a partir de uma tag `v*` (`.github/workflows/release.yml`). Não existe
instalador público construído em máquina de ninguém.

- A tag precisa ser igual a `v<version>` do `package.json`; se não for, o build
  para.
- O build roda `npm ci` e `npm run check` antes de `npm run build:win`: instalador
  com portão vermelho não sai.
- O **SHA-256** do instalador vai no corpo da Release e em um arquivo `.sha256` ao
  lado dele.
- O instalador tem **atestado de proveniência** assinado pela esteira
  (`actions/attest-build-provenance`), conferível com
  `gh attestation verify <instalador> --repo <dono>/<repositório>`. O job do atestado
  é separado e não roda código do projeto: só ele tem `id-token: write`.
- O **laudo de segurança** da versão vai anexado: o resultado dos testes de
  `tests/security/` (JUnit), a varredura do Electron (SARIF, `RN-SEC-30`), o SBOM
  CycloneDX das dependências de execução, o `npm audit` dessas dependências e o
  SHA-256 de cada arquivo. O `npm audit` não barra a versão: o aviso fica registrado
  no laudo, para quem publica decidir à vista.
- A Release nasce em **rascunho**. Quem publica é o mantenedor, à mão, depois de
  conferir.

**Permissões mínimas.** O job que instala dependências e constrói só lê o
repositório. O único job com `contents: write` não roda código do projeto: baixa o
instalador pronto e cria o rascunho. As actions são fixadas por **SHA de commit**,
não por tag, porque uma tag pode ser movida para outro código.

**Por quê:** sem assinatura de código (`RN-SEC-14`), quem baixa precisa de outro
jeito de confiar no arquivo. Com o código, o log do build e o hash públicos,
qualquer pessoa confere que o instalador saiu daquele código — e não de uma máquina
que pode ter qualquer coisa. O CI (`.github/workflows/ci.yml`) roda os mesmos
portões em todo PR.

O `dist/` **nunca é versionado** — além de não ser fonte, o instalador tem ~130 MB
e estoura o limite de arquivo do GitHub. O binário circula pela Release, não pelo
histórico do git.

**Garantida por:** a própria esteira, não por teste. O procedimento está em
`docs/DISTRIBUICAO.md`.

**Implementado em:** `.github/workflows/release.yml` · `.github/workflows/ci.yml`
