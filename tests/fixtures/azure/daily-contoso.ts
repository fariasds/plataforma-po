import type { UnifiedSprint, WorkItemUpdate } from '@shared/azure'
import { configurationSchema, type Configuration } from '@shared/config/schema'

/**
 * Cenário fictício da Daily: organização `contoso`, Produto "Loja Online" num
 * processo com estados próprios. Nada aqui existe no Azure de ninguém.
 */

export const DAILY_PROFILE = {
  workItemTypes: ['Product Backlog Item', 'Bug'],
  plannableTypes: ['Product Backlog Item'],
  developmentTypes: ['Product Backlog Item'],
  bugType: 'Bug',
  taskType: 'Tarefa',
  estimateField: 'Microsoft.VSTS.Scheduling.StoryPoints',
  deliveredStates: ['Entregue'],
  terminalStates: ['Entregue', 'Descartado'],
  removedStates: ['Descartado'],
  inProgressState: 'Em construção',
  devDoneState: 'Construído',
  testingState: 'Em validação' as string | null,
  bugStateOrder: ['Novo', 'Em construção', 'Entregue']
}

/** Configuração válida, com o Perfil de processo ajustável por teste. */
export function dailyConfig(
  overrides: {
    profile?: Partial<typeof DAILY_PROFILE>
    reworkCount?: string | null
  } = {}
): Configuration {
  return configurationSchema.parse({
    version: 1,
    organization: 'contoso',
    processProfiles: { loja: { ...DAILY_PROFILE, ...overrides.profile } },
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7B61FF',
        project: 'Contoso',
        areaPaths: ['Contoso\\Loja'],
        excludedAreaPaths: ['Contoso\\Loja\\QA'],
        processProfile: 'loja'
      }
    ],
    customFields: {
      reworkCount:
        overrides.reworkCount === undefined ? 'Contoso.Retrabalho' : overrides.reworkCount
    },
    calendar: {
      country: 'BR',
      // 7h de expediente contra 6h produtivas: as duas réguas da RN-DLY-01.
      workingHours: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' }
      ],
      productiveHoursPerDay: 6
    },
    storyPoints: { '1': 3, '3': 12, '5': 24, '8': 36, '13': 60 },
    capacityDefaults: {
      frontDevs: 1,
      backDevs: 1,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
  })
}

export function dailySprint(startDate: string, finishDate: string): UnifiedSprint {
  return {
    key: startDate,
    label: 'Sprint 7',
    startDate: `${startDate}T00:00:00Z`,
    finishDate: `${finishDate}T00:00:00Z`,
    iterations: { loja: { id: 'it-7', name: 'Sprint 7', path: 'Contoso\\Sprint 7' } }
  }
}

/** Instante local, como o Azure é lido no app. */
export function at(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(y, m - 1, d, h, min).toISOString()
}

/**
 * Histórico no formato do Azure. A revisão `i` passa a valer no `revisedDate` da
 * anterior — por isso cada transição vira o `revisedDate` da revisão de antes.
 */
export function history(...transitions: Array<[state: string, when: string]>): WorkItemUpdate[] {
  const revisedDates = [...transitions.map(([, when]) => when), '9999-01-01T00:00:00Z']
  return [
    { id: 1, revisedDate: revisedDates[0], fields: { 'System.State': { newValue: 'Novo' } } },
    ...transitions.map(([state], i) => ({
      id: i + 2,
      revisedDate: revisedDates[i + 1],
      fields: { 'System.State': { newValue: state } }
    }))
  ]
}

export interface DailyWorkItem {
  id: number
  fields: Record<string, unknown>
  updates: WorkItemUpdate[]
}

export function workItem(
  id: number,
  state: string,
  storyPoints: number | null,
  updates: WorkItemUpdate[],
  extra: Record<string, unknown> = {}
): DailyWorkItem {
  return {
    id,
    fields: {
      'System.Id': id,
      'System.Title': `Item ${id}`,
      'System.State': state,
      'System.WorkItemType': 'Product Backlog Item',
      ...(storyPoints === null ? {} : { 'Microsoft.VSTS.Scheduling.StoryPoints': storyPoints }),
      ...extra
    },
    updates
  }
}

export interface DailyTaskFixture {
  id: number
  fields: Record<string, unknown>
}

export function task(id: number, parent: number, state: string): DailyTaskFixture {
  return {
    id,
    fields: {
      'System.Id': id,
      'System.Title': `Tarefa ${id}`,
      'System.State': state,
      'System.Parent': parent
    }
  }
}
