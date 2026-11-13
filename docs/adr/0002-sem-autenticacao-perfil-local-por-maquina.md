# Sem autenticação: cada instalação tem um Perfil local

**Status:** aceita · 2026-09-27

A versão interna liberava o acesso por link enviado por e-mail, com uma lista de
e-mails autorizados guardada em um serviço de autenticação e banco de dados de
terceiros. Para que qualquer PO consiga baixar e usar, decidimos retirar
a autenticação por completo. Cada instalação passa a ter um **Perfil** local, e a
proteção dele é a da conta do sistema operacional: o PAT é cifrado com `safeStorage`
(DPAPI no Windows, Keychain no macOS). O app não fala com nenhum servidor do autor.

## Alternativas consideradas

- **Manter o serviço de autenticação e abrir a lista de autorizados.** Rejeitada:
  cada novo usuário dependeria de um servidor e de um projeto do autor, com custo,
  ponto de falha e dados de terceiros (e-mails) sob a guarda dele.
- **Senha ou PIN local para abrir o app.** Rejeitada: só aumentaria a segurança se
  a senha participasse da cifragem do PAT. Contra a ameaça real, que é um processo
  rodando como o mesmo usuário do sistema, não protege nada e ainda cria atrito.

## Consequências

- As regras RN-SEC-02 a 08 e RN-SEC-17 ficam revogadas.
- Some a trava de porta fixa que o login exigia. A instância única, se continuar,
  passa a ter outro motivo.
- O modelo de dados já nasce como "lista de Perfis com um ativo", mas a v1 mostra só
  um Perfil.
