# A IA do PO por copiar e colar

**Status:** aceita · 2026-11-12 · substitui o [ADR 0006](0006-ia-do-po-como-processo-local.md)

O app **não executa IA nem fala com serviço de IA**. Para o rascunho do objetivo
da sprint (`RN-PLN-21`), ele monta o pedido; o PO o copia para a IA que já usa
(Claude, ChatGPT, Copilot ou qualquer outra), como usuário comum dela, e cola a
resposta de volta. O app trata o texto colado como rascunho.

## Por que muda

O ADR 0006 executava o Claude Code instalado pelo PO, com o login da assinatura
dele. A política de autenticação da Anthropic proíbe que um produto de terceiro use
as credenciais de um plano Free, Pro, Max ou Ultra em nome do usuário. A exceção
cobre o usuário usando o Claude Code não modificado, não um produto que o usa como
motor de uma funcionalidade própria. O app usava o Claude Code como API, e quem
arcava com o risco era a conta do PO.

Copiar e colar resolve isso por construção: quem conversa com a IA é o PO, na
interface dela e sob os termos dela. O app não conhece conta de IA de ninguém.

## O que sai desta decisão

- **O app não inicia processo** (`RN-SEC-23`, reescrita). Saem a porta de processo,
  a localização do executável, a escolha de modelo, o "Testar modelo", o
  cancelamento e o consentimento por Perfil. A exceção continua a da captura de
  referência, só em desenvolvimento.
- **O pedido leva só campos permitidos, redigidos e com prévia** (`RN-SEC-24`,
  reescrita). Os campos e os limites são os mesmos. Entra a redação da `RN-SEC-19`
  sobre título e descrição: um token colado num work item não vai para a IA. A
  janela continua mandando só IDs.
- **A resposta colada é texto, e é rascunho** (`RN-SEC-26`, reescrita). A instrução
  pede quatro seções com rótulo fixo; o app as lê de volta e monta o objetivo
  sempre no mesmo formato. Fora do formato, o texto inteiro vira rascunho livre, com
  os mesmos limites.
- **`RN-SEC-25` revogada:** não há mais executável para localizar.
- **`RN-SEC-28`, nova:** a mesma varredura de credenciais do hook de `pre-commit`
  roda no CI, em todos os arquivos de todo PR. Fecha a proteção de credenciais do
  lado de quem mantém e de quem contribui.

## Alternativas consideradas

- **Manter a execução do Claude Code:** contraria a política de autenticação, e o
  risco recai sobre a conta do PO.
- **Chave de API informada pelo PO:** cobra à parte do plano e põe um segundo
  segredo para o app guardar.
- **Integração por OAuth com um fornecedor:** amarra o app a uma IA e exige
  credencial própria do app, que hoje não tem nenhuma.

## Consequências

- **Funciona com qualquer IA.** O app deixa de depender de um programa de terceiro,
  de versão mínima e de sessão no terminal.
- **Um passo a mais para o PO:** copiar, colar e colar de volta. A prévia continua
  mostrando o que vai, e o texto copiado é o que ela mostra.
- **O dado sai pela mão do PO.** O que ele colar vai para a conta da IA dele, sob os
  termos dela. A tela avisa, e o app não tem como garantir o que o fornecedor faz
  depois.
- **A integração direta volta depois da v1, como servidor MCP:** a IA do PO consulta
  o app, e não o contrário. Nasce em plano próprio.
