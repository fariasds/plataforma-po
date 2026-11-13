import { useMutation } from '@tanstack/react-query'
import type { SprintGoalRequest } from '@shared/ai'
import type { UnifiedSprint } from '@shared/azure'
import { ipc } from './client'

export interface SprintGoalSelection {
  selectionId: string
  sprint: UnifiedSprint
  itemIds: number[]
}

/** Monta o pedido do objetivo da sprint para o PO copiar (ADR 0007). */
export function useBuildSprintGoalRequest(): ReturnType<
  typeof useMutation<SprintGoalRequest, Error, SprintGoalSelection>
> {
  return useMutation<SprintGoalRequest, Error, SprintGoalSelection>({
    mutationFn: ({ selectionId, sprint, itemIds }) =>
      ipc.buildSprintGoalRequest(selectionId, sprint, itemIds)
  })
}
