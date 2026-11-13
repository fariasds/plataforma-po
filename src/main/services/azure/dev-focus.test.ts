import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { fetchAzure, postAzure } from './client'
import { getDevFocusData, getInProgressPeriods } from './dev-focus'

// RN-DES-06 contra respostas fictícias do Azure: organização contoso, Produtos
// "Loja Online" (Perfil de processo Scrum) e "App Mobile" (processo próprio).

vi.mock('./client', () => ({ fetchAzure: vi.fn(), postAzure: vi.fn() }))

let activeConfig: Configuration | null = null
vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => activeConfig }))

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve('tests/fixtures/azure', name), 'utf8')) as T

interface DevFocusFixture {
  iterations: Record<string, number[]>
  items: Record<string, Record<string, string>>
  updates: Record<string, unknown[]>
}
const azure = read<DevFocusFixture>('perf-dev-focus.json')

function loadConfig(): Configuration {
  const result = validateConfiguration(read('perf-configuracao.json'))
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
}

const SPRINT_8: UnifiedSprint = {
  key: '2026-04-13',
  label: 'Sprint 8 (13/04 a 24/04)',
  startDate: '2026-04-13T00:00:00Z',
  finishDate: '2026-04-24T00:00:00Z',
  iterations: {
    loja: { id: 'it-loja-8', name: 'Sprint 8', path: 'Contoso\\Loja\\Sprint 8' },
    app: { id: 'it-app-8', name: 'Sprint 8', path: 'ContosoApp\\Sprint 8' }
  }
}

/** Sprint de só um Produto: o outro não tem iteração nela. */
const SPRINT_9_LOJA: UnifiedSprint = {
  key: '2026-04-27',
  label: 'Sprint 9 (27/04 a 08/05)',
  startDate: '2026-04-27T00:00:00Z',
  finishDate: '2026-05-08T00:00:00Z',
  iterations: {
    loja: { id: 'it-loja-9', name: 'Sprint 9', path: 'Contoso\\Loja\\Sprint 9' }
  }
}

const wiqlQueries: { path: string; query: string }[] = []

beforeEach(() => {
  activeConfig = loadConfig()
  wiqlQueries.length = 0

  vi.mocked(postAzure).mockImplementation(async (path, body) => {
    const query = (body as { query: string }).query
    wiqlQueries.push({ path, query })
    const iteration = /\[System\.IterationPath\] = '([^']+)'/.exec(query)?.[1] ?? ''
    const ids = azure.iterations[iteration] ?? []
    return { workItems: ids.map((id) => ({ id })) } as never
  })

  vi.mocked(fetchAzure).mockImplementation(async (path) => {
    const updates = /workitems\/(\d+)\/updates/.exec(path)
    if (updates) return { value: azure.updates[updates[1]] ?? [] } as never
    const ids = /workitems\?ids=([\d,]+)/.exec(path)?.[1].split(',') ?? []
    return { value: ids.map((id) => ({ id: Number(id), fields: azure.items[id] })) } as never
  })
})

describe('RN-DES-06 · foco em desenvolvimento', () => {
  it('um Produto: horas do tipo de desenvolvimento ÷ horas em progresso, sem contar o feriado', async () => {
    const { sprintSlots } = await getDevFocusData('loja', [SPRINT_8])

    // PBI 101: segunda 8h + Tiradentes 0h = 8h. Bug 102: 7h, fora de developmentTypes.
    expect(sprintSlots).toEqual([
      {
        key: '2026-04-13',
        label: 'Sprint 8',
        fullLabel: 'Sprint 8 (13/04 a 24/04)',
        devFocusPercent: 53,
        devHours: 8,
        totalHours: 15
      }
    ])
  })

  it('usa os tipos e o estado de desenvolvimento do Perfil de processo de cada Produto', async () => {
    const { sprintSlots } = await getDevFocusData('app', [SPRINT_8])

    // Feature 201 nunca entrou em "Fazendo": vale criação → fechamento (3h).
    // Chore 202 ficou 3h em "Fazendo" e não é desenvolvimento.
    expect(sprintSlots[0]).toMatchObject({ devHours: 3, totalHours: 6, devFocusPercent: 50 })

    const appQuery = wiqlQueries.find((q) => q.path.startsWith('/ContosoApp/'))!.query
    expect(appQuery).toContain(`IN ('Feature', 'Chore', 'Defeito')`)
    expect(appQuery).not.toContain('Product Backlog Item')
  })

  it('num Grupo, as horas dos Produtos se somam antes da divisão', async () => {
    const { sprintSlots } = await getDevFocusData('digital', [SPRINT_8])

    expect(sprintSlots[0]).toMatchObject({ devHours: 11, totalHours: 21, devFocusPercent: 52 })
    expect(wiqlQueries.map((q) => q.path).sort()).toEqual([
      '/Contoso/_apis/wit/wiql?api-version=7.1',
      '/ContosoApp/_apis/wit/wiql?api-version=7.1'
    ])
  })

  it('sprint sem iteração de nenhum Produto do escopo é omitida', async () => {
    const { sprintSlots } = await getDevFocusData('app', [SPRINT_9_LOJA, SPRINT_8])
    expect(sprintSlots.map((s) => s.key)).toEqual(['2026-04-13'])
  })

  it('Produto sem iterações não tem o gráfico', async () => {
    const result = await getDevFocusData('suporte', [SPRINT_8])
    expect(result).toEqual({ sprintSlots: [], monthSlots: [] })
    expect(wiqlQueries).toEqual([])
  })

  it('sprint sem horas registradas resulta em nulo, não zero', async () => {
    const { sprintSlots } = await getDevFocusData('loja', [SPRINT_9_LOJA])
    expect(sprintSlots[0]).toMatchObject({ devFocusPercent: null, totalHours: 0 })
  })

  it('agrega os meses pelo início da sprint, do mais antigo ao mais novo', async () => {
    // buildUnifiedSprints entrega da mais nova para a mais antiga.
    const { monthSlots } = await getDevFocusData('loja', [SPRINT_9_LOJA, SPRINT_8])
    expect(monthSlots).toEqual([
      {
        key: '2026-04',
        label: 'Abr/26',
        fullLabel: 'Abril de 2026',
        devFocusPercent: 53,
        devHours: 8,
        totalHours: 15
      }
    ])
  })

  it('segue o calendário da Configuração: feriado extra deixa de contar', async () => {
    activeConfig = {
      ...activeConfig!,
      calendar: {
        ...activeConfig!.calendar,
        extraHolidays: [{ date: '2026-04-20', name: 'Feriado municipal' }]
      }
    }
    const { sprintSlots } = await getDevFocusData('loja', [SPRINT_8])
    // PBI 101 perde a segunda-feira: sobra 0h. Só o bug conta.
    expect(sprintSlots[0]).toMatchObject({ devHours: 0, totalHours: 7, devFocusPercent: 0 })
  })

  it('sem Configuração válida, falha com erro tipado', async () => {
    activeConfig = null
    await expect(getDevFocusData('loja', [SPRINT_8])).rejects.toMatchObject({
      code: 'PROFILE_MISSING'
    })
  })
})

describe('getInProgressPeriods', () => {
  it('reconhece o estado de desenvolvimento pelo nome configurado', () => {
    const updates = azure.updates['202'] as Parameters<typeof getInProgressPeriods>[0]
    expect(getInProgressPeriods(updates, 'Fazendo')).toHaveLength(1)
    expect(getInProgressPeriods(updates, 'In Progress')).toEqual([])
  })
})
