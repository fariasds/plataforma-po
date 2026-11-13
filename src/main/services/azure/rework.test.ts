import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import {
  REWORK_FIELD,
  SPRINT_2,
  SPRINT_3,
  createFakeAzure,
  deliveryConfig,
  type FakeAzure
} from '../../../../tests/fixtures/azure/delivery-contoso'

// Retrabalho contra o Azure fictício de Entregas (organização contoso). O
// indicador lê o campo de `customFields.reworkCount` dos itens entregues entre o
// início da primeira sprint e o fim da última, por data de fechamento.

const state = vi.hoisted(() => ({
  config: null as Configuration | null,
  azure: null as FakeAzure | null
}))

vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => state.config }))
vi.mock('./client', () => ({
  fetchAzure: (path: string) => state.azure!.fetchAzure(path),
  postAzure: (path: string, body: unknown) => state.azure!.postAzure(path, body)
}))

const { getReworkData } = await import('./rework')

const SPRINTS = [SPRINT_2, SPRINT_3]

beforeEach(() => {
  state.config = deliveryConfig()
  state.azure = createFakeAzure()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('Produto Scrum com área excluída (Loja Online)', () => {
  it('conta os fechados na sprint e quantos voltaram, por número de voltas', async () => {
    const r = await getReworkData('loja', SPRINTS)

    // 101 (2 voltas), 102 (sem valor = 0) e 105 (1 volta) fecharam na Sprint 3.
    // 104 (5 voltas) está em área excluída e 106 é Task.
    expect(r.unavailable).toBeUndefined()
    expect(r.sprintSlots).toEqual([
      {
        key: SPRINT_3.key,
        label: 'Sprint 3',
        fullLabel: SPRINT_3.label,
        total: 3,
        reworkCount: 2,
        reworkRate: 67,
        breakdown: [
          { times: 2, count: 1 },
          { times: 1, count: 1 }
        ]
      }
    ])
    expect(r.monthSlots).toEqual([
      {
        key: '2026-09',
        label: 'Set/26',
        fullLabel: 'Setembro de 2026',
        total: 3,
        reworkCount: 2,
        reworkRate: 67,
        breakdown: [
          { times: 2, count: 1 },
          { times: 1, count: 1 }
        ]
      }
    ])
  })

  it('pede o campo da Configuração e usa os estados de entrega do Perfil', async () => {
    await getReworkData('loja', SPRINTS)
    const [{ query }] = state.azure!.queries
    expect(query).toContain(`[System.State] IN ('Done')`)
    expect(query).toContain(`AND NOT [System.AreaPath] UNDER 'Contoso\\Loja\\QA'`)
    expect(query).toContain(`[Microsoft.VSTS.Common.ClosedDate] >= '2026-09-07'`)
    expect(query).toContain(`[Microsoft.VSTS.Common.ClosedDate] <= '2026-10-02'`)
  })
})

describe('Grupo com dois Produtos de processos diferentes', () => {
  it('soma os itens de cada Produto, cada um com o próprio estado de entrega', async () => {
    const r = await getReworkData('digital', SPRINTS)

    // + 201 (Closed em 30/09, 1 volta). 202 fechou de novo em 07/10, fora do período.
    expect(r.sprintSlots).toHaveLength(1)
    expect(r.sprintSlots[0]).toMatchObject({
      total: 4,
      reworkCount: 3,
      reworkRate: 75,
      breakdown: [
        { times: 2, count: 1 },
        { times: 1, count: 2 }
      ]
    })
    const states = state.azure!.queries.map(
      (q) => q.query.match(/\[System\.State\] IN \(([^)]*)\)/)![1]
    )
    expect(states).toEqual([`'Done'`, `'Closed'`])
  })
})

describe('Produto de fluxo contínuo (Suporte)', () => {
  it('entra pela data de fechamento, sem iteração', async () => {
    const r = await getReworkData('suporte', SPRINTS)
    expect(r.sprintSlots).toEqual([
      expect.objectContaining({ total: 1, reworkCount: 0, reworkRate: 0, breakdown: [] })
    ])
  })
})

describe('Produto sem campo de retrabalho', () => {
  it('não calcula, não consulta o Azure e diz o que configurar', async () => {
    state.config = deliveryConfig({ reworkField: null })

    const r = await getReworkData('loja', SPRINTS)

    expect(r).toEqual({
      sprintSlots: [],
      monthSlots: [],
      unavailable: 'customFields.reworkCount'
    })
    expect(state.azure!.queries).toEqual([])
  })

  it('o campo configurado é o que entra na lista de campos pedida', async () => {
    const fetchSpy = vi.spyOn(state.azure!, 'fetchAzure')
    await getReworkData('loja', SPRINTS)
    const paths = fetchSpy.mock.calls.map(([path]) => path)
    expect(
      paths.some((p) =>
        p.includes(`fields=System.Id,Microsoft.VSTS.Common.ClosedDate,${REWORK_FIELD}`)
      )
    ).toBe(true)
  })
})
