# Plataforma do PO — aplicativo desktop

Dashboard gerencial para Product Owners que trabalham com **Azure DevOps** (API
REST). Cada PO instala na própria máquina e parametriza a ferramenta para os seus
produtos e o processo do seu time. Não há servidor, conta nem login.

O vocabulário do domínio está em [CONTEXT.md](CONTEXT.md). Use **Perfil**,
**Configuração**, **Dados de trabalho**, **Produto**, **Grupo de produtos**,
**Sprint unificada** e **Perfil de processo** exatamente com esse sentido, no
código e na conversa.

---

## Stack

- **Electron + electron-vite** — processo principal (main) e janela (renderer), ambos TypeScript
- **React 19 + React Router** (`createHashRouter`)
- **Ant Design v6** como design system — `@ant-design/plots` para gráficos, `@ant-design/icons` para ícones
- **TanStack Query** sobre IPC
- **Zod** para o schema da Configuração
- **Vitest** para testes
- **electron-builder** (NSIS) para empacotar; o instalador público sai do GitHub Actions

Não há Next.js, Tailwind, shadcn/ui nem Recharts neste projeto.

## Arquitetura

**O "backend" é o processo principal.** Não existe servidor embutido.

- `src/main/` — busca no Azure, cálculos pesados, guarda o PAT, lê e observa a
  Configuração. Handlers expostos por IPC.
- `src/renderer/` — interface. Recebe resultado pronto, nunca dado bruto do Azure.
- `src/shared/` — contrato entre os dois: tipos, canais de IPC, schema da
  Configuração, lógica pura (calendário, horas úteis, story points).
- `src/preload/` — ponte tipada. Nunca expõe `ipcRenderer` cru.
- `tests/security/` — as barreiras de segurança, uma regra por arquivo.

### Perfil, Configuração e Dados de trabalho

Cada instalação tem um **Perfil** local: organização, PAT e Configuração. A proteção
dele é a da conta do sistema operacional ([ADR 0002](docs/adr/0002-sem-autenticacao-perfil-local-por-maquina.md)).

```
<userData>/
  perfis.json                  lista de Perfis e o ativo
  perfis/<id>/                 pasta que o app mostra; a IA do PO pode ler tudo aqui
    configuracao.json          a Configuração (schema em configuracao.schema.json)
    AGENTS.md                  instruções para a IA do PO
    dados/*.json               Dados de trabalho
  segredos/<id>.bin            PAT cifrado, FORA da pasta do Perfil (RN-CFG-06)
```

- A **Configuração** é um JSON que humanos e a IA editam. O app observa o arquivo,
  valida e, se a validação falhar, mantém a última versão válida (`RN-CFG-07`).
  Schema em `src/shared/config/schema.ts`; regras em
  `docs/regras-de-negocio/03-configuracao.md`.
- Os **Dados de trabalho** (itens manuais do Planning, capacidade etc.) nascem do
  uso, são indexados pelo **ID** do Produto (`RN-CFG-08`) e não fazem parte da
  Configuração. Por isso ID de Produto e de Grupo é **imutável** (`RN-CFG-02`).

### Regras de ouro

1. **O PAT nunca chega ao renderer.** Ele entra uma vez pela tela do Perfil e a
   partir daí só o main o lê. Não existe operação de leitura do token no contrato
   de IPC — e não deve passar a existir (`RN-SEC-10`).
2. **O PAT nunca entra na Configuração** — o arquivo existe para ser lido pela IA e
   compartilhado (`RN-CFG-05`, [ADR 0003](docs/adr/0003-configuracao-em-arquivo-editavel-por-ia-sem-pat.md)).
3. **A Configuração guarda o nome da organização, nunca uma URL.** O host é sempre
   `dev.azure.com/<org>`; uma URL importada mandaria o PAT para outro servidor
   (`RN-CFG-04`).
4. **O main só fala com o Azure, e só lê.** Um único `fetch`, atrás de
   `assertAllowedAzureUrl`; o único `POST` é o WIQL (`RN-SEC-18`, `RN-SEC-20`).
5. **Nada fixo no código para uma organização.** Produto, área, tipo, estado,
   campo customizado, feriado e cor de destaque vêm da Configuração.
6. **O app não executa IA nem fala com serviço de IA.** Monta o pedido, o PO leva à
   IA dele e traz a resposta de volta como rascunho. Nenhum arquivo de `src/` inicia
   processo; o pedido leva só campos permitidos, redigidos e com prévia
   (`RN-SEC-23`, `24`, `26`, [ADR 0007](docs/adr/0007-ia-do-po-por-copiar-e-colar.md)).

### Contrato de IPC

`src/shared/ipc.ts` é a fonte única. Escreve-se **apenas** a interface `IpcApi`; o
resto deriva por tipo. Adicionar uma capacidade é: método na interface → canal no
mapa → handler no main → binding no preload → método em `renderer/src/ipc/client.ts`.

Handlers **nunca rejeitam** — resolvem com `{ ok, data | error }`. O Electron mastiga
erros lançados e perde mensagem e código. Quem desembrulha é o renderer, porque
classes de erro não sobrevivem ao `contextBridge`. A mensagem de erro passa pela
redação do PAT antes de sair (`RN-SEC-19`).

---

## Definição de pronto

Uma feature só está pronta quando as três coisas existem:

1. **O código funciona** — `npm run check` passa.
2. **A regra de negócio está escrita** em `docs/regras-de-negocio/`, com ID próprio
   (`RN-<ÁREA>-<NN>`), no arquivo da área correspondente. Se a regra mudou, atualize
   a existente em vez de criar outra; se morreu, marque como revogada — **ID nunca é
   reciclado**.
3. **Se o cálculo contraria a intuição**, existe um `<HelpTip rule="RN-..." />` na
   tela, com o resumo em `src/renderer/src/help/rules.ts`.

E a regressão das telas (`docs/cenarios.md`) segura o que já funciona:

- **Correção de bug começa por um Cenário que reproduz o bug** — novo, ou um caso a
  mais num existente — que falha antes da correção e passa depois.
- **Resultado aprovado só muda junto com a regra.** Se um arquivo de
  `tests/regression/aprovados/` mudou, o commit cita a regra (`RN-...`) que justifica,
  e a regra foi atualizada na documentação na mesma tarefa. Aprovado que mudou sem
  regra que mudou é regressão: **corrija o código, não o aprovado.** Nunca rode
  `npm run test:regression -- -u` para fazer o teste passar.
- **Funcionalidade nova numa tela entra num Cenário**, novo ou existente.

O critério do item 3 é: o nome do indicador já explica o número? Então não precisa de
ajuda. Ícone que aparece em tudo vira mobília e ninguém clica.

O ID liga os três lugares — documentação, texto de ajuda e código do cálculo.
**Mudou a regra, mexe nos três.**

## Portões

| Comando | O que prova |
|---|---|
| `npm run typecheck` · `npm run lint` | Compila e segue o padrão |
| `npm run test` | Lógica pura e serviços do main contra fixtures fictícias do Azure. Inclui a regressão |
| `npm run test:regression` | Toda tela em todo Cenário, comparada com o resultado aprovado (`tests/regression/`) |
| `npm run verify:security` | Os testes de `tests/security/` |
| `npm run verify:design` | Os testes de `tests/design/` — o design system (`DS-*`) |
| `npm run verify:electron` | Electronegativity sobre `src/`: todo apontamento tem aceite com motivo (`RN-SEC-30`) |
| `npm run verify:neutral` | Conta termos de uma lista privada e os marcadores de transição. Só informa |
| `npm run check` | Todos acima, mais o build. É o que o CI roda em todo PR |

**Teste de segurança leva o ID da regra no nome do arquivo**
(`tests/security/rn-sec-18-fronteira-de-rede.test.ts`), e a regra, na
documentação, cita o teste. **Um teste de segurança só vale se já falhou:** desligue
a barreira, veja o teste falhar, restaure.

Testes usam **dados fictícios** (organização `contoso`, produtos como "Loja
Online"). Nunca um PAT real, nunca dado de organização real.

---

## Convenções de interface

O design system está em [docs/design-system.md](docs/design-system.md) — **leia antes
de criar ou mudar uma tela.** O essencial:

- **Cor, raio, sombra, fonte e densidade saem do tema** (`src/renderer/src/theme/index.ts`).
  Cor literal fora do tema é barrada pelo teste `DS-01`; nome de fonte, pelo `DS-02`.
  Se parece precisar de estilo inline com valor novo, quase sempre falta um token.
- **Situação tem cor fixa** (`STATUS`): verde dentro, âmbar projeção, vermelho
  estouro, cinza sem dado. A cor de destaque é do PO (`appearance.accentColor`) e
  marca o que está ativo ou é a ação principal — nunca situação.
- **IDs, horas e datas em `MONO_FONT`.** Indicador é número grande e neutro sobre
  rótulo pequeno; a cor vai na barra ou na etiqueta.
- **Componentes compartilhados antes de criar novo:** `AppLayout`, `AppLogo`,
  `StateTag` (estado de work item), `ProductFilter` (Produto como ponto colorido),
  `HelpTip`, `ErrorState`, `DashboardFilters`.
- **Cores de work item não são identidade do app** — vêm do Azure DevOps e valem só
  dentro de gráficos e tabelas de work item (`RN-GLB-10`).
- **Sem mocks.** Se a API não retorna dados, mostre estado vazio. Se falta algo na
  Configuração, o estado vazio diz o que configurar.
- A janela **rola a página inteira**; menu lateral e cabeçalho ficam via `position: sticky`.
  Não reintroduza altura travada com container interno de rolagem.
- **Mudou o visual de mais de uma tela** (token, componente ou padrão novo)? Atualize
  `docs/design-system.md` e, se a regra é verificável, os testes `DS-*`, na mesma tarefa.

## Convenções de código

- **Comunicação em Português do Brasil.** Código (variáveis, funções, arquivos) em
  inglês; as chaves da Configuração também, com as descrições do schema em PT-BR.
- Comentário explica **por que**, não o que. Regra de negócio detalhada mora na documentação.
- Não reescreva arquivo inteiro sem necessidade.
- **Campo customizado do Azure só entra pela Configuração** (`customFields`),
  nunca escrito no código. Sem o campo configurado, o indicador que depende dele
  mostra estado vazio explicando o que configurar.

---

## Armadilhas conhecidas

- **Ant Design v6 depreciou APIs da v5.** Já foram corrigidas `Space direction` →
  `orientation`, `Statistic valueStyle` → `styles.content` e `dropdownRender` →
  `popupRender`. Ao usar uma prop nova, confira nos tipos do pacote.
- **O log do renderer é encaminhado ao processo principal.** Avisos e erros da janela
  aparecem no terminal do `npm run dev` — é o melhor sinal de depreciação e de erro
  em app empacotado, onde não há DevTools aberto. Vale olhar.
- **Entrega não se mede por `IterationPath`** — ver `RN-ENT-01`. É a regra que mais
  confunde quem vem do Azure.
- **Uma instância só, porque duas disputariam os arquivos do Perfil** — a última a
  gravar apagaria o que a outra escreveu. A segunda instância sai e traz a primeira
  para a frente. Com uma janela aberta, `npm run dev` sobe o Vite, o Electron
  encerra com sucesso e a **janela antiga** vem para a frente — parece que
  recarregou, mas está rodando o código anterior. O terminal avisa; ainda assim,
  feche o app antes de subir de novo.
- **`dist/` nunca entra no versionamento.** O instalador tem ~130 MB e estoura o
  limite de arquivo do GitHub. Ele é construído pela esteira de Release — ver
  `RN-SEC-22` e `docs/DISTRIBUICAO.md`.
- **Pasta nova entra no instalador sozinha.** A lista do `electron-builder.yml` é
  por exclusão (`RN-SEC-13`).
- **Um hook de `pre-commit` barra conteúdo com forma de token** (`.githooks/`). Ele
  depende de `git config core.hooksPath .githooks`, que é por clone: em máquina
  nova, rode antes do primeiro commit ou a barreira não existe.

## Onde ler mais

| Assunto | Onde |
|---|---|
| Vocabulário do domínio | `CONTEXT.md` |
| Regras de negócio | `docs/regras-de-negocio/` |
| Design system (tokens, componentes, padrões de tela) | `docs/design-system.md` |
| Decisões de arquitetura | `docs/adr/` |
| Como publicar uma versão do instalador | `docs/DISTRIBUICAO.md` |
| Como contribuir | `CONTRIBUTING.md` |
| Como relatar falha de segurança | `SECURITY.md` |
