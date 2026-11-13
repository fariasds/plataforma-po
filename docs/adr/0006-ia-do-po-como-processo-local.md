# A IA do PO como processo local, sem chave de API

**Status:** substituído pelo [ADR 0007](0007-ia-do-po-por-copiar-e-colar.md) em 2026-11-12 · aceita em 2026-10-11

> O texto abaixo é o da decisão original, mantido como registro. O app não executa
> mais o Provedor de IA.

As funcionalidades de IA do app usam a IA que o PO **já assina**. O app não tem
chave de API, não conhece o login do PO e não fala com nenhum serviço de IA: ele
executa o **Provedor de IA** instalado na máquina (hoje, o Claude Code), entrega um
pedido pela entrada padrão e recebe texto de volta. Quem fala com a rede, quem
guarda a sessão e quem responde pelos termos de uso é o Provedor. O consumo sai do
plano do PO.

A primeira funcionalidade é o rascunho do objetivo da sprint (`RN-PLN-21`).

Restrições que saem desta decisão, cada uma garantida por teste:

- **Uma porta só para iniciar processos** (`RN-SEC-23`). Sem shell, com ambiente
  montado por lista de permissão e pasta de trabalho temporária e vazia. É o
  equivalente, para processos, do `fetch` único da `RN-SEC-18`, que continua valendo:
  o main segue sem abrir conexão com ninguém além do Azure.
- **Só campos permitidos saem, com prévia e consentimento** (`RN-SEC-24`). A
  descrição dos itens entrou na lista em 2026-10-11, em texto e com limite de
  tamanho. O consentimento é por Perfil, nasce desligado e mora fora da
  Configuração, que é compartilhável.
- **O app executa só o que ele mesmo localiza** (`RN-SEC-25`). Caminho de executável
  não vem da Configuração nem da janela. A IA roda sem ferramentas e sem as
  personalizações do PO.
- **O que volta é texto, e é rascunho** (`RN-SEC-26`). A IA preenche campos; o
  formato quem dá é o app. Nada é gravado sem o PO aceitar.

Um Provedor por vez. O PO escolhe o modelo por apelido (`haiku`, `sonnet`, `opus`),
que o Provedor resolve para a versão mais nova; o Claude Code não oferece listagem
dos modelos da conta fora do modo interativo, então a tela tem um teste que mostra
qual modelo respondeu.

## Alternativas consideradas

- **Chave de API informada pelo PO:** cobra à parte do plano, que é o que se quer
  evitar, e poria um segundo segredo para o app guardar.
- **Reaproveitar o login do site (token ou cookie da sessão):** viola os termos dos
  fornecedores, arrisca a conta do PO e quebra a cada mudança do site.
- **Servidor MCP exposto pelo app:** resolve "conversar com os dados", mas a conversa
  começa na IA, não no app; não entrega um botão dentro da tela. Fica como caminho
  para funcionalidades futuras.
- **Dar à IA leitura de uma pasta de regras de negócio do Produto:** testado em
  2026-10-11 com o modo restrito do Claude Code, que confinou a leitura à pasta
  indicada. Adiado por custo e tempo: a chamada vira várias leituras. Se voltar,
  desfaz o "sem ferramentas" da `RN-SEC-25` e pede regra e teste próprios.
- **Modelo local:** sem conta e sem saída de dado, mas com instalação pesada e
  qualidade menor para um PO que já paga por um modelo melhor.

## Consequências

- **Dado do Azure passa a sair da máquina**, por escolha explícita do PO e só os
  campos da `RN-SEC-24`. É uma saída deliberada, e vai para a conta **pessoal** de IA
  do PO, sob os termos de consumidor dela. O app diz isso na tela.
- **A funcionalidade depende de um programa de terceiro.** Exige versão mínima
  (`2.1.296`, a única testada com `--safe-mode`) e sessão ativa **no terminal**, que
  é separada da do aplicativo de desktop do Claude. A documentação do Claude Code
  avisa que o modo sem login da assinatura (`--bare`) vai virar o padrão das chamadas
  não interativas; se isso acontecer, a funcionalidade deixa de funcionar e a tela
  precisa dizer por quê.
- **Termos de uso.** A página de termos do Claude Code permite que um produto
  execute o programa sem modificação, com a credencial do próprio usuário, e proíbe
  usar o nome como nome de funcionalidade. Por isso o botão diz "IA" e "Claude Code"
  aparece só como nome do Provedor. É a leitura feita em 2026-10-11, não um parecer;
  a confirmação com a Anthropic está pendente (P-01 do plano).
- **Segundo Provedor** (Codex) entra como outro valor de `AiProviderId`, atrás da
  mesma porta de processo, depois de resolvido se o sandbox dele impede leitura de
  arquivos da máquina.
