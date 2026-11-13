/**
 * Chaves dos Dados de trabalho do Planning (RN-PLN-07, RN-PLN-12, RN-PLN-16,
 * RN-PLN-20). Usam o ID do Produto e a chave da Sprint unificada, nunca nomes
 * (RN-CFG-08). Moram no `shared` porque o main também lê os remanescentes ao
 * montar o pedido do objetivo da sprint.
 */

/** O alfabeto da chave é fechado (`[a-z0-9:_-]`); a chave da sprint já cabe nele. */
function keyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
}

export const planningKeys = {
  unchecked: (sprintKey: string): string => `planning:unchecked:${keyPart(sprintKey)}`,
  manual: (productId: string, sprintKey: string): string =>
    `planning:manual:${keyPart(productId)}:${keyPart(sprintKey)}`,
  /** Objetivo da sprint, por Produto ou Grupo selecionado. */
  goal: (selectionId: string, sprintKey: string): string =>
    `planning:goal:${keyPart(selectionId)}:${keyPart(sprintKey)}`,
  capacity: 'planning:capacity'
}
