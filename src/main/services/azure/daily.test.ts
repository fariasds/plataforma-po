import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import type { DailyItem } from '@shared/dashboards'
import {
  at,
  dailyConfig,
  dailySprint,
  history,
  task,
  workItem,
  type DailyTaskFixture,
  type DailyWorkItem
} from '../../../../tests/fixtures/azure/daily-contoso'

/**
 * A Daily contra um Azure fictício: o cliente HTTP é trocado por um roteador que
 * responde com as fixtures, e a Configuração ativa é a do cenário.
 */

const azure = vi.hoisted(() => ({
  config: null as Configuration | null,
  items: [] as DailyWorkItem[],
  tasks: [] as DailyTaskFixture[],
  queries: [] as string[],
  fieldLists: [] as string[]
}))

vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => azure.config }))

vi.mock('./client', () => ({
  postAzure: async (_path: string, body: { query: string }) => {
    azure.queries.push(body.query)
    const source = body.query.includes("[System.WorkItemType] = 'Tarefa'")
      ? azure.tasks
      : azure.items
    return { workItems: source.map((w) => ({ id: w.id })) }
  },
  fetchAzure: async (path: string) => {
    const updates = path.match(/workitems\/(\d+)\/updates/)
    if (updates) {
      return { value: azure.items.find((w) => w.id === Number(updates[1]))?.updates ?? [] }
    }
    const fields = new URL(`https://x${path}`).searchParams.get('fields') ?? ''
    azure.fieldLists.push(fields)
    const source: Array<{ id: number; fields: Record<string, unknown> }> = fields.includes(
      'System.Parent'
    )
      ? azure.tasks
      : azure.items
    return { value: source.map(({ id, fields }) => ({ id, fields })) }
  },
  fetchAzureAvatar: async () => null
}))

const { getDailyData } = await import('./daily')

function byId(items: DailyItem[], id: number): DailyItem {
  const item = items.find((i) => i.id === id)
  if (!item) throw new Error(`item ${id} ausente`)
  return item
}

beforeEach(() => {
  azure.config = dailyConfig()
  azure.items = []
  azure.tasks = []
  azure.queries = []
  azure.fieldLists = []
})

describe('Daily — risco por item com o relógio fixo', () => {
  // Sprint de 2 a 13 de março de 2026: 10 dias de semana, sem feriado nacional.
  // Hoje é sexta, dia 5, meio-dia.
  const sprint = dailySprint('2026-03-02', '2026-03-13')
  const now = new Date(2026, 2, 6, 12, 0)

  beforeEach(() => {
    azure.items = [
      // 3 SP = 12h ÷ 6 = 2 dias. Seg 09h até sex 12h = 31h úteis ÷ 7h = 5 dias.
      workItem(101, 'Em construção', 3, history(['Em construção', at(2026, 3, 2, 9)]), {
        'Contoso.Retrabalho': 2
      }),
      // 5 SP = 4 dias, não iniciado: projeta de hoje (5) até o dia 8.
      workItem(102, 'Novo', 5, history()),
      // 8 SP = 6 dias, não iniciado: termina exatamente no dia 10.
      workItem(103, 'Novo', 8, history()),
      // 13 SP = 10 dias, iniciado no dia 4: projeta o dia 13, mas está em validação.
      workItem(
        104,
        'Em validação',
        13,
        history(['Em construção', at(2026, 3, 5, 9)], ['Em validação', at(2026, 3, 5, 15)])
      ),
      // Sem estimativa: não há o que julgar.
      workItem(105, 'Em construção', null, history(['Em construção', at(2026, 3, 4, 9)])),
      // Construído na terça às 17h: 14h úteis ÷ 7h = 2 dias, dentro dos 2 estimados.
      workItem(
        106,
        'Construído',
        3,
        history(['Em construção', at(2026, 3, 2, 9)], ['Construído', at(2026, 3, 3, 17)])
      )
    ]
    azure.tasks = [
      task(901, 101, 'Entregue'),
      task(902, 101, 'Em construção'),
      task(903, 101, 'Descartado')
    ]
  })

  it('classifica cada item pela régua da Configuração', async () => {
    const result = await getDailyData('loja', sprint, now)

    expect(result).toMatchObject({
      sprintDays: 10,
      holidayDays: [],
      workingDays: 10,
      currentDay: 5,
      remainingDays: 6,
      weekBreakDay: 5,
      inProgressCount: 3
    })

    expect(byId(result.items, 101)).toMatchObject({
      status: 'in-progress',
      estimateDays: 2,
      startDay: 1,
      consumedDays: 5,
      risk: 'over-estimate',
      reworkTimes: 2,
      product: 'loja'
    })
    expect(byId(result.items, 102)).toMatchObject({
      status: 'not-started',
      projectedEndDay: 8,
      risk: 'on-track'
    })
    expect(byId(result.items, 103)).toMatchObject({ projectedEndDay: 10, risk: 'at-limit' })
    expect(byId(result.items, 104)).toMatchObject({
      status: 'in-progress',
      startDay: 4,
      projectedEndDay: 13,
      risk: 'awaiting-test'
    })
    expect(byId(result.items, 105)).toMatchObject({ estimateDays: null, risk: 'unknown' })
    expect(byId(result.items, 106)).toMatchObject({
      status: 'done',
      doneDay: 2,
      consumedDays: 2,
      risk: 'on-track'
    })
    // Ausência do campo no item é zero, não erro.
    expect(byId(result.items, 102).reworkTimes).toBe(0)

    // Maior complexidade no topo; sem estimativa no fim.
    expect(result.items.map((i) => i.id)).toEqual([104, 103, 102, 101, 106, 105])
  })

  it('conta como concluída a task em qualquer estado terminal do processo', async () => {
    const { items } = await getDailyData('loja', sprint, now)
    expect(byId(items, 101).tasks.map((t) => [t.id, t.done])).toEqual([
      [901, true],
      [902, false],
      [903, true]
    ])
  })

  it('consulta o Azure com tipos, estados e áreas da Configuração', async () => {
    await getDailyData('loja', sprint, now)
    const [itemsQuery, tasksQuery] = azure.queries

    expect(itemsQuery).toContain("[System.WorkItemType] IN ('Product Backlog Item')")
    expect(itemsQuery).toContain("[System.State] NOT IN ('Descartado')")
    expect(itemsQuery).toContain("AND ([System.AreaPath] UNDER 'Contoso\\Loja')")
    expect(itemsQuery).toContain("AND NOT [System.AreaPath] UNDER 'Contoso\\Loja\\QA'")
    expect(itemsQuery).toContain("[System.IterationPath] = 'Contoso\\Sprint 7'")
    expect(tasksQuery).toContain("[System.WorkItemType] = 'Tarefa'")
    expect(azure.fieldLists).toContain(
      'System.Id,System.Title,System.State,System.WorkItemType,Microsoft.VSTS.Scheduling.StoryPoints,System.AssignedTo,Contoso.Retrabalho'
    )
  })
})

describe('Daily — sprint que atravessa feriado nacional de 2027', () => {
  // Tiradentes, quarta 21/04/2027: calculado pelo país, sem tabela a manter.
  const sprint = dailySprint('2027-04-19', '2027-04-30')
  const now = new Date(2027, 3, 19, 10, 0)

  it('o feriado ocupa casa, não produz, e empurra a projeção', async () => {
    azure.items = [
      workItem(201, 'Em construção', 13, history(['Em construção', at(2027, 4, 19, 9)]))
    ]

    const result = await getDailyData('loja', sprint, now)

    expect(result).toMatchObject({
      sprintDays: 10,
      holidayDays: [3],
      workingDays: 9,
      currentDay: 1,
      remainingDays: 9
    })
    // 10 dias de trabalho a partir do dia 1, pulando o dia 3: termina no 11.
    expect(byId(result.items, 201)).toMatchObject({ projectedEndDay: 11, risk: 'over-sprint' })
  })
})

describe('Daily — processo sem estado de teste nem campo de retrabalho', () => {
  const sprint = dailySprint('2026-03-02', '2026-03-13')
  const now = new Date(2026, 2, 6, 12, 0)

  beforeEach(() => {
    azure.config = dailyConfig({ profile: { testingState: null }, reworkCount: null })
    azure.items = [
      workItem(
        301,
        'Em validação',
        13,
        history(['Em construção', at(2026, 3, 5, 9)], ['Em validação', at(2026, 3, 5, 15)]),
        { 'Contoso.Retrabalho': 3 }
      )
    ]
  })

  it('não abranda: a projeção estourada é estouro', async () => {
    const { items } = await getDailyData('loja', sprint, now)
    expect(byId(items, 301).risk).toBe('over-sprint')
  })

  it('não pede o campo ao Azure e não mostra retrabalho', async () => {
    const { items } = await getDailyData('loja', sprint, now)
    expect(byId(items, 301).reworkTimes).toBe(0)
    expect(azure.fieldLists.join()).not.toContain('Contoso.Retrabalho')
  })
})
