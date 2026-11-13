# Camada de planejamento local sobre a lista de features do Azure

**Status:** aceita · 2026-08-31

O Roadmap precisa de duas coisas que vivem em lugares diferentes: a **lista de
features**, que já existe como work item no Azure DevOps, e o **planejamento**
delas — três fases, duração em sprints e sprint de início de cada fase — que não
tem campo correspondente lá. Decidimos que o Azure permanece dono da lista
(identidade, título, estado, produto) e que a camada de planejamento é gravada
**na máquina**, indexada pelo ID do work item, exatamente como o Planning já faz
com itens desmarcados e remanescentes (`RN-PLN-07`, `RN-PLN-12`).

## Alternativas consideradas

- **Escrever o planejamento no Azure** (campos customizados na Feature, ou tags).
  Rejeitada: transformaria o app de leitor em escritor. Hoje o contrato de IPC
  (`src/shared/ipc.ts`) só tem métodos de leitura, e o PAT existe sob a premissa
  de que nada é alterado no Azure a partir daqui. É uma mudança de natureza do
  produto, não uma feature.
- **Ignorar o Azure e digitar tudo localmente.** Rejeitada: duplicaria títulos e
  estados que já existem, criando divergência silenciosa entre as duas fontes.

## Consequência que precisa ser encarada

**O plano vive numa máquina só.** Perdido o perfil, reinstalado o app ou trocado
o computador, as features continuam no Azure e o planejamento inteiro some — sem
erro, sem aviso. Por isso **exportar e importar o plano é requisito da primeira
versão**, não item de backlog futuro.

O mesmo vale para compartilhar: mostrar o roadmap a outra pessoa é exportar, não
dar acesso.
