# Esteira

O caminho de uma mudança, do pedido até a versão publicada no GitHub. Cada etapa
diz quem faz e o que prova. O que é só da versão (o instalador, o laudo, a
conferência) está em detalhe em [DISTRIBUICAO.md](DISTRIBUICAO.md).

```
pedido ─► refinamento ─► código ─► PR ─► checks ─► teste do instalador ─► merge
                                                                           │
        conferir ◄─ publicar ◄─ SUA APROVAÇÃO ◄─ rascunho ◄─ build ◄──────┘ (se a versão subiu)
```

Só duas coisas são suas: **testar o instalador do PR** e **aprovar a publicação**.
O resto é da esteira, e cada etapa deixa marcado o que já passou.

---

## 1. Do pedido ao PR

| Etapa | Quem | O que acontece |
|---|---|---|
| Refinamento | você e o Claude | O que muda para quem usa, as regras (`RN-...`) que nascem ou mudam |
| Código | Claude | Numa branch a partir da `main`, no clone público. Código, regra em `docs/regras-de-negocio/`, Cenário, `HelpTip` se o cálculo contraria a intuição |
| Portões locais | Claude | `npm run check`. No commit, a varredura de credenciais (`pre-commit`); no push, a verificação de publicação (`pre-push`, `RN-SEC-32`) e a guarda do Claude |
| PR | Claude | Com o template preenchido. **Subir a `version` no mesmo PR é decidir publicar** |

## 2. Checks do PR

Aparecem na lista de checks do PR. Os obrigatórios barram o merge.

| Check | O que prova |
|---|---|
| `check` | Varredura de credenciais, `npm run check` (tipos, lint, testes, regressão das telas, segurança, design system, Electron, build), instalador montado e auditado (`RN-SEC-13`) |
| `pronto` | A definição de pronto que compilar não prova: regra, aprovado, Cenário, prova do teste de segurança, versão. Comenta uma tabela fixa no PR |
| `analyze` (CodeQL) | Análise estática de segurança do TypeScript |

**A lista de termos protegidos não vai para o CI, de propósito.** Ela é conferida só
na máquina de quem publica: no `pre-push` (`RN-SEC-32`) e na guarda do Claude. Levá-la
ao GitHub como secret foi considerado e recusado. A lista é o resumo exato do que não
pode vazar, e o ganho seria pequeno: quando o CI roda, o PR já está público, então
ele só avisaria depois. A prevenção é o `pre-push`, antes de qualquer coisa sair da
máquina.

## 3. Teste e merge

1. **Baixe o instalador do PR:** no run do `check`, em **Artifacts**, o
   `instalador-pr-<número>` (fica 7 dias). Instale e teste.
2. **Aprove do seu jeito:** ligue o auto-merge no PR (**Enable auto-merge**). Ele
   integra quando os checks obrigatórios passam, por squash, e apaga a branch.

PRs do Dependabot de ferramentas e de actions integram sozinhos; os do que vai
dentro do instalador esperam você (`.github/dependabot.yml`).

## 4. Da main à versão publicada

Só acontece quando a `version` do `package.json` chegou à `main` sem Release
publicada. `.github/workflows/release.yml`:

| Etapa | Quem | O que acontece |
|---|---|---|
| versão | esteira | Decide se há o que publicar |
| build | esteira | Varredura de credenciais, `npm run check`, instalador, auditoria do pacote, laudo de segurança, SHA-256 |
| atestado | esteira | Atestado de proveniência assinado |
| rascunho | esteira | Confere que o ambiente `producao` exige aprovação. Cria a Release em rascunho, com as novidades (PRs desde a última versão) e a lista do que já passou |
| **aprovação** | **você** | O GitHub avisa (e-mail, app do celular). Abra o run, leia a lista e o `npm-audit.json` do rascunho, e aprove em **Review deployments** |
| publicar | esteira | Publica como a mais recente; a tag `v<versão>` nasce aqui |
| conferir | esteira | Baixa da Release, confere hash, atestado e `releases/latest` |

Depois disso, todo app instalado mostra o aviso da versão nova (`RN-GLB-18`). Falta
só o que nenhuma esteira faz: instalar e abrir. **O app tem de abrir sem nenhum
Perfil.**

Recusar a aprovação deixa o rascunho para conferir. Para tentar de novo, rode o
workflow **Release** pela aba Actions (**Run workflow**): ele refaz o rascunho.

---

## Versão saiu com problema

1. **Pare o estrago:** aba Actions → **Recolher versão** → **Run workflow**, com a
   versão (`1.3.0`). Com a sua aprovação, ela vira pré-lançamento e a anterior volta
   a ser a mais recente. Quem ainda não atualizou para de ver o aviso dela.
2. **Corrija para a frente:** reverta o PR problemático na `main` (`git revert`) e
   suba a versão (`1.3.1`), num PR. A esteira publica com a sua aprovação, e o aviso
   de versão nova leva todo mundo para ela.

O número da versão nunca volta. Quem instalou a versão ruim sai dela instalando a
correção por cima.

---

## Configuração que a esteira pressupõe

Feita uma vez, em **Settings** do repositório. Se faltar, a esteira para em vez de
seguir sem a barreira.

| Onde | O quê |
|---|---|
| General → Pull Requests | Só **squash**; **Allow auto-merge**; **Automatically delete head branches**; **Always suggest updating pull request branches** |
| Branches → regra da `main` | Checks obrigatórios `check` e `pronto`, atualizados com a `main`; sem force push; vale para admin |
| Rules → Rulesets | `versoes`, alvo `v*`: **Restrict updates**, **Restrict deletions**, **Block force pushes** |
| Environments | `producao`: **Required reviewers** com o mantenedor; **Deployment branches** só `main` |
| Actions → General | Aprovação para todo contribuidor externo; actions fixadas por SHA |
