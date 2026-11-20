# Como contribuir

Obrigado pelo interesse. Este documento é em português porque o projeto é mantido
em português; **issues e PRs em inglês são bem-vindos**.

Antes de mexer em código, leia o [CLAUDE.md](CLAUDE.md) (convenções e armadilhas,
vale para humanos também) e o [CONTEXT.md](CONTEXT.md) (o vocabulário: **Perfil**,
**Configuração**, **Produto**, **Grupo de produtos**, **Sprint unificada**,
**Perfil de processo**, **Dados de trabalho**). Use esses termos com esse sentido,
no código e na conversa.

Falhas de segurança **não** entram por issue: veja [SECURITY.md](SECURITY.md).

## Definição de pronto

Uma mudança só está pronta quando as três coisas existem:

1. **O código funciona:** `npm run check` passa.
2. **A regra de negócio está escrita** em `docs/regras-de-negocio/`, com ID próprio,
   no arquivo da área correspondente.
3. **Se o cálculo contraria a intuição**, existe um `<HelpTip rule="RN-..." />` na
   tela, com o resumo em `src/renderer/src/help/rules.ts`.

O critério do item 3 é: o nome do indicador já explica o número? Então não precisa
de ajuda.

## A convenção RN

Toda regra tem um ID `RN-<ÁREA>-<NN>` (por exemplo `RN-ENT-01`, `RN-SEC-18`). O ID
liga três lugares: a documentação, o texto de ajuda na tela e o código ou teste que
a implementa. **Mudou a regra, mexe nos três.**

- Regra nova ganha o próximo número da área.
- Regra que mudou é atualizada, não duplicada.
- Regra que morreu é marcada como revogada. **O ID nunca é reciclado.**

As áreas e o formato estão em
[docs/regras-de-negocio/README.md](docs/regras-de-negocio/README.md).

## Portões

| Comando | O que prova |
|---|---|
| `npm run typecheck` · `npm run lint` | Compila e segue o padrão |
| `npm run test` | Lógica pura e serviços do processo principal, contra fixtures fictícias do Azure |
| `npm run verify:security` | Os testes de `tests/security/`, um arquivo por regra (`rn-sec-18-...`, `rn-cfg-05-...`) |
| `npm run verify:neutral` | Informa ocorrências de termos de uma lista privada. Sem a lista, não há o que contar |
| `npm run check` | Todos acima, mais o build |

O CI roda `npm run check` em todo PR, no Windows. O `npm run test` inclui a
conferência de que toda regra citada no código existe e não está revogada.

Além dele, o check **pronto** (`scripts/verify-pronto.mjs`) confere a parte da
definição de pronto que compilar e testar não provam, e comenta o resultado no PR:

| Etapa | Quando se aplica | O que exige |
|---|---|---|
| Regra de negócio | O código do app (`src/`, fora testes e Cenários) mudou | Uma regra de `docs/regras-de-negocio/` mudou junto, ou a caixa "Sem mudança de regra de negócio" |
| Resultado aprovado | Um arquivo de `tests/regression/aprovados/` mudou | O PR ou um commit cita uma regra que mudou junto |
| Cenário | Telas ou os serviços que as alimentam mudaram | Um Cenário ou aprovado mudou, ou a caixa "Sem mudança no que as telas mostram" |
| Prova do teste de segurança | Um teste novo em `tests/security/` | A caixa "O teste de segurança novo falhou com a barreira desligada" |
| Versão | A `version` do `package.json` mudou | Maior que a anterior, e o `package-lock.json` alinhado |
| Termos protegidos | PR do próprio repositório (fork e Dependabot não recebem a lista) | Nenhum termo da lista do mantenedor nas linhas novas, no texto do PR nem nas mensagens de commit |

As caixas estão no template do PR. Marcá-las é uma afirmação sua para quem revisa.

### Testes de segurança

Uma barreira nova de segurança vem com um teste em `tests/security/`, com o ID da
regra no nome do arquivo. **O teste só vale se já falhou:** desligue a barreira,
mostre o teste falhando, restaure. Conte isso no PR.

## Sem mocks na interface, fixtures fictícias nos testes

- **Na interface, nunca há dado inventado.** Se a API não retorna nada, a tela
  mostra estado vazio explicando o que falta. Nada de valor de exemplo para "a tela
  não ficar feia".
- **Nos testes, tudo é fictício.** Organização `contoso`, produtos como "Loja
  Online" e "App Mobile", respostas do Azure em `tests/fixtures/azure/`. Nenhum dado
  real de organização, pessoa ou produto entra no repositório.
- **Nunca use um PAT real em teste, fixture, issue ou PR** — nem um já revogado. O
  hook de `pre-commit` barra o que tem forma de token; ative-o uma vez por clone:

  ```bash
  git config core.hooksPath .githooks
  ```

  O mesmo comando liga o hook de `pre-push` (`RN-SEC-32`), que confere autor
  noreply, credenciais e caminhos de cada commit antes de enviar. Ele também exige a
  lista de termos do mantenedor; quem contribui não tem a lista e abre mão dela
  explicitamente no push:

  ```bash
  PO_PUSH_SEM_LISTA=1 git push
  ```

## Cenários e resultados aprovados

Um **Cenário** é uma Configuração fictícia com o estado de um Azure fictício e uma
data de referência. `npm run test:regression` abre toda tela em todo Cenário e
compara com o resultado aprovado em `tests/regression/aprovados/<cenario>/<tela>.json`.
O catálogo, com o que cada um prova, está em [docs/cenarios.md](docs/cenarios.md).

- **Corrigindo um bug:** primeiro reproduza-o num Cenário (novo ou um caso a mais
  num existente) e veja a regressão acusar. Depois corrija.
- **Funcionalidade nova numa tela:** ela entra num Cenário, novo ou existente.
- **Um aprovado mudou?** Só vale se a regra mudou junto. O commit cita o `RN-...`
  que justifica, e a regra está atualizada em `docs/regras-de-negocio/`. Sem regra
  que mudou, é regressão: corrija o código, não o aprovado.
- **Atualizar os aprovados** é `npm run test:regression -- -u`, e o diff vai para o
  PR para ser revisado linha a linha. Nunca rode para fazer o teste passar.

Para criar um Cenário:

1. Escreva o módulo em `src/main/demo/scenarios/`, com `id` em kebab-case, o
   parágrafo `prova`, as `regras` e as `telas` em foco. Use as peças de
   `src/main/demo/builders.ts`: o histórico do item define o estado atual, as
   datas de mudança e de fechamento.
2. Registre-o em `src/main/demo/scenarios/index.ts` e acrescente a linha em
   `docs/cenarios.md`, na mesma ordem. Um teste confere as duas listas.
3. Rode `npm run test:regression -- -u`, leia cada arquivo novo em
   `tests/regression/aprovados/<cenario>/` e confira os números à mão antes de
   commitar.

Tudo fictício: organização `contoso`, pessoas e Produtos inventados. Se um serviço
passar a pedir uma rota ou uma forma de WIQL que o Azure fictício não conhece, o
teste falha com a rota no erro; ensine o Azure fictício em
`src/main/demo/fake-azure.ts` ou `src/main/demo/wiql.ts`, sem responder vazio por
padrão.

## Fluxo de PR

1. Abra uma issue antes de uma mudança grande, para combinar o caminho.
2. Crie uma branch a partir da `main`.
3. Commits pequenos, com mensagem que diga **por que**.
4. Rode `npm run check` localmente.
5. Preencha o template do PR:
   - o que muda para quem usa;
   - as regras criadas ou alteradas (IDs);
   - para barreira de segurança nova, a prova de falha;
   - para mudança visual, um print.
6. Os checks `check` e **pronto** precisam estar verdes. A revisão olha a definição
   de pronto acima.

Ao contribuir, você concorda que a sua contribuição é licenciada sob a
[GPL-3.0](LICENSE), a mesma do projeto.
