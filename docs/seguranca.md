# Segurança da Plataforma do PO

Esta página é para quem **usa** o app e quer saber o que ele faz com o seu token e
com os dados da sua organização. Ela não pede que você confie no autor: cada
promessa aponta para uma regra escrita, para o teste que a prova e para o jeito de
você mesmo conferir.

Para o modelo de ameaça técnico e para relatar uma falha, veja o
[SECURITY.md](../SECURITY.md).

---

## O que o app garante

| Garantia | Regra | Provado por |
|---|---|---|
| **Seu token só sai da sua máquina para o Azure DevOps**, por HTTPS, para a sua organização. Nenhum outro servidor, nem do autor | RN-SEC-18 | `tests/security/rn-sec-18-fronteira-de-rede.test.ts` |
| **Seu token fica cifrado pelo Windows** (DPAPI). Se a cifragem não estiver disponível, o app se recusa a guardar | RN-SEC-09 | `tests/security/rn-sec-09-cifragem-obrigatoria.test.ts` |
| **A tela do app nunca vê o seu token.** Ela só sabe se existe um | RN-SEC-10 | `tests/security/rn-sec-10-contrato-ipc.test.ts` · `rn-sec-10-envelopes-sem-pat.test.ts` |
| **O app só lê o Azure, nunca escreve**, mesmo que o seu token permita | RN-SEC-20 | `tests/security/rn-sec-20-somente-leitura.test.ts` |
| **O token não aparece em log nem em mensagem de erro** | RN-SEC-19 | `tests/security/rn-sec-19-redacao.test.ts` |
| **O token nunca entra no arquivo de Configuração**, que você pode compartilhar e a sua IA pode ler | RN-CFG-05 · RN-CFG-06 | `tests/security/rn-cfg-05-sem-segredo.test.ts` · `rn-cfg-06-segredo-fora-do-perfil.test.ts` |
| **A Configuração guarda o nome da organização, nunca um endereço.** Um arquivo importado não consegue mandar o token para outro servidor | RN-CFG-04 | `tests/security/rn-cfg-04-organizacao-por-nome.test.ts` |
| **Link dentro de um work item não abre nada perigoso.** Só páginas da sua organização no Azure vão para o navegador | RN-SEC-21 | `tests/security/rn-sec-21-links-externos.test.ts` |
| **O app não executa programa nenhum** e não fala com serviço de IA | RN-SEC-23 | `tests/security/rn-sec-23-fronteira-de-processo.test.ts` |
| **Para a sua IA, vai só o que você vê na prévia**: campos permitidos, com credenciais apagadas. Quem cola é você | RN-SEC-24 | `tests/security/rn-sec-24-dado-minimo-para-ia.test.ts` |
| **A resposta da IA entra como rascunho de texto**, nunca como código, e só depois que você aceita | RN-SEC-26 | `tests/security/rn-sec-26-resposta-da-ia.test.ts` |
| **A janela do app roda isolada** (sandbox do Electron, sem acesso ao sistema, sem câmera, microfone ou notificação) | RN-SEC-29 | `tests/security/rn-sec-29-janela-endurecida.test.ts` |
| **A configuração do Electron é varrida por uma ferramenta independente** (Electronegativity, da Doyensec). Todo apontamento tem motivo escrito | RN-SEC-30 | `npm run verify:electron` |
| **O modo de demonstração não usa rede nem token** | RN-SEC-27 | `tests/security/rn-sec-27-perfil-de-demonstracao.test.ts` |
| **Nenhuma credencial entra no código-fonte**: a varredura roda a cada commit e em todo PR | RN-SEC-28 | `tests/security/rn-sec-28-varredura-de-credenciais.test.ts` |
| **O instalador sai da esteira pública do GitHub**, com o SHA-256 publicado. Não existe instalador oficial feito na máquina de ninguém | RN-SEC-22 | `.github/workflows/release.yml` |

O texto completo de cada regra está em
[regras-de-negocio/02-acesso-e-seguranca.md](regras-de-negocio/02-acesso-e-seguranca.md).

### Como os testes são feitos

- **Um teste de segurança só entra depois de ter falhado.** Quem escreve desliga a
  barreira, vê o teste ficar vermelho e restaura. Assim, nenhum teste passa por
  acidente.
- **Os testes usam dados fictícios** (a organização `contoso`). Nunca um token real.
- **Todos rodam em todo PR**, no `npm run check`, e um portão vermelho barra a
  mudança.

---

## Como conferir você mesmo

**O instalador é o que saiu do código.** Baixe o `.exe` e o `.sha256` da página de
Releases e compare no PowerShell:

```powershell
(Get-FileHash .\plataforma-po-desktop-<versão>-setup.exe -Algorithm SHA256).Hash.ToLower()
```

**Os testes passam.** Com Node.js 24, no código-fonte da mesma versão:

```bash
npm ci
```

```bash
npm run verify:security
```

```bash
npm run verify:electron
```

**O que foi rodado na esteira.** Cada Release aponta para o log do job que a
construiu, e ele é público: dá para ver os mesmos testes passando naquele commit.

---

## O que o app não protege

Mostrar o limite faz parte de ser honesto sobre segurança:

- **Malware rodando como o seu usuário do Windows.** A cifragem é amarrada à sua
  conta, e um programa que rode como você consegue pedir ao sistema para decifrar o
  token. Se a sua conta foi comprometida, revogue o token no Azure DevOps.
- **Quem usa o seu computador desbloqueado.** O app não tem login próprio.
- **O que o token permite fora do app.** O app só lê, mas um token com escopo de
  escrita vazado por outro caminho escreve. Crie o token só com escopos de leitura e
  com validade curta.
- **O que a sua IA faz com o que você cola nela.** O app mostra o que vai no pedido,
  mas não controla o que o fornecedor da IA guarda.
- **O instalador não tem assinatura de código** (RN-SEC-14). O Windows mostra o aviso
  "editor desconhecido". A integridade se confere pelo SHA-256.
- **Não há atualização automática.** Versão nova é instalador novo: acompanhe as
  Releases.

### Riscos aceitos, com motivo

A varredura do Electron aponta três itens que ficam, cada um com o motivo em
[`tests/security/electronegativity-aceitos.json`](../tests/security/electronegativity-aceitos.json):

| Apontamento | Por que fica |
|---|---|
| A política de conteúdo permite estilo embutido (`style-src 'unsafe-inline'`) | A biblioteca visual (Ant Design) injeta estilos em tempo de execução. Script continua bloqueado: estilo não executa código, e a janela não acessa a rede |
| Clique do meio pode abrir janela nova | Coberto: o app nega toda janela nova e só manda para o navegador links da sua organização (RN-SEC-21) |
| Revisar o script de preload | Revisado: ele entrega à janela só os métodos do contrato, nunca acesso genérico (RN-SEC-29) |

---

## Autoavaliação OWASP ASVS 5.0

O [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
é o padrão aberto mais usado para verificar a segurança de uma aplicação. Esta é uma
**autoavaliação por capítulo**, feita pelo autor, e não uma auditoria independente.
O ASVS foi escrito pensando em aplicações web com servidor, e este app não tem
servidor, login nem sessão, por isso vários capítulos não se aplicam.

| Capítulo | Situação | Evidência |
|---|---|---|
| V1 · Codificação e sanitização | Atende | Resposta da IA tratada como texto escapado (RN-SEC-26); links filtrados (RN-SEC-21); React escapa a saída por padrão |
| V2 · Validação e lógica de negócio | Atende | Configuração validada por schema Zod, e a última versão válida é mantida (RN-CFG-07); organização só por nome (RN-CFG-04) |
| V3 · Segurança do front-end web | Atende, com risco aceito | CSP com `script-src 'self'`; janela em sandbox, sem rede (RN-SEC-18, RN-SEC-29); `style-src 'unsafe-inline'` aceito com motivo (RN-SEC-30) |
| V4 · API e serviços web | Atende | O app é cliente: só `GET` e uma consulta WIQL (RN-SEC-20); host exato e HTTPS (RN-SEC-18). O contrato de IPC é a única "API" interna e não tem leitura de token (RN-SEC-10) |
| V5 · Manipulação de arquivos | Atende | O app só grava na pasta do Perfil e na pasta de segredos (RN-CFG-06, RN-CFG-08). Não aceita upload nem executa arquivos (RN-SEC-23) |
| V6 · Autenticação | Não se aplica | Sem login: a proteção é a conta do sistema operacional ([ADR 0002](adr/0002-sem-autenticacao-perfil-local-por-maquina.md)). O token é do Azure, validado antes de guardar (RN-SEC-11) |
| V7 · Gerenciamento de sessão | Não se aplica | Não há sessão de usuário |
| V8 · Autorização | Não se aplica | Um usuário por Perfil. O que ele pode ler no Azure é decidido pelo próprio Azure (RN-SEC-16) |
| V9 · Tokens autocontidos | Não se aplica | Não há JWT nem token emitido pelo app |
| V10 · OAuth e OIDC | Não se aplica | Autenticação no Azure por PAT, sem OAuth |
| V11 · Criptografia | Atende | Sem criptografia própria: usa o `safeStorage` do sistema operacional, e recusa guardar sem ele (RN-SEC-09) |
| V12 · Comunicação segura | Atende | Só HTTPS, só para `dev.azure.com` e `vssps.dev.azure.com` (RN-SEC-18) |
| V13 · Configuração | Atende | Nenhum segredo na Configuração nem no pacote (RN-CFG-05, RN-SEC-13); nenhuma credencial no repositório (RN-SEC-28); opções do Electron varridas (RN-SEC-30) |
| V14 · Proteção de dados | Atende | O dado mínimo vai para a IA, com prévia (RN-SEC-24); o token fica fora da pasta que a IA lê (RN-CFG-06) |
| V15 · Código e arquitetura seguros | Atende parcialmente | Fronteiras testadas (RN-SEC-10, 18, 23, 29). **Pendente:** a versão do Electron em uso tem avisos de segurança publicados, e a atualização de versão maior está planejada |
| V16 · Log e tratamento de erro | Atende | Token redigido de todo log e erro (RN-SEC-19); handlers nunca rejeitam e não vazam pilha para a janela |
| V17 · WebRTC | Não se aplica | O app não usa WebRTC |
