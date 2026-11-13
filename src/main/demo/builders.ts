import type { WorkItemUpdate } from '@shared/azure'
import type { StateCategory } from '@shared/discovery'
import type {
  AzureState,
  FakeIteration,
  FakePerson,
  FakeProcess,
  FakeProject,
  FakeWorkItem,
  FakeWorkItemType
} from './types'

/**
 * Peças para montar Cenários sem repetir o formato do Azure em cada um. Tudo
 * fictício: organização `contoso`, pessoas e Produtos inventados.
 */

export const ORGANIZATION = 'contoso'

// ─── Pessoas ─────────────────────────────────────────────────────────────────

function person(id: string, displayName: string, login: string): FakePerson {
  return {
    id,
    displayName,
    uniqueName: `${login}@contoso.example`,
    descriptor: `aad.${id.replace(/-/g, '')}`
  }
}

export const PEOPLE = {
  ana: person('00000000-0000-4000-8000-0000000000a1', 'Ana Souza', 'ana.souza'),
  bruno: person('00000000-0000-4000-8000-0000000000b2', 'Bruno Lima', 'bruno.lima'),
  carla: person('00000000-0000-4000-8000-0000000000c3', 'Carla Dias', 'carla.dias'),
  diego: person('00000000-0000-4000-8000-0000000000d4', 'Diego Rocha', 'diego.rocha')
} as const

/** `System.AssignedTo` como o Azure devolve: identidade com o link da foto. */
export function identity(p: FakePerson): Record<string, unknown> {
  return {
    displayName: p.displayName,
    uniqueName: p.uniqueName,
    id: p.id,
    _links: {
      avatar: {
        href: `https://dev.azure.com/${ORGANIZATION}/_apis/GraphProfile/MemberAvatars/${p.descriptor}`
      }
    }
  }
}

// ─── Processos ───────────────────────────────────────────────────────────────

const COMMON_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.AreaPath',
  'System.IterationPath',
  'System.AssignedTo',
  'System.Description',
  'Microsoft.VSTS.Common.Priority'
]

function type(
  name: string,
  referenceName: string,
  states: [string, StateCategory][],
  extraFields: string[] = []
): FakeWorkItemType {
  return {
    name,
    referenceName,
    states: states.map(([stateName, category]) => ({ name: stateName, category })),
    fields: [...COMMON_FIELDS, ...extraFields]
  }
}

const HIDDEN_TYPES: FakeWorkItemType[] = [
  type('Test Plan', 'Microsoft.VSTS.WorkItemTypes.TestPlan', [['Active', 'InProgress']])
]

/** Processo Scrum padrão, como o Azure o descreve. */
export const SCRUM_PROCESS: FakeProcess = {
  templateName: 'Scrum',
  types: [
    type(
      'Product Backlog Item',
      'Microsoft.VSTS.WorkItemTypes.ProductBacklogItem',
      [
        ['New', 'Proposed'],
        ['Approved', 'Proposed'],
        ['Committed', 'InProgress'],
        ['Done', 'Completed'],
        ['Removed', 'Removed']
      ],
      ['Microsoft.VSTS.Scheduling.Effort']
    ),
    type(
      'Bug',
      'Microsoft.VSTS.WorkItemTypes.Bug',
      [
        ['New', 'Proposed'],
        ['Approved', 'Proposed'],
        ['Committed', 'InProgress'],
        ['Done', 'Completed'],
        ['Removed', 'Removed']
      ],
      ['Microsoft.VSTS.Scheduling.Effort']
    ),
    type('Task', 'Microsoft.VSTS.WorkItemTypes.Task', [
      ['To Do', 'Proposed'],
      ['In Progress', 'InProgress'],
      ['Done', 'Completed'],
      ['Removed', 'Removed']
    ]),
    ...HIDDEN_TYPES
  ],
  categories: {
    requirement: ['Product Backlog Item'],
    bug: 'Bug',
    task: 'Task',
    hidden: ['Test Plan']
  }
}

/** Processo Agile padrão. */
export const AGILE_PROCESS: FakeProcess = {
  templateName: 'Agile',
  types: [
    type(
      'User Story',
      'Microsoft.VSTS.WorkItemTypes.UserStory',
      [
        ['New', 'Proposed'],
        ['Active', 'InProgress'],
        ['Resolved', 'Resolved'],
        ['Closed', 'Completed'],
        ['Removed', 'Removed']
      ],
      ['Microsoft.VSTS.Scheduling.StoryPoints']
    ),
    type('Bug', 'Microsoft.VSTS.WorkItemTypes.Bug', [
      ['New', 'Proposed'],
      ['Active', 'InProgress'],
      ['Resolved', 'Resolved'],
      ['Closed', 'Completed']
    ]),
    type('Task', 'Microsoft.VSTS.WorkItemTypes.Task', [
      ['New', 'Proposed'],
      ['Active', 'InProgress'],
      ['Closed', 'Completed'],
      ['Removed', 'Removed']
    ]),
    ...HIDDEN_TYPES
  ],
  categories: {
    requirement: ['User Story'],
    bug: 'Bug',
    task: 'Task',
    hidden: ['Test Plan']
  }
}

/** Perfis de processo da Configuração que casam com os processos acima. */
export const SCRUM_PROFILE = {
  workItemTypes: ['Product Backlog Item', 'Bug'],
  plannableTypes: ['Product Backlog Item'],
  developmentTypes: ['Product Backlog Item'],
  bugType: 'Bug',
  taskType: 'Task',
  estimateField: 'Microsoft.VSTS.Scheduling.Effort',
  deliveredStates: ['Done'],
  terminalStates: ['Done', 'Removed'],
  removedStates: ['Removed'],
  inProgressState: 'Committed',
  bugStateOrder: ['New', 'Approved', 'Committed', 'Done']
}

export const AGILE_PROFILE = {
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
  devDoneState: 'Resolved',
  bugStateOrder: ['New', 'Active', 'Resolved', 'Closed']
}

// ─── Configuração ────────────────────────────────────────────────────────────

/** Expediente em dois turnos, sem feriado extra. */
export const CALENDAR = {
  country: 'BR',
  extraHolidays: [],
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' }
  ],
  productiveHoursPerDay: 6
}

export const STORY_POINTS = { '1': 2, '2': 4, '3': 8, '5': 16, '8': 32 }

export const CAPACITY = {
  frontDevs: 2,
  backDevs: 2,
  sprintDays: 10,
  frontBugPercent: 20,
  backBugPercent: 20
}

/** Configuração de partida: o Cenário sobrescreve o que precisa. */
export function baseConfig(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 1,
    organization: ORGANIZATION,
    processProfiles: { scrum: SCRUM_PROFILE },
    products: [],
    groups: [],
    calendar: CALENDAR,
    storyPoints: STORY_POINTS,
    capacityDefaults: CAPACITY,
    ...overrides
  }
}

// ─── Sprints ─────────────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * `count` sprints de duas semanas, de segunda a sexta, a partir de `firstMonday`.
 * O caminho é `<folder>\<prefixo> <n>`; as datas vêm à meia-noite UTC, como o
 * Azure grava.
 */
export function sprintSeries(options: {
  folder: string
  idPrefix: string
  firstMonday: string
  count: number
  firstNumber?: number
  namePrefix?: string
}): FakeIteration[] {
  const { folder, idPrefix, firstMonday, count, firstNumber = 1, namePrefix = 'Sprint' } = options
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(firstMonday, i * 14)
    const number = firstNumber + i
    const name = `${namePrefix} ${number}`
    return {
      id: `${idPrefix}-${number}`,
      name,
      path: `${folder}\\${name}`,
      startDate: `${start}T00:00:00Z`,
      finishDate: `${addDays(start, 11)}T00:00:00Z`
    }
  })
}

// ─── Projeto e estado ────────────────────────────────────────────────────────

export function project(p: {
  id: string
  name: string
  process: FakeProcess
  areas?: string[]
  iterations?: FakeIteration[]
  teams?: FakeProject['teams']
  customFields?: FakeProject['customFields']
  defaultTeam?: string
}): FakeProject {
  const defaultTeam = p.defaultTeam ?? `${p.name} Team`
  return {
    id: p.id,
    name: p.name,
    process: p.process,
    defaultTeam,
    teams: p.teams ?? [
      { id: `team-${p.id}`, name: defaultTeam, iterationIds: (p.iterations ?? []).map((i) => i.id) }
    ],
    areas: p.areas ?? [],
    iterations: p.iterations ?? [],
    customFields: p.customFields ?? []
  }
}

export function azure(projects: FakeProject[], workItems: FakeWorkItem[]): AzureState {
  const ids = new Set<number>()
  for (const item of workItems) {
    if (ids.has(item.id)) throw new Error(`Cenário com work item repetido: ${item.id}`)
    ids.add(item.id)
  }
  return { organization: ORGANIZATION, user: PEOPLE.ana, projects, workItems }
}

// ─── Work items com histórico ────────────────────────────────────────────────

/** Uma mudança no histórico: data em horário local e o que mudou. */
export type HistoryEvent = [
  date: string,
  change: { state?: string; iteration?: string; assignedTo?: FakePerson }
]

export interface ItemSpec {
  id: number
  project: string
  type: string
  title: string
  area: string
  /** Iteração na criação. Sem `iteration` nos eventos, é a atual. */
  iteration: string
  /** Horário local, sem `Z`: o app lê as datas do Azure no fuso da máquina. */
  created: string
  /** Estado na criação. */
  initialState?: string
  events?: HistoryEvent[]
  assignedTo?: FakePerson
  /** Demais campos, já com o nome de referência (estimativa, criticidade...). */
  fields?: Record<string, unknown>
}

/** Estados de categoria Completed no processo: o Azure grava ClosedDate ao entrar neles. */
function completedStates(process: FakeProcess, typeName: string): Set<string> {
  const t = process.types.find((x) => x.name === typeName)
  if (!t) throw new Error(`Tipo "${typeName}" fora do processo ${process.templateName}`)
  return new Set(t.states.filter((s) => s.category === 'Completed').map((s) => s.name))
}

/**
 * Item com histórico no formato do Azure. A revisão 1 é a criação; cada evento
 * vira uma revisão. O `revisedDate` de uma revisão é a data da seguinte, e o da
 * última é `9999-01-01`. Os campos derivados (estado atual, iteração atual,
 * StateChangeDate, ClosedDate) saem do histórico, para nunca o contradizerem.
 */
export function workItem(process: FakeProcess, spec: ItemSpec): FakeWorkItem {
  const events = [...(spec.events ?? [])].sort(([a], [b]) => a.localeCompare(b))
  const initialState =
    spec.initialState ?? process.types.find((t) => t.name === spec.type)?.states[0]?.name
  if (!initialState) throw new Error(`Tipo "${spec.type}" sem estado inicial`)
  const completed = completedStates(process, spec.type)

  const revisions: WorkItemUpdate[] = [
    {
      id: 1,
      revisedDate: events[0]?.[0] ?? '9999-01-01T00:00:00Z',
      fields: {
        'System.State': { newValue: initialState },
        'System.IterationPath': { newValue: spec.iteration }
      }
    }
  ]

  let state = initialState
  let iteration = spec.iteration
  let assignedTo = spec.assignedTo
  let stateChange = spec.created
  let closed: string | undefined
  let changed = spec.created

  events.forEach(([date, change], i) => {
    const fields: NonNullable<WorkItemUpdate['fields']> = {}
    if (change.state && change.state !== state) {
      fields['System.State'] = { oldValue: state, newValue: change.state }
      state = change.state
      stateChange = date
      closed = completed.has(state) ? date : undefined
    }
    if (change.iteration && change.iteration !== iteration) {
      fields['System.IterationPath'] = { oldValue: iteration, newValue: change.iteration }
      iteration = change.iteration
    }
    if (change.assignedTo) assignedTo = change.assignedTo
    changed = date
    revisions.push({
      id: i + 2,
      revisedDate: events[i + 1]?.[0] ?? '9999-01-01T00:00:00Z',
      fields
    })
  })

  return {
    id: spec.id,
    fields: {
      'System.Id': spec.id,
      'System.Title': spec.title,
      'System.TeamProject': spec.project,
      'System.WorkItemType': spec.type,
      'System.State': state,
      'System.AreaPath': spec.area,
      'System.IterationPath': iteration,
      'System.CreatedDate': spec.created,
      'System.ChangedDate': changed,
      'Microsoft.VSTS.Common.StateChangeDate': stateChange,
      ...(closed ? { 'Microsoft.VSTS.Common.ClosedDate': closed } : {}),
      ...(assignedTo ? { 'System.AssignedTo': identity(assignedTo) } : {}),
      ...spec.fields
    },
    updates: revisions
  }
}

/** Task filha de um item, para a Daily. */
export function task(
  process: FakeProcess,
  spec: Omit<ItemSpec, 'type'> & { parent: number }
): FakeWorkItem {
  const { parent, ...rest } = spec
  return workItem(process, {
    ...rest,
    type: process.categories.task ?? 'Task',
    fields: { 'System.Parent': parent, ...rest.fields }
  })
}
