import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import type { SprintDeliveryResult } from '@shared/dashboards'
import {
  developmentTypesOf,
  summarizeDelivery
} from '../../../renderer/src/features/sprint-delivery/summary'
import {
  SPRINT_3,
  createFakeAzure,
  deliveryConfig,
  type FakeAzure
} from '../../../../tests/fixtures/azure/delivery-contoso'

// Entregas da Sprint contra um Azure fictício (organização contoso). Os números
// esperados estão calculados à mão nos comentários de cada caso:
// expediente 08–12 e 13–17, feriado em 25/09.

const state = vi.hoisted(() => ({
  config: null as Configuration | null,
  azure: null as FakeAzure | null
}))

vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => state.config }))
vi.mock('./client', () => ({
  fetchAzure: (path: string) => state.azure!.fetchAzure(path),
  postAzure: (path: string, body: unknown) => state.azure!.postAzure(path, body)
}))

const { getSprintDeliveryData, productAreaClauses, wiqlQuote } = await import('./sprint-delivery')
const { resolveScope } = await import('./scope')

beforeEach(() => {
  state.config = deliveryConfig()
  state.azure = createFakeAzure()
})

const ids = (r: SprintDeliveryResult): number[] => r.deliveredItems.map((d) => d.workItem.id)

function byId(r: SprintDeliveryResult, id: number): SprintDeliveryResult['deliveredItems'][number] {
  return r.deliveredItems.find((d) => d.workItem.id === id)!
}

describe('Produto Scrum simples (Loja Online)', () => {
  it('entrega pelo histórico, planejado pela iteração e injeção pela atribuição', async () => {
    const r = await getSprintDeliveryData('loja', SPRINT_3)

    // 104 está em área excluída, 105 foi entregue na sprint anterior (RN-ENT-01),
    // 106 é Task, fora de workItemTypes, e 103 não chegou a Done.
    expect(ids(r)).toEqual([101, 102])
    expect(r.totalInSprint).toBe(3)
    expect(r.scopeInjectedCount).toBe(1)
  })

  it('lead time e tempo na sprint em horas úteis do calendário da Configuração', async () => {
    const r = await getSprintDeliveryData('loja', SPRINT_3)

    expect(byId(r, 101)).toMatchObject({
      closedAt: '2026-09-23T17:00:00',
      leadTimeHours: 16,
      devTimeInSprintHours: 16
    })
    // 24/09 (8h) + 25/09 feriado (0h) + 28/09 até 12h (4h). Sem o feriado, 20h.
    expect(byId(r, 102)).toMatchObject({
      closedAt: '2026-09-28T12:00:00',
      leadTimeHours: 12,
      devTimeInSprintHours: 12
    })
    expect(byId(r, 102).workItem.fields['System.CreatedDate']).toBe('2026-09-22T09:00:00')
  })

  it('distribuições por tipo e os números da tela', async () => {
    const r = await getSprintDeliveryData('loja', SPRINT_3)
    expect(r.typeDistribution).toEqual([
      { name: 'Product Backlog Item', value: 16 },
      { name: 'Bug', value: 12 }
    ])
    expect(r.typeDistributionInSprint).toEqual([
      { name: 'Product Backlog Item', value: 16 },
      { name: 'Bug', value: 12 }
    ])

    const summary = summarizeDelivery(r, developmentTypesOf(state.config!, 'loja'))
    expect(summary).toEqual({
      delivered: 2,
      totalInSprint: 3,
      completionRate: 67,
      totalHoursInSprint: 28,
      devHoursInSprint: 16,
      devPercent: 57,
      typeCounts: [
        ['Product Backlog Item', 1],
        ['Bug', 1]
      ]
    })
  })

  it('a consulta usa tipos e estados do Perfil de processo, e nada fixo', async () => {
    await getSprintDeliveryData('loja', SPRINT_3)
    const [delivery] = state.azure!.queries
    expect(delivery.path).toBe('/Contoso/_apis/wit/wiql?api-version=7.1')
    expect(delivery.query).toContain(`[System.WorkItemType] IN ('Product Backlog Item', 'Bug')`)
    expect(delivery.query).toContain(`[System.State] IN ('Done')`)
    expect(delivery.query).not.toMatch(/Completed|In Progress|Tested/)
  })
})

describe('Produto com área excluída', () => {
  it('o item da área excluída não entra nem no entregue nem no planejado', async () => {
    const r = await getSprintDeliveryData('loja', SPRINT_3)
    expect(ids(r)).not.toContain(104)
    for (const { query } of state.azure!.queries) {
      expect(query).toContain(`AND NOT [System.AreaPath] UNDER 'Contoso\\Loja\\QA'`)
      expect(query).toContain(`AND ([System.AreaPath] UNDER 'Contoso\\Loja')`)
    }
  })

  it('sem a exclusão na Configuração, o mesmo item passa a contar', async () => {
    const config = deliveryConfig()
    config.products[0].excludedAreaPaths = []
    state.config = config

    const r = await getSprintDeliveryData('loja', SPRINT_3)
    expect(ids(r)).toEqual([101, 102, 104])
    expect(r.totalInSprint).toBe(4)
  })

  it('aspa no area path é escapada, não fecha o literal do WIQL', () => {
    const config = deliveryConfig()
    config.products[0].excludedAreaPaths = ["Contoso\\Loja\\D'Ávila"]
    const [product] = resolveScope('loja', config).products
    expect(productAreaClauses(product)).toContain(`UNDER 'Contoso\\Loja\\D''Ávila'`)
    expect(wiqlQuote("a'b")).toBe(`'a''b'`)
  })
})

describe('Produto Agile (App Mobile)', () => {
  it('usa Active, Resolved e Closed do Perfil de processo', async () => {
    const r = await getSprintDeliveryData('app', SPRINT_3)

    expect(ids(r)).toEqual([201, 202])
    expect(r.totalInSprint).toBe(2)
    expect(r.scopeInjectedCount).toBe(0)
    // Active 21/09 08h → Resolved 22/09 12h: termina no fim do desenvolvimento.
    expect(byId(r, 201)).toMatchObject({
      closedAt: '2026-09-30T10:00:00',
      leadTimeHours: 12,
      devTimeInSprintHours: 12
    })
    // Achado só pelo OR da iteração: foi reaberto e fechado de novo em 07/10.
    // A volta a Active depois da sprint não conta no tempo desta sprint.
    expect(byId(r, 202)).toMatchObject({
      closedAt: '2026-10-02T16:00:00',
      leadTimeHours: 23,
      devTimeInSprintHours: 23
    })
  })
})

describe('Grupo com dois Produtos de processos diferentes', () => {
  it('soma os Produtos na ordem do Grupo', async () => {
    const r = await getSprintDeliveryData('digital', SPRINT_3)

    expect(ids(r)).toEqual([101, 102, 201, 202])
    expect(r.totalInSprint).toBe(5)
    expect(r.scopeInjectedCount).toBe(1)
    expect(r.typeDistributionInSprint).toEqual([
      { name: 'Product Backlog Item', value: 16 },
      { name: 'Bug', value: 35 },
      { name: 'User Story', value: 12 }
    ])
    expect(r.typeDistribution).toEqual(r.typeDistributionInSprint)
  })

  it('números da tela: foco em desenvolvimento soma os tipos de cada Perfil', async () => {
    const r = await getSprintDeliveryData('digital', SPRINT_3)
    const devTypes = developmentTypesOf(state.config!, 'digital')
    expect(devTypes).toEqual(['Product Backlog Item', 'User Story'])

    expect(summarizeDelivery(r, devTypes)).toEqual({
      delivered: 4,
      totalInSprint: 5,
      completionRate: 80,
      totalHoursInSprint: 63,
      devHoursInSprint: 28,
      devPercent: 44,
      typeCounts: [
        ['Bug', 2],
        ['Product Backlog Item', 1],
        ['User Story', 1]
      ]
    })
  })

  it('Produto sem iteração nesta sprint fica de fora, sem consulta', async () => {
    const sprint = { ...SPRINT_3, iterations: { loja: SPRINT_3.iterations.loja } }
    const r = await getSprintDeliveryData('digital', sprint)

    expect(ids(r)).toEqual([101, 102])
    expect(r.totalInSprint).toBe(3)
    expect(state.azure!.queries.every((q) => !q.query.includes('Contoso\\App'))).toBe(true)
  })
})

describe('Produto de fluxo contínuo (Suporte)', () => {
  it('mede só pela janela, sem planejado nem injeção', async () => {
    const r = await getSprintDeliveryData('suporte', SPRINT_3)

    expect(ids(r)).toEqual([301])
    expect(r.totalInSprint).toBe(0)
    expect(r.scopeInjectedCount).toBe(0)
    // Nunca passou por Committed: vale criação → entrega. 23/09 9h → 24/09 15h.
    expect(byId(r, 301)).toMatchObject({ leadTimeHours: 13, devTimeInSprintHours: 13 })

    expect(state.azure!.queries).toHaveLength(1)
    const [{ path, query }] = state.azure!.queries
    expect(path).toBe('/Suporte/_apis/wit/wiql?api-version=7.1')
    expect(query).toContain(`[System.TeamProject] = 'Suporte'`)
    expect(query).toContain(`AND NOT [System.AreaPath] UNDER 'Suporte\\Triagem'`)
    expect(query).not.toContain('IterationPath')

    expect(summarizeDelivery(r, developmentTypesOf(state.config!, 'suporte'))).toMatchObject({
      delivered: 1,
      totalInSprint: 0,
      completionRate: 0,
      devPercent: 100
    })
  })
})

describe('seleção e casos de borda', () => {
  it('seleção fora da Configuração é erro tipado', async () => {
    await expect(getSprintDeliveryData('inexistente', SPRINT_3)).rejects.toMatchObject({
      code: 'SELECTION_UNKNOWN'
    })
  })

  it('sem nada entregue, a tela mostra zeros sem dividir por zero', () => {
    expect(summarizeDelivery(undefined, [])).toEqual({
      delivered: 0,
      totalInSprint: 0,
      completionRate: 0,
      totalHoursInSprint: 0,
      devHoursInSprint: 0,
      devPercent: 0,
      typeCounts: []
    })
  })
})
