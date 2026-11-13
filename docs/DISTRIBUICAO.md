# Distribuição

Como uma versão do aplicativo chega à máquina de quem usa.

O instalador público é construído pelo **GitHub Actions** do repositório, a partir
de uma tag `v*`. Não existe instalador público construído na máquina de ninguém: o
código, o log do build e o SHA-256 são públicos, e qualquer pessoa confere de qual
código saiu o arquivo. Ver `RN-SEC-22`.

```
tag v<versão>  ─►  job build (só leitura)                 ─►  job draft-release (escrita)  ─►  mantenedor
                   npm ci · npm run check                     cria a Release em rascunho       confere e publica
                   npm run build:win · SHA-256                com o .exe e o .sha256
```

---

## Publicar uma versão

### 1. Numerar

Subir a `version` no `package.json` e commitar. O número entra no nome do arquivo
gerado, e a esteira recusa tag que não bata com ele.

### 2. Conferir localmente o que vai sair

A esteira roda os mesmos portões, mas é mais barato descobrir antes:

```bash
npm run check
```

Se for mexer em `electron-builder.yml` ou acrescentar pasta na raiz, construa e
audite o pacote localmente (passo 5) antes de criar a tag.

### 3. Criar a tag

```bash
git tag v0.3.0
```

```bash
git push origin v0.3.0
```

A tag dispara `.github/workflows/release.yml`:

1. **`build`**, com permissão só de leitura: confere que a tag é `v<version>` do
   `package.json`, roda `npm ci`, `npm run check` e `npm run build:win`, e calcula
   o SHA-256 do instalador. Portão vermelho, nada sai.
2. **`draft-release`**, o único job com `contents: write`: não roda código do
   projeto. Baixa o instalador pronto e cria a Release **em rascunho**, com o
   `.exe`, um `.sha256` ao lado e o hash no corpo.

### 4. Conferir o rascunho

Na página de Releases, abrir o rascunho e conferir:

- o nome do arquivo tem a versão certa;
- o hash do corpo é igual ao do arquivo `.sha256`;
- o log do job `build` está verde e é desta tag;
- o laudo de segurança está anexado (`verify-security.junit.xml`,
  `electronegativity.sarif`, `sbom.cdx.json`, `npm-audit.json`, `laudo.sha256`), e o
  `npm-audit.json` não traz aviso que impeça publicar;
- o job `attest` está verde.

### 5. Auditar o pacote

Baixar o instalador do rascunho, instalar numa pasta de teste e olhar o que de fato
entrou:

```bash
npx @electron/asar list "<pasta de instalação>/resources/app.asar"
```

Só pode haver `out/`, `package.json`, dependências de execução e os modelos de
`resources/`. Não pode haver `src/`, `docs/`, `tests/`, `scripts/`, `.claude/`,
`CLAUDE.md`, `.env` nem arquivo `.bin`. Instalador muito maior que o da versão
anterior é sinal de pasta indevida. A lista de exclusão do `electron-builder.yml` cobre isso — este
passo é o que confirma que cobriu (`RN-SEC-13`).

### 6. Publicar

Com tudo conferido, publicar o rascunho pela interface do GitHub. É a única etapa
manual, de propósito: quem publica é uma pessoa, depois de olhar.

### 7. Conferir de fora

Baixar o arquivo da Release publicada numa pasta limpa e conferir o hash no
PowerShell:

```powershell
(Get-FileHash .\plataforma-po-desktop-<versão>-setup.exe -Algorithm SHA256).Hash.ToLower()
```

Conferir a proveniência, com o GitHub CLI:

```powershell
gh attestation verify .\plataforma-po-desktop-<versão>-setup.exe --repo <dono>/<repositório>
```

Instalar e abrir. **O app tem de abrir sem nenhum Perfil**, pedindo para criar um.
Se abrisse já com organização, Configuração ou token, o instalador estaria
carregando dado de alguém.

---

## O que o instalador contém

Código compilado, `package.json`, ícone e os modelos de um Perfil novo
(`resources/profile-template/`). Ficam de fora: fonte, testes, documentação,
arquivos de configuração e qualquer arquivo de ambiente (`RN-SEC-13`).

**Não há credencial nenhuma no pacote.** O app não fala com servidor do autor, e o
PAT é de cada pessoa: cadastrado na primeira execução, cifrado pelo sistema
operacional e guardado fora da pasta do Perfil (`RN-SEC-09`, `RN-CFG-06`).

## Limitações conhecidas

- **Sem assinatura de código.** O Windows exibe o aviso do SmartScreen ("editor
  desconhecido"). Esperado nesta fase (`RN-SEC-14`); o SHA-256 da Release é o que
  permite conferir o arquivo.
- **Sem auto-update.** Versão nova significa baixar e instalar de novo. Não há
  bloco `publish` no `electron-builder.yml`, e a esteira passa `--publish never`.
- **Só Windows** é publicado hoje, embora o `electron-builder.yml` tenha alvos
  para macOS e Linux.
- **`dist/` nunca é versionado.** O instalador tem ~130 MB e estoura o limite de
  arquivo do GitHub; ele circula só pela Release.
