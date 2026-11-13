import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import { configurationSchema, type ConfigurationInput } from '@shared/config/schema'
import { SCRUM_PRESET } from '@shared/config/presets'

// O cliente fala com o Azure e a Configuração vem do disco: os dois são trocados
// por fixtures fictícias (organização contoso).
const azure = vi.hoisted(() => ({
  fetchAzure: vi.fn(),
  postAzure: vi.fn()
}))
const profile = vi.hoisted(() => ({ getActiveConfig: vi.fn() }))

vi.mock('./client', () => azure)
vi.mock('../../profile/config-loader', () => profile)

const { getBugAnalysisData } = await import('./bug-analysis')

const FIXTURES = join(__dirname, '../../../../tests/fixtures/azure')
function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T
}

interface ProjectFixture {
  historical: { workItems: { id: number }[] }
  active: { workItems: { id: number }[] }
  workitems: { value: { id: number }[] }
  /** Campos que existem no projeto; sem isto, os dois de `bugs-custom.json`. */
  fields?: string[]
}

const CUSTOM_FIELDS = ['Contoso.Gravidade', 'Contoso.GravidadeAntiga']

const SPRINT: UnifiedSprint = {
  key: '2026-08-31',
  label: '31/08 – 11/09',
  startDate: '2026-08-31T00:00:00Z',
  finishDate: '2026-09-11T00:00:00Z',
  iterations: { loja: { id: 'it-12', name: 'Sprint 12', path: 'Contoso\\Sprint 12' } }
} as UnifiedSprint

function baseConfig(overrides: Partial<ConfigurationInput>): ConfigurationInput {
  return {
    version: 1,
    organization: 'contoso',
    processProfiles: { scrum: SCRUM_PRESET },
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7B61FF',
        project: 'Contoso',
        areaPaths: ['Contoso\\Loja'],
        excludedAreaPaths: ['Contoso\\Loja\\QA'],
        processProfile: 'scrum'
      }
    ],
    calendar: {
      country: 'BR',
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
    },
    ...overrides
  }
}

function useConfig(input: ConfigurationInput): void {
  profile.getActiveConfig.mockReturnValue(configurationSchema.parse(input))
}

/** Responde às duas consultas WIQL, à lista de campos e ao lote de itens, por projeto. */
function serveProjects(byProject: Record<string, ProjectFixture>): void {
  azure.postAzure.mockImplementation(async (path: string, body: { query: string }) => {
    const project = decodeURIComponent(path.split('/')[1])
    const data = byProject[project]
    return body.query.includes('[System.CreatedDate] >=') ? data.historical : data.active
  })
  azure.fetchAzure.mockImplementation(async (path: string) => {
    const project = decodeURIComponent(path.split('/')[1])
    if (path.includes('/_apis/wit/fields?')) {
      const names = byProject[project].fields ?? CUSTOM_FIELDS
      return { value: names.map((referenceName) => ({ referenceName })) }
    }
    const ids = new URL(`http://x${path}`).searchParams.get('ids')!.split(',').map(Number)
    return { value: byProject[project].workitems.value.filter((w) => ids.includes(w.id)) }
  })
}

function queries(): string[] {
  return azure.postAzure.mock.calls.map(([, body]) => (body as { query: string }).query)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Análise de Bugs com o processo Scrum padrão, sem criticidade (RN-BUG-01, 04, 05)', () => {
  beforeEach(() => {
    useConfig(baseConfig({}))
    serveProjects({ Contoso: fixture<ProjectFixture>('bugs-scrum.json') })
  })

  it('consulta pelo tipo, estados e áreas do Perfil de processo e do Produto', async () => {
    await getBugAnalysisData('loja', [SPRINT], SPRINT)

    const [historical, active] = queries()
    for (const query of [historical, active]) {
      expect(query).toContain("[System.WorkItemType] = 'Bug'")
      expect(query).toContain("[System.TeamProject] = 'Contoso'")
      expect(query).toContain("([System.AreaPath] UNDER 'Contoso\\Loja')")
      expect(query).toContain("AND NOT [System.AreaPath] UNDER 'Contoso\\Loja\\QA'")
    }
    expect(historical).toContain("[System.State] NOT IN ('Removed')")
    expect(active).toContain("[System.State] NOT IN ('Done', 'Removed')")
  })

  it('sem campo de criticidade, não pede campo customizado e marca tudo como não informado', async () => {
    const result = await getBugAnalysisData('loja', [SPRINT], SPRINT)

    const fieldLists = azure.fetchAzure.mock.calls.map(([path]) =>
      new URL(`http://x${path as string}`).searchParams.get('fields')
    )
    for (const fields of fieldLists) expect(fields).not.toMatch(/Contoso\./)

    expect(result.criticalityConfigured).toBe(false)
    expect(result.allBugs.every((b) => b.criticality === 'Não informado')).toBe(true)
    expect(result.criticalityBreakdown).toEqual([{ name: 'Não informado', value: 2 }])
  })

  it('sem marcador de reincidência, nenhum bug é reincidente', async () => {
    const result = await getBugAnalysisData('loja', [SPRINT], SPRINT)

    expect(result.recurrenceConfigured).toBe(false)
    expect(result.allBugs.some((b) => b.isRecurrent)).toBe(false)
  })

  it('devolve a ordem de estados do Perfil de processo e os ativos por estado', async () => {
    const result = await getBugAnalysisData('loja', [SPRINT], SPRINT)

    const [, approved, committed] = SCRUM_PRESET.bugStateOrder
    expect(result.stateOrder).toEqual(SCRUM_PRESET.bugStateOrder)
    expect(result.activeBugsCount).toBe(2)
    expect(result.activeBugsByState).toEqual([
      { name: approved, value: 1 },
      { name: committed, value: 1 }
    ])
    expect(result.allBugs.map((b) => b.productId)).toEqual(['loja', 'loja'])
  })
})

describe('Análise de Bugs com estados customizados e criticidade (RN-BUG-05, 06)', () => {
  const custom = fixture<Record<string, ProjectFixture>>('bugs-custom.json')

  beforeEach(() => {
    useConfig(
      baseConfig({
        processProfiles: {
          proprio: {
            ...SCRUM_PRESET,
            deliveredStates: ['Encerrado'],
            terminalStates: ['Encerrado', 'Descartado'],
            removedStates: ['Descartado'],
            inProgressState: 'Em correção',
            bugStateOrder: ['Triagem', 'Em correção', 'Em validação', 'Encerrado']
          },
          scrum: SCRUM_PRESET
        },
        products: [
          {
            id: 'loja',
            name: 'Loja Online',
            color: '#7B61FF',
            project: 'Contoso',
            areaPaths: ['Contoso\\Loja', 'Contoso\\Checkout'],
            processProfile: 'proprio'
          },
          {
            id: 'app',
            name: 'App Mobile',
            color: '#00A3A3',
            project: 'Contoso Mobile',
            processProfile: 'scrum'
          }
        ],
        groups: [{ id: 'digital', name: 'Digital', products: ['loja', 'app'] }],
        customFields: { criticality: ['Contoso.Gravidade', 'Contoso.GravidadeAntiga'] },
        criticality: [
          { name: 'Crítica', matches: ['crítica', 'critica'] },
          { name: 'Leve', matches: ['leve'] }
        ],
        recurrentBugTag: '[voltou]'
      })
    )
    serveProjects(custom)
  })

  it('usa os estados terminais e descartados do Perfil de processo de cada Produto', async () => {
    await getBugAnalysisData('digital', [SPRINT], SPRINT)

    const byProject = (name: string): string[] =>
      queries().filter((q) => q.includes(`[System.TeamProject] = '${name}'`))
    const [lojaHistorical, lojaActive] = byProject('Contoso')
    expect(lojaHistorical).toContain("NOT IN ('Descartado')")
    expect(lojaActive).toContain("NOT IN ('Encerrado', 'Descartado')")
    expect(lojaActive).toContain(
      "([System.AreaPath] UNDER 'Contoso\\Loja' OR [System.AreaPath] UNDER 'Contoso\\Checkout')"
    )

    // Produto sem area path: o projeto inteiro
    const [appHistorical, appActive] = byProject('Contoso Mobile')
    expect(appActive).toContain("NOT IN ('Done', 'Removed')")
    expect(appHistorical).not.toContain('UNDER')
  })

  it('lê a criticidade no primeiro campo preenchido, na ordem da Configuração', async () => {
    const result = await getBugAnalysisData('digital', [SPRINT], SPRINT)
    const byId = new Map(result.allBugs.map((b) => [b.id, b]))

    expect(result.criticalityConfigured).toBe(true)
    expect(byId.get(201)?.criticality).toBe('crítica (8h)')
    expect(byId.get(202)?.criticality).toBe('Leve')
    expect(byId.get(301)?.criticality).toBe('Não informado')
  })

  it('não pede ao projeto um campo de criticidade que ele não tem', async () => {
    // O Azure responde 400 à requisição inteira se um campo pedido não existe.
    serveProjects({
      Contoso: { ...custom.Contoso, fields: ['Contoso.Gravidade'] },
      'Contoso Mobile': { ...custom['Contoso Mobile'], fields: [] }
    })

    const result = await getBugAnalysisData('digital', [SPRINT], SPRINT)

    const requested = azure.fetchAzure.mock.calls
      .map(([path]) => new URL(`http://x${path as string}`).searchParams.get('fields'))
      .filter((fields) => fields !== null)
    expect(requested.length).toBeGreaterThan(0)
    for (const fields of requested) expect(fields).not.toContain('Contoso.GravidadeAntiga')
    expect(requested.some((fields) => fields.includes('Contoso.Gravidade'))).toBe(true)

    const byId = new Map(result.allBugs.map((b) => [b.id, b]))
    expect(result.criticalityConfigured).toBe(true)
    expect(byId.get(202)?.criticality).toBe('Leve')
    expect(byId.get(301)?.criticality).toBe('Não informado')
  })

  it('reconhece o marcador de reincidência sem diferenciar maiúsculas', async () => {
    const result = await getBugAnalysisData('digital', [SPRINT], SPRINT)

    expect(result.recurrenceConfigured).toBe(true)
    expect(result.allBugs.filter((b) => b.isRecurrent).map((b) => b.id)).toEqual([201])
    expect(result.sprintStats[0]).toMatchObject({ total: 3, recurrentCount: 1, recurrenceRate: 33 })
  })

  it('soma os Produtos do Grupo e junta as ordens de estado sem repetir', async () => {
    const result = await getBugAnalysisData('digital', [SPRINT], SPRINT)

    expect(result.activeBugsCount).toBe(2)
    expect(result.stateOrder).toEqual([
      'Triagem',
      'Em correção',
      'Em validação',
      'Encerrado',
      ...SCRUM_PRESET.bugStateOrder
    ])
    expect(new Set(result.allBugs.map((b) => b.productId))).toEqual(new Set(['loja', 'app']))
  })
})
