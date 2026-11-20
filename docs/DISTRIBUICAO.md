# Distribuição

Como uma versão do aplicativo chega à máquina de quem usa. O caminho inteiro, do PR
à versão publicada, está em [ESTEIRA.md](ESTEIRA.md); aqui está o detalhe do que sai.

O instalador público é construído pelo **GitHub Actions** do repositório, quando a
`version` do `package.json` chega à `main` sem Release publicada. Não existe
instalador público construído na máquina de ninguém: o código, o log do build e o
SHA-256 são públicos, e qualquer pessoa confere de qual código saiu o arquivo. Ver
`RN-SEC-22` e o [ADR 0009](adr/0009-publicacao-pela-esteira-com-aprovacao.md).

```
version nova na main ─► build (só leitura) ─► atestado ─► rascunho ─► aprovação ─► publicar ─► conferir
                        check · instalador     id-token    escrita     mantenedor    escrita     hash, atestado,
                        auditoria · laudo                  sem código                sem código  releases/latest
```

---

## Publicar uma versão

### 1. Numerar, no PR da mudança

Subir a `version` no `package.json` (e no `package-lock.json`, com `npm install`)
**no mesmo PR** da mudança. O check `pronto` confere que ela é maior que a anterior
e que o lock acompanha. Subir a versão é decidir publicar: o PR que não muda a
`version` integra sem gerar versão nova.

No mesmo PR, escreva as **novidades** da versão no topo de
`src/shared/release-notes.json`, para quem usa o app (`RN-HOM-04`). É o que a Home
mostra e o que vira a seção "Novidades" da Release. Sem a entrada, o `npm run test`
barra.

O número entra no nome do instalador, `plataforma-po-desktop-<versão>-setup.exe`, e
o app monta o link do download com ele (`RN-GLB-18`). A esteira recusa outro nome.

### 2. Testar o instalador do PR

O CI de todo PR monta o instalador e o anexa ao run do `check`, em **Artifacts**, por
7 dias. É o mesmo código que vai ser publicado. Instale e teste antes do merge.

### 3. A esteira, depois do merge

O push na `main` dispara `.github/workflows/release.yml`:

1. **`versao`** decide se há o que publicar: a versão do `package.json` sem Release
   publicada.
2. **`build`**, só leitura: varredura de credenciais, `npm ci`, `npm run check`,
   `npm run build:win`, a auditoria do pacote, o laudo de segurança e o SHA-256.
   Portão vermelho, nada sai.
3. **`attest`**, o único com `id-token: write`: o atestado de proveniência.
4. **`rascunho`**, com escrita e sem rodar código do projeto: confere que o ambiente
   `producao` exige aprovação, e cria a Release em rascunho com o instalador, o
   `.sha256`, o laudo e as novidades (de `src/shared/release-notes.json`, com os PRs
   desde a última versão publicada recolhidos em "Mudanças técnicas").
5. **`publicar`**, no ambiente `producao`: espera a sua aprovação.
6. **`conferir`**: baixa o instalador da Release publicada, confere o hash e o
   atestado, e confere que `releases/latest` devolve a versão nova.

### 4. Aprovar

O GitHub avisa que há um deploy esperando revisão (e-mail e app do celular). No run:

- a lista do `rascunho` mostra o que já passou;
- o link do ambiente abre o rascunho: leia o `npm-audit.json`, porque aviso nele não
  barra a versão e quem decide é você;
- **Review deployments → producao → Approve and deploy**.

Aprovar é o que avisa quem usa: todo app que abrir com versão mais antiga mostra a
faixa de versão nova (`RN-GLB-18`). O app lê `releases/latest`, por isso a esteira
publica como a mais recente e não como pré-lançamento.

Recusar deixa o rascunho para conferir. Para tentar de novo, rode **Release** pela
aba Actions (**Run workflow**): o rascunho anterior desta versão é refeito.

### 5. Instalar e abrir

O único passo que a esteira não faz. Instalar a versão publicada e abrir. **O app
tem de abrir sem nenhum Perfil**, pedindo para criar um. Se abrisse já com
organização, Configuração ou token, o instalador estaria carregando dado de alguém.

Para conferir à mão o que a esteira conferiu:

```powershell
(Get-FileHash .\plataforma-po-desktop-<versão>-setup.exe -Algorithm SHA256).Hash.ToLower()
```

```powershell
gh attestation verify .\plataforma-po-desktop-<versão>-setup.exe --repo <dono>/<repositório>
```

E para auditar o pacote de uma instalação ou de um build local (`RN-SEC-13`):

```powershell
node scripts/audit-package.mjs "<pasta de instalação>\resources"
```

### Versão com problema

Ver [ESTEIRA.md](ESTEIRA.md), "Versão saiu com problema": recolher com o workflow
**Recolher versão** e corrigir com uma versão maior.

---

## O que o instalador contém

Código compilado, `package.json`, `LICENSE`, as dependências de execução, o ícone e
os modelos de um Perfil novo (`resources/profile-template/`). Ficam de fora: fonte,
testes, documentação, arquivos de configuração e qualquer arquivo de ambiente
(`RN-SEC-13`). A auditoria do pacote recusa o que não estiver nessa lista, no CI de
todo PR e na esteira de Release.

**Não há credencial nenhuma no pacote.** O app não fala com servidor do autor, e o
PAT é de cada pessoa: cadastrado na primeira execução, cifrado pelo sistema
operacional e guardado fora da pasta do Perfil (`RN-SEC-09`, `RN-CFG-06`).

## Limitações conhecidas

- **Sem assinatura de código.** O Windows exibe o aviso do SmartScreen ("editor
  desconhecido"). Esperado nesta fase (`RN-SEC-14`); o SHA-256 da Release é o que
  permite conferir o arquivo.
- **Sem auto-update.** O app avisa da versão nova e abre o download no navegador,
  mas quem instala é a pessoa (ADR 0008). Não há bloco `publish` no
  `electron-builder.yml`, e a esteira passa `--publish never`.
- **Só Windows** é publicado hoje, embora o `electron-builder.yml` tenha alvos
  para macOS e Linux.
- **`dist/` nunca é versionado.** O instalador tem ~130 MB e estoura o limite de
  arquivo do GitHub; ele circula só pela Release.
