import { buildSprintGoalRequest } from '../services/ai/sprint-goal'
import { activeScope } from '../services/azure/scope'
import { handle } from './registry'

/**
 * IA do PO (ADR 0007). O único handler devolve o texto que o PO copia; nenhum
 * recebe texto de pedido, e nenhum executa programa ou fala com IA.
 */
export function registerAiHandlers(): void {
  handle('buildSprintGoalRequest', (selectionId, sprint, itemIds) => {
    activeScope(selectionId)
    return buildSprintGoalRequest(selectionId, sprint, itemIds)
  })
}
