import { describe, expect, it } from 'vitest'
import type { PlanningItem } from '@shared/dashboards'
import {
  capacityHours,
  capacityRatio,
  capacityStatus,
  comparePlanningItems,
  resolveCapacity
} from './planning-rules'

function item(id: number, fields: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id,
    title: `Item ${id}`,
    state: 'Approved',
    product: 'loja-online',
    frontend: 0,
    backend: 0,
    qa: 0,
    total: 0,
    priority: 2,
    ...fields
  }
}

const order = (items: PlanningItem[]): number[] =>
  [...items].sort(comparePlanningItems).map((i) => i.id)

describe('comparePlanningItems (RN-PLN-04)', () => {
  it('põe a prioridade 1 no topo', () => {
    expect(
      order([item(1, { priority: 3 }), item(2, { priority: 1 }), item(3, { priority: 2 })])
    ).toEqual([2, 3, 1])
  })

  it('manda item sem prioridade para o fim', () => {
    expect(order([item(1, { priority: null }), item(2, { priority: 4 })])).toEqual([2, 1])
  })

  it('na mesma prioridade, a maior complexidade total vem primeiro', () => {
    expect(order([item(1, { total: 5 }), item(2, { total: 13 }), item(3, { total: 8 })])).toEqual([
      2, 3, 1
    ])
  })

  it('no mesmo total, desempata por frontend, depois backend, depois QA', () => {
    const front = [
      item(1, { total: 13, frontend: 3, backend: 8, qa: 2 }),
      item(2, { total: 13, frontend: 5, backend: 5, qa: 3 })
    ]
    expect(order(front)).toEqual([2, 1])

    const back = [
      item(1, { total: 13, frontend: 5, backend: 3, qa: 5 }),
      item(2, { total: 13, frontend: 5, backend: 5, qa: 3 })
    ]
    expect(order(back)).toEqual([2, 1])

    const qa = [
      item(1, { total: 13, frontend: 5, backend: 5, qa: 2 }),
      item(2, { total: 13, frontend: 5, backend: 5, qa: 3 })
    ]
    expect(order(qa)).toEqual([2, 1])
  })

  it('a prioridade vence a complexidade', () => {
    expect(
      order([item(1, { priority: 2, total: 21 }), item(2, { priority: 1, total: 1 })])
    ).toEqual([2, 1])
  })

  it('ponto não estimado empata com zero', () => {
    const items = [
      item(1, { total: null, frontend: null, backend: null, qa: null }),
      item(2, { total: 0, frontend: 0, backend: 0, qa: 0 }),
      item(3, { total: 3 })
    ]
    expect(order(items)).toEqual([3, 1, 2])
  })

  it('empate completo cai no menor ID, seja qual for a ordem de entrada', () => {
    const items = [item(30), item(10), item(20)]
    expect(order(items)).toEqual([10, 20, 30])
    expect(order([...items].reverse())).toEqual([10, 20, 30])
  })
})

describe('capacityStatus (RN-PLN-17)', () => {
  it.each([
    [0, 'ok'],
    [0.9, 'ok'],
    [0.9499, 'ok'],
    [0.95, 'warning'],
    [0.99, 'warning'],
    [1, 'warning'],
    [1.0001, 'over'],
    [1.75, 'over']
  ] as const)('%f da capacidade é %s', (ratio, status) => {
    expect(capacityStatus(ratio)).toBe(status)
  })

  it('sem capacidade a razão é zero, não infinito', () => {
    expect(capacityRatio(40, 0)).toBe(0)
    expect(capacityRatio(48, 96)).toBe(0.5)
  })
})

describe('capacityHours (RN-PLN-15)', () => {
  it('multiplica devs, horas produtivas e dias, descontando a reserva de bugs', () => {
    const config = {
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
    expect(capacityHours(config, 6)).toEqual({ frontend: 96, backend: 144 })
  })

  it('desconta a reserva de bugs de cada disciplina separadamente', () => {
    const config = {
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 50,
      backBugPercent: 0
    }
    expect(capacityHours(config, 6)).toEqual({ frontend: 60, backend: 180 })
  })

  it('aceita dev fracionário (RN-PLN-16)', () => {
    const config = {
      frontDevs: 2.5,
      backDevs: 0,
      sprintDays: 10,
      frontBugPercent: 0,
      backBugPercent: 0
    }
    expect(capacityHours(config, 6)).toEqual({ frontend: 150, backend: 0 })
  })
})

describe('resolveCapacity (RN-PLN-16)', () => {
  const defaults = {
    frontDevs: 2,
    backDevs: 3,
    sprintDays: 10,
    frontBugPercent: 20,
    backBugPercent: 30
  }

  it('sem nada gravado, segue a Configuração', () => {
    expect(resolveCapacity(defaults, {})).toEqual(defaults)
  })

  it('o percentual único gravado antes da separação vale para as duas disciplinas', () => {
    expect(resolveCapacity(defaults, { bugPercent: 10 })).toMatchObject({
      frontBugPercent: 10,
      backBugPercent: 10
    })
  })

  it('o percentual da disciplina editado depois vence o único', () => {
    expect(resolveCapacity(defaults, { bugPercent: 10, backBugPercent: 40 })).toMatchObject({
      frontBugPercent: 10,
      backBugPercent: 40
    })
  })
})
