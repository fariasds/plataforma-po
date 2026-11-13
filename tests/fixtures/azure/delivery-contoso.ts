import type { UnifiedSprint, WorkItemUpdate } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'

/**
 * Mundo fictício para Entregas e Retrabalho: organização `contoso`, Produtos
 * "Loja Online" (Scrum), "App Mobile" (Agile) e "Suporte" (fluxo contínuo).
 *
 * Datas sem `Z`: são lidas no fuso local, como o app lê as do Azure, e o teste
 * não depende do fuso da máquina.
 *
 * O WIQL é avaliado de verdade (tipos, estados, projeto, area paths, iteração e
 * janela de datas), para que um filtro que suma da consulta apareça no teste.
 */

// ─── Configuração ────────────────────────────────────────────────────────────

const SCRUM = {
  workItemTypes: ['Product Backlog Item', 'Bug'],
  plannableTypes: ['Product Backlog Item'],
  developmentTypes: ['Product Backlog Item'],
  bugType: 'Bug',
  taskType: 'Task',
  estimateField: 'Microsoft.VSTS.Scheduling.Effort',
  deliveredStates: ['Done'],
  terminalStates: ['Done', 'Removed'],
  inProgressState: 'Committed',
  bugStateOrder: ['New', 'Approved', 'Committed', 'Done']
}

const AGILE = {
  workItemTypes: ['User Story', 'Bug'],
  plannableTypes: ['User Story'],
  developmentTypes: ['User Story'],
  bugType: 'Bug',
  taskType: 'Task',
  estimateField: 'Microsoft.VSTS.Scheduling.StoryPoints',
  deliveredStates: ['Closed'],
  terminalStates: ['Closed', 'Removed'],
  inProgressState: 'Active',
  devDoneState: 'Resolved',
  bugStateOrder: ['New', 'Active', 'Resolved', 'Closed']
}

export const REWORK_FIELD = 'Contoso.Retrabalho'

export function deliveryConfig(options: { reworkField?: string | null } = {}): Configuration {
  const raw = {
    version: 1,
    organization: 'contoso',
    processProfiles: { scrum: SCRUM, agile: AGILE },
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7b61ff',
        project: 'Contoso',
        areaPaths: ['Contoso\\Loja'],
        excludedAreaPaths: ['Contoso\\Loja\\QA'],
        processProfile: 'scrum'
      },
      {
        id: 'app',
        name: 'App Mobile',
        color: '#2f6fed',
        project: 'Contoso',
        areaPaths: ['Contoso\\App'],
        processProfile: 'agile'
      },
      {
        id: 'suporte',
        name: 'Suporte',
        color: '#22c55e',
        project: 'Suporte',
        excludedAreaPaths: ['Suporte\\Triagem'],
        processProfile: 'scrum',
        cadence: 'continuous'
      }
    ],
    groups: [{ id: 'digital', name: 'Digital', products: ['loja', 'app'] }],
    customFields: {
      reworkCount: options.reworkField === undefined ? REWORK_FIELD : options.reworkField
    },
    calendar: {
      country: 'BR',
      // Sexta da primeira semana da sprint: sem ele, o lead time do L2 seria 20h.
      extraHolidays: [{ date: '2026-09-25', name: 'Feriado municipal' }],
      workingHours: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '17:00' }
      ],
      productiveHoursPerDay: 6
    },
    storyPoints: { '1': 2, '2': 4 },
    capacityDefaults: {
      frontDevs: 1,
      backDevs: 1,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
  }
  const result = validateConfiguration(raw)
  if (!result.ok) throw new Error(`Configuração de teste inválida: ${JSON.stringify(result)}`)
  return result.config
}

// ─── Sprints ─────────────────────────────────────────────────────────────────

const LOJA_S3 = 'Contoso\\Loja\\Sprint 3'
const APP_S3 = 'Contoso\\App\\Sprint 3'

/** Segunda 21/09 a sexta 02/10/2026. */
export const SPRINT_3: UnifiedSprint = {
  key: '2026-09-21_2026-10-02',
  label: 'Sprint 3 (21/09 – 02/10)',
  startDate: '2026-09-21T00:00:00Z',
  finishDate: '2026-10-02T00:00:00Z',
  iterations: {
    loja: { id: 'it-loja-3', name: 'Sprint 3', path: LOJA_S3 },
    app: { id: 'it-app-3', name: 'Sprint 3', path: APP_S3 }
  }
}

export const SPRINT_2: UnifiedSprint = {
  key: '2026-09-07_2026-09-18',
  label: 'Sprint 2 (07/09 – 18/09)',
  startDate: '2026-09-07T00:00:00Z',
  finishDate: '2026-09-18T00:00:00Z',
  iterations: {
    loja: { id: 'it-loja-2', name: 'Sprint 2', path: 'Contoso\\Loja\\Sprint 2' },
    app: { id: 'it-app-2', name: 'Sprint 2', path: 'Contoso\\App\\Sprint 2' }
  }
}

// ─── Itens ───────────────────────────────────────────────────────────────────

interface FakeItem {
  id: number
  fields: Record<string, unknown>
  updates: WorkItemUpdate[]
}

type Change = { state?: string; iteration?: string }

/**
 * Histórico no formato do Azure: a revisão 0 é a criação e cada evento seguinte
 * vira uma revisão. A data de cada evento é o `revisedDate` da revisão anterior.
 */
function history(initialState: string, events: [date: string, change: Change][]): WorkItemUpdate[] {
  const revisions: WorkItemUpdate[] = [
    {
      id: 1,
      revisedDate: events[0]?.[0] ?? '9999-01-01T00:00:00Z',
      fields: { 'System.State': { newValue: initialState } }
    }
  ]
  events.forEach(([, change], i) => {
    const fields: WorkItemUpdate['fields'] = {}
    if (change.state) fields['System.State'] = { newValue: change.state }
    if (change.iteration) fields['System.IterationPath'] = { newValue: change.iteration }
    revisions.push({
      id: i + 2,
      revisedDate: events[i + 1]?.[0] ?? '9999-01-01T00:00:00Z',
      fields
    })
  })
  return revisions
}

function item(
  id: number,
  f: {
    project: string
    type: string
    state: string
    area: string
    iteration: string
    created: string
    stateChange: string
    closed?: string
    rework?: number
  },
  updates: WorkItemUpdate[]
): FakeItem {
  return {
    id,
    fields: {
      'System.Id': id,
      'System.Title': `Item ${id}`,
      'System.TeamProject': f.project,
      'System.WorkItemType': f.type,
      'System.State': f.state,
      'System.AreaPath': f.area,
      'System.IterationPath': f.iteration,
      'System.CreatedDate': f.created,
      'Microsoft.VSTS.Common.StateChangeDate': f.stateChange,
      ...(f.closed ? { 'Microsoft.VSTS.Common.ClosedDate': f.closed } : {}),
      ...(f.rework !== undefined ? { [REWORK_FIELD]: f.rework } : {})
    },
    updates
  }
}

/**
 * Loja: L1 e L2 entregues (L2 injetado), L3 planejado e aberto, L4 em área
 * excluída, L5 entregue na sprint anterior e reaberto, L6 de tipo fora do Perfil.
 * App: A1 fechado na janela; A2 fechado na janela e reaberto depois (só o OR da
 * iteração o encontra). Suporte: S1 entregue, S2 em área excluída.
 */
export const ITEMS: FakeItem[] = [
  item(
    101,
    {
      project: 'Contoso',
      type: 'Product Backlog Item',
      state: 'Done',
      area: 'Contoso\\Loja',
      iteration: LOJA_S3,
      created: '2026-09-10T09:00:00',
      stateChange: '2026-09-23T17:00:00',
      closed: '2026-09-23T17:00:00',
      rework: 2
    },
    history('New', [
      ['2026-09-18T10:00:00', { iteration: LOJA_S3 }],
      ['2026-09-22T08:00:00', { state: 'Committed' }],
      ['2026-09-23T17:00:00', { state: 'Done' }]
    ])
  ),
  item(
    102,
    {
      project: 'Contoso',
      type: 'Bug',
      state: 'Done',
      area: 'Contoso\\Loja\\Checkout',
      iteration: LOJA_S3,
      created: '2026-09-22T09:00:00',
      stateChange: '2026-09-28T12:00:00',
      closed: '2026-09-28T12:00:00'
    },
    history('New', [
      ['2026-09-22T10:00:00', { iteration: LOJA_S3 }],
      ['2026-09-24T08:00:00', { state: 'Committed' }],
      ['2026-09-28T12:00:00', { state: 'Done' }]
    ])
  ),
  item(
    103,
    {
      project: 'Contoso',
      type: 'Product Backlog Item',
      state: 'Committed',
      area: 'Contoso\\Loja',
      iteration: LOJA_S3,
      created: '2026-09-01T09:00:00',
      stateChange: '2026-09-29T08:00:00'
    },
    history('New', [
      ['2026-09-18T10:00:00', { iteration: LOJA_S3 }],
      ['2026-09-29T08:00:00', { state: 'Committed' }]
    ])
  ),
  item(
    104,
    {
      project: 'Contoso',
      type: 'Product Backlog Item',
      state: 'Done',
      area: 'Contoso\\Loja\\QA',
      iteration: LOJA_S3,
      created: '2026-09-01T09:00:00',
      stateChange: '2026-09-24T10:00:00',
      closed: '2026-09-24T10:00:00',
      rework: 5
    },
    history('New', [
      ['2026-09-18T10:00:00', { iteration: LOJA_S3 }],
      ['2026-09-22T08:00:00', { state: 'Committed' }],
      ['2026-09-24T10:00:00', { state: 'Done' }]
    ])
  ),
  item(
    105,
    {
      project: 'Contoso',
      type: 'Product Backlog Item',
      state: 'Done',
      area: 'Contoso\\Loja',
      iteration: 'Contoso\\Loja\\Sprint 2',
      created: '2026-09-01T09:00:00',
      stateChange: '2026-09-29T10:00:00',
      closed: '2026-09-29T10:00:00',
      rework: 1
    },
    history('New', [
      ['2026-09-08T08:00:00', { state: 'Committed', iteration: 'Contoso\\Loja\\Sprint 2' }],
      ['2026-09-15T12:00:00', { state: 'Done' }],
      ['2026-09-28T08:00:00', { state: 'Committed' }],
      ['2026-09-29T10:00:00', { state: 'Done' }]
    ])
  ),
  item(
    106,
    {
      project: 'Contoso',
      type: 'Task',
      state: 'Done',
      area: 'Contoso\\Loja',
      iteration: LOJA_S3,
      created: '2026-09-21T09:00:00',
      stateChange: '2026-09-22T10:00:00',
      closed: '2026-09-22T10:00:00',
      rework: 3
    },
    history('New', [['2026-09-22T10:00:00', { state: 'Done' }]])
  ),
  item(
    201,
    {
      project: 'Contoso',
      type: 'User Story',
      state: 'Closed',
      area: 'Contoso\\App',
      iteration: APP_S3,
      created: '2026-09-15T09:00:00',
      stateChange: '2026-09-30T10:00:00',
      closed: '2026-09-30T10:00:00',
      rework: 1
    },
    history('New', [
      ['2026-09-18T10:00:00', { iteration: APP_S3 }],
      ['2026-09-21T08:00:00', { state: 'Active' }],
      ['2026-09-22T12:00:00', { state: 'Resolved' }],
      ['2026-09-30T10:00:00', { state: 'Closed' }]
    ])
  ),
  item(
    202,
    {
      project: 'Contoso',
      type: 'Bug',
      state: 'Closed',
      area: 'Contoso\\App',
      iteration: APP_S3,
      created: '2026-09-15T09:00:00',
      stateChange: '2026-10-07T10:00:00',
      closed: '2026-10-07T10:00:00'
    },
    history('New', [
      ['2026-09-18T10:00:00', { iteration: APP_S3 }],
      ['2026-09-30T08:00:00', { state: 'Active' }],
      ['2026-10-02T16:00:00', { state: 'Closed' }],
      ['2026-10-06T08:00:00', { state: 'Active' }],
      ['2026-10-07T10:00:00', { state: 'Closed' }]
    ])
  ),
  item(
    301,
    {
      project: 'Suporte',
      type: 'Product Backlog Item',
      state: 'Done',
      area: 'Suporte\\Atendimento',
      iteration: 'Suporte',
      created: '2026-09-23T09:00:00',
      stateChange: '2026-09-24T15:00:00',
      closed: '2026-09-24T15:00:00',
      rework: 0
    },
    history('New', [['2026-09-24T15:00:00', { state: 'Done' }]])
  ),
  item(
    302,
    {
      project: 'Suporte',
      type: 'Product Backlog Item',
      state: 'Done',
      area: 'Suporte\\Triagem',
      iteration: 'Suporte',
      created: '2026-09-23T09:00:00',
      stateChange: '2026-09-24T15:00:00',
      closed: '2026-09-24T15:00:00',
      rework: 4
    },
    history('New', [['2026-09-24T15:00:00', { state: 'Done' }]])
  )
]

// ─── Cliente falso ───────────────────────────────────────────────────────────

const QUOTED = /'((?:[^']|'')*)'/g

function literals(text: string): string[] {
  return [...text.matchAll(QUOTED)].map((m) => m[1].replace(/''/g, "'"))
}

function listAfter(query: string, field: string): string[] | null {
  const match = query.match(new RegExp(`\\[${field.replace(/\./g, '\\.')}\\] IN \\(([^)]*)\\)`))
  return match ? literals(match[1]) : null
}

function valueAfter(query: string, pattern: string): string | null {
  const match = query.match(new RegExp(`${pattern}\\s*'((?:[^']|'')*)'`))
  return match ? match[1].replace(/''/g, "'") : null
}

function under(area: string, root: string): boolean {
  return area === root || area.startsWith(`${root}\\`)
}

function dateRange(query: string, field: string): [string, string] | null {
  const from = valueAfter(query, `\\[${field}\\] >=`)
  const to = valueAfter(query, `\\[${field}\\] <=`)
  return from && to ? [from, to] : null
}

// O WIQL compara data sem hora quando o literal não tem hora.
function inRange(value: unknown, [from, to]: [string, string]): boolean {
  if (typeof value !== 'string') return false
  const day = value.slice(0, 10)
  return day >= from && day <= to
}

/** Avalia o subconjunto de WIQL que Entregas e Retrabalho escrevem. */
function evaluate(query: string): number[] {
  const types = listAfter(query, 'System.WorkItemType')
  const states = listAfter(query, 'System.State')
  const project = valueAfter(query, '\\[System\\.TeamProject\\] =')
  const iteration = valueAfter(query, '\\[System\\.IterationPath\\] =')
  const excluded = [...query.matchAll(/NOT \[System\.AreaPath\] UNDER '((?:[^']|'')*)'/g)].map(
    (m) => m[1].replace(/''/g, "'")
  )
  const included = [...query.matchAll(/(?<!NOT )\[System\.AreaPath\] UNDER '((?:[^']|'')*)'/g)].map(
    (m) => m[1].replace(/''/g, "'")
  )
  const stateWindow = dateRange(query, 'Microsoft\\.VSTS\\.Common\\.StateChangeDate')
  const closedWindow = dateRange(query, 'Microsoft\\.VSTS\\.Common\\.ClosedDate')

  return ITEMS.filter(({ fields }) => {
    const area = fields['System.AreaPath'] as string
    if (types && !types.includes(fields['System.WorkItemType'] as string)) return false
    if (states && !states.includes(fields['System.State'] as string)) return false
    if (project && fields['System.TeamProject'] !== project) return false
    if (included.length > 0 && !included.some((root) => under(area, root))) return false
    if (excluded.some((root) => under(area, root))) return false
    if (closedWindow && !inRange(fields['Microsoft.VSTS.Common.ClosedDate'], closedWindow)) {
      return false
    }
    const iterationMatch = iteration !== null && fields['System.IterationPath'] === iteration
    if (stateWindow) {
      const windowMatch = inRange(fields['Microsoft.VSTS.Common.StateChangeDate'], stateWindow)
      return windowMatch || iterationMatch
    }
    return iteration === null || iterationMatch
  }).map((i) => i.id)
}

export interface FakeAzure {
  /** Toda consulta WIQL recebida, com o caminho. */
  queries: { path: string; query: string }[]
  fetchAzure<T>(path: string): Promise<T>
  postAzure<T>(path: string, body: unknown): Promise<T>
}

export function createFakeAzure(): FakeAzure {
  const queries: FakeAzure['queries'] = []
  const byId = new Map(ITEMS.map((i) => [i.id, i]))

  return {
    queries,
    async postAzure<T>(path: string, body: unknown): Promise<T> {
      const query = (body as { query: string }).query
      queries.push({ path, query })
      const workItems = evaluate(query).map((id) => ({ id, url: `fake://${id}` }))
      return { workItems } as T
    },
    async fetchAzure<T>(path: string): Promise<T> {
      const updates = path.match(/\/_apis\/wit\/workitems\/(\d+)\/updates/)
      if (updates) return { value: byId.get(Number(updates[1]))!.updates } as T

      const ids = path.match(/[?&]ids=([\d,]+)/)
      if (ids) {
        const value = ids[1].split(',').map((id) => {
          const found = byId.get(Number(id))!
          return { id: found.id, fields: found.fields }
        })
        return { value } as T
      }
      throw new Error(`Caminho não previsto pela fixture: ${path}`)
    }
  }
}
