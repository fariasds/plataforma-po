import type { ProcessProfile } from './schema'

/**
 * Perfis de processo prontos para os processos padrão do Azure DevOps, sem
 * customização. Servem de ponto de partida: um processo herdado com estados ou
 * tipos próprios copia o preset e ajusta.
 *
 * Tipos, estados e campos conferidos em 2026-09-27 na documentação da Microsoft:
 * - Processos e estados padrão:
 *   https://learn.microsoft.com/azure/devops/boards/work-items/guidance/choose-process
 * - Scrum (PBI e Bug: New → Approved → Committed → Done; estimativa em Effort):
 *   https://learn.microsoft.com/azure/devops/boards/work-items/guidance/scrum-process-workflow
 * - Agile (User Story: New → Active → Resolved → Closed; estimativa em Story Points):
 *   https://learn.microsoft.com/azure/devops/boards/work-items/guidance/agile-process-workflow
 */

export const SCRUM_PRESET: ProcessProfile = {
  workItemTypes: ['Product Backlog Item', 'Bug'],
  plannableTypes: ['Product Backlog Item'],
  developmentTypes: ['Product Backlog Item'],
  bugType: 'Bug',
  taskType: 'Task',
  estimateField: 'Microsoft.VSTS.Scheduling.Effort',
  deliveredStates: ['Done'],
  terminalStates: ['Done', 'Removed'],
  removedStates: ['Removed'],
  // No Scrum o PBI não tem estado "em desenvolvimento" separado: Committed é
  // quando o time assume o item na sprint.
  inProgressState: 'Committed',
  devDoneState: null,
  testingState: null,
  bugStateOrder: ['New', 'Approved', 'Committed', 'Done']
}

export const AGILE_PRESET: ProcessProfile = {
  workItemTypes: ['User Story', 'Bug'],
  plannableTypes: ['User Story'],
  developmentTypes: ['User Story'],
  bugType: 'Bug',
  taskType: 'Task',
  estimateField: 'Microsoft.VSTS.Scheduling.StoryPoints',
  deliveredStates: ['Closed'],
  terminalStates: ['Closed', 'Removed'],
  removedStates: ['Removed'],
  inProgressState: 'Active',
  // Resolved: tarefas concluídas e testes de unidade passando, aguardando o aceite.
  devDoneState: 'Resolved',
  testingState: null,
  bugStateOrder: ['New', 'Active', 'Resolved', 'Closed']
}

export const PROCESS_PRESETS = {
  scrum: SCRUM_PRESET,
  agile: AGILE_PRESET
} as const satisfies Record<string, ProcessProfile>
