# Segurança

A Plataforma do PO guarda uma única coisa sensível: o **PAT** do Azure DevOps de
quem a usa. Todo o desenho de segurança existe para que esse token fique na máquina
do usuário e só saia dela para ler dados da organização configurada, no Azure
DevOps.

Cada barreira abaixo é uma **regra de negócio com ID** (documentada em
`docs/regras-de-negocio/`) e um **teste automatizado** em `tests/security/`, que
roda em todo PR (`npm run verify:security`). Um teste de segurança só entra no
projeto depois de ter falhado com a barreira desligada.

## Credenciais

**O app não tem credencial própria, não usa conta de IA de ninguém e não manda o
PAT para lugar nenhum além do Azure.**

| Credencial | Onde mora | O que impede o vazamento |
|---|---|---|
| PAT do Azure, de cada PO | Cifrado pelo sistema operacional, fora da pasta do Perfil | RN-SEC-09, 10, 18, 19, 20, RN-CFG-05, 06 |
| Conta de IA (Claude, ChatGPT e outras), de cada PO | Na própria IA; o app nunca a usa | RN-SEC-23 (sem processo), RN-SEC-18 (rede só para o Azure) |
| Token colado no conteúdo do Azure, de terceiros | No work item | RN-SEC-24 (redação antes da prévia e da cópia) |
| Credenciais do mantenedor e de quem contribui | Fora do repositório | RN-SEC-28, RN-SEC-22 |

Em linguagem simples, com o jeito de conferir cada garantia e a autoavaliação
OWASP ASVS: [`docs/seguranca.md`](docs/seguranca.md).

A tabela completa, com cada teste, está em
[`docs/regras-de-negocio/02-acesso-e-seguranca.md`](docs/regras-de-negocio/02-acesso-e-seguranca.md).

## Modelo de ameaça

| Ameaça | Barreira | Regra | Teste |
|---|---|---|---|
| O PAT fica legível no disco | Cifrado com o `safeStorage` do sistema operacional (DPAPI no Windows). Sem cifragem disponível, o app recusa guardar, e nenhum arquivo é criado | RN-SEC-09 | `tests/security/rn-sec-09-cifragem-obrigatoria.test.ts` |
| Código na janela (um XSS, uma dependência comprometida) lê o PAT | O contrato de IPC não tem operação de leitura do token. A janela só sabe se existe um, grava um novo ou apaga o atual | RN-SEC-10 | `tests/security/rn-sec-10-contrato-ipc.test.ts` |
| O PAT chega à janela dentro de um resultado ou de um erro | Nenhum envelope de resposta carrega o token, nem quando o servidor o ecoa | RN-SEC-10 | `tests/security/rn-sec-10-envelopes-sem-pat.test.ts` |
| O PAT vai para outro servidor (URL maliciosa em um work item, bug, dependência) | Um único `fetch` no processo principal, com host exato `dev.azure.com` ou `vssps.dev.azure.com` e a organização configurada. Nenhum outro arquivo abre conexão; a janela tem toda requisição de rede cancelada | RN-SEC-18 | `tests/security/rn-sec-18-fronteira-de-rede.test.ts` |
| O PAT aparece em log ou em mensagem de erro | Redação do token conhecido (cru e em base64) e de qualquer coisa com forma de token | RN-SEC-19 | `tests/security/rn-sec-19-redacao.test.ts` |
| Um PAT com escopo de escrita altera dados no Azure | Só `GET`, e o único `POST` permitido é a consulta WIQL, que é leitura. O resto é recusado antes de sair | RN-SEC-20 | `tests/security/rn-sec-20-somente-leitura.test.ts` |
| Link injetado no título ou na descrição de um work item abre algo perigoso | A janela nunca abre outra janela. Só `https://dev.azure.com/<sua organização>/…` vai para o navegador; `javascript:`, `file:` e outras organizações são negados | RN-SEC-21 | `tests/security/rn-sec-21-links-externos.test.ts` |
| A Configuração aponta a organização para outro host | A organização é um **nome**, validado pelo schema. URL não é aceita | RN-CFG-04 | `tests/security/rn-cfg-04-organizacao-por-nome.test.ts` |
| O PAT vai parar na Configuração, que é compartilhada e editada por IA | A validação recusa o arquivo inteiro se algum valor tiver forma de token ou alguma chave se chamar `pat`, `token`, `password` ou `secret`, e a mensagem nunca repete o valor | RN-CFG-05 | `tests/security/rn-cfg-05-sem-segredo.test.ts` |
| A IA do usuário, com acesso à pasta do Perfil, lê o PAT | O token cifrado mora **fora** da pasta do Perfil | RN-CFG-06 | `tests/security/rn-cfg-06-segredo-fora-do-perfil.test.ts` |
| O instalador baixado não é o que saiu do código | Build público pelo GitHub Actions a partir de uma tag, com SHA-256 publicado na Release | RN-SEC-22 | `.github/workflows/release.yml` (esteira, não teste) |
| Um programa qualquer é executado em nome do app, ou um dado vira comando | O app não inicia processo: nenhum arquivo de `src/` importa `child_process` ou equivalente, fora de uma ferramenta só de desenvolvimento | RN-SEC-23 | `tests/security/rn-sec-23-fronteira-de-processo.test.ts` |
| Dado da organização ou um token colado num work item vai para a IA | O app não envia nada: monta o pedido e o PO o copia. Só ID, título, estado, Produto, prioridade e descrição (em texto, com limite de tamanho) entram, com credenciais redigidas, depois de uma prévia | RN-SEC-24 | `tests/security/rn-sec-24-dado-minimo-para-ia.test.ts` |
| A resposta colada injeta marcação ou é gravada sem revisão | Texto puro, curto e escapado, lido por rótulos fixos; nada entra no resumo sem o PO aceitar | RN-SEC-26 | `tests/security/rn-sec-26-resposta-da-ia.test.ts` |
| Um token é commitado no repositório | A mesma varredura (`scripts/scan-secrets.mjs`) roda no hook de `pre-commit` e no CI, em todos os arquivos de todo PR. A saída nunca repete o valor | RN-SEC-28 | `tests/security/rn-sec-28-varredura-de-credenciais.test.ts` |
| Código na janela alcança o sistema operacional ou um canal de IPC fora do contrato | A janela roda em sandbox, com isolamento de contexto, sem Node e sem permissões além de escrever na área de transferência. O preload expõe só o objeto `api` | RN-SEC-29 | `tests/security/rn-sec-29-janela-endurecida.test.ts` |
| Uma opção perigosa do Electron entra sem ninguém ver | O Electronegativity (Doyensec) varre `src/` no `npm run check`; apontamento sem aceite com motivo reprova | RN-SEC-30 | `npm run verify:electron` · `tests/security/rn-sec-30-varredura-electron.test.ts` |

## O que o app não protege

- **Malware rodando como o seu usuário do sistema operacional.** A cifragem do
  `safeStorage` é amarrada à sua conta: qualquer programa que rode como você
  consegue pedir ao sistema para decifrar o PAT, ler a memória do app ou alterar os
  arquivos dele. Nenhum app desktop sem hardware dedicado se defende disso. Se a sua
  conta está comprometida, revogue o PAT no Azure DevOps.
- **Quem tem acesso à sua sessão aberta.** Não há login no app: quem usa o seu
  computador desbloqueado vê os mesmos dados que você.
- **O que o PAT permite no Azure fora do app.** O app só lê, mas um PAT com escopo de
  escrita vazado por outro caminho escreve. Crie o PAT só com escopos de leitura
  (veja o [README](README.md#criar-o-pat-só-leitura)) e com validade curta.
- **O que acontece com o dado depois que ele chega à IA.** Se você colar o pedido
  numa IA, os títulos e as descrições dos itens marcados vão para a conta que você
  usa nela, sob os termos e as configurações de privacidade dela. O app mostra o que
  vai no pedido; não controla o que o fornecedor guarda. Confira a política da sua
  organização antes de colar.
- **Assinatura de código.** O instalador não é assinado (RN-SEC-14). A integridade é
  verificável pelo SHA-256 da Release, que só vale se você conferir.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Use o
[GitHub Security Advisories](../../security/advisories/new) deste repositório
("Report a vulnerability"). O relato fica visível só para os mantenedores até a
correção ser publicada.

Inclua, se puder:

- a versão do app e do Windows;
- o que um atacante consegue fazer, e em que condição;
- os passos para reproduzir. **Nunca inclua um PAT real**, nem já revogado.

A resposta inicial vem em até 7 dias. Este é um projeto mantido por uma pessoa, sem
programa de recompensa; o crédito pela descoberta vai no aviso publicado, se você
quiser.
