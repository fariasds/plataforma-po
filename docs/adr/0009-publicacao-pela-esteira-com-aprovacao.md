# Publicação pela esteira, com uma aprovação do mantenedor

**Status:** aceita · 2026-11-20

Uma versão é publicada quando a `version` do `package.json` chega à `main` sem
Release publicada. A esteira constrói, audita, atesta e cria o rascunho, para no
ambiente `producao` do GitHub até o mantenedor aprovar, publica e confere de fora. A
correção de uma versão com problema é sempre uma versão maior.

Substitui o caminho anterior: um PR só para subir a versão, a tag criada e enviada à
mão, o rascunho conferido à mão (incluindo a auditoria do pacote) e o botão de
publicar na interface do GitHub.

## Por que uma aprovação, e não nenhuma

Publicar avisa todo app instalado (`RN-GLB-18`). A partir daí, uma versão ruim chega
a todo mundo, e não há como puxá-la de volta da máquina de quem já instalou: não há
atualização automática (ADR 0008). Os testes provam o que eles cobrem. A aprovação é
o momento em que uma pessoa decide que o resto também está bom.

Ela vale mais quando vem depois de o mantenedor testar o **instalador exato** do PR,
que o CI anexa desde então. O que a conferência do rascunho fazia à mão (asar,
hash, laudo) passou a ser da esteira, e a aprovação deixou de ser carimbo sobre algo
que ninguém instalou.

## Por que não três cliques, como antes

O merge, a tag e o botão de publicar eram três momentos manuais, e nenhum deles
mostrava o que já tinha sido conferido. Agora o merge é do próprio PR (auto-merge
quando os checks passam), a tag nasce na publicação, e a aprovação mostra a lista do
que a esteira já fez.

## Por que não um repositório sem portão

A `main` não exige revisão: o único mantenedor não pode aprovar o próprio PR. Sem a
aprovação do ambiente, um PR verde iria sozinho até o usuário final. A esteira
recusa seguir se o ambiente não exigir revisor, porque o GitHub cria na hora um
ambiente que não existe, sem proteção nenhuma.

## Consequências

- **Rollback é para a frente.** Uma versão com problema é recolhida
  (`recolher-versao.yml`: vira pré-lançamento, a anterior volta a ser a mais
  recente) e corrigida por uma versão maior. O número nunca volta.
- **Subir a versão é decidir publicar.** Um PR que muda a `version` gera a versão
  quando chega à `main`; um PR que não muda integra sem gerar.
- **A conferência de fora é automática,** exceto instalar e abrir: o app tem de abrir
  sem nenhum Perfil, e isso continua com o mantenedor.
