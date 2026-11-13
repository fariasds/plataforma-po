# Repositório público novo, com histórico limpo e licença GPL-3.0

**Status:** aceita · 2026-09-27

A versão open source nasce em um **repositório novo**, a partir de um commit inicial
limpo. Este repositório continua privado, como arquivo. O histórico atual carrega
nomes de produtos e da organização do empregador, a configuração do serviço de
autenticação e as regras escritas para aquele contexto. Tentar limpar o histórico com `git filter-repo`
sempre deixa algum resto, e um histórico novo e bem escrito vale mais para o
portfólio.

A licença é a **GPL-3.0**. O objetivo original era "uso livre, sem comercialização";
a GPL é a opção open source mais próxima disso: qualquer pessoa pode usar, inclusive
no trabalho, mas quem distribuir uma versão modificada precisa abrir o código.

O build passa a ser feito pelo GitHub Actions a partir de uma tag, com o SHA-256
publicado na Release. Assim qualquer pessoa pode conferir de qual código saiu o
instalador. O repositório público atual, que só guarda Releases (RN-SEC-15), será
arquivado.

**A publicação só acontece com autorização explícita do autor**, depois que tudo
estiver validado.
