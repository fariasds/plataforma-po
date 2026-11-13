import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AzureIteration } from '@shared/azure'
import { buildUnifiedSprints } from './sprint-utils'

// Caracterização com iterações fictícias de Produtos da organização contoso
// ("Loja Online", "App Mobile" e "Portal"). Os casos de âncora e limite vêm da
// T-02, com dois Produtos; a T-07 acrescentou um e três.

function iteration(name: string, start: string, finish: string): AzureIteration {
  return {
    id: `id-${name}`,
    name,
    path: `Contoso\\${name}`,
    attributes: {
      startDate: `${start}T00:00:00Z`,
      finishDate: `${finish}T00:00:00Z`,
      timeFrame: 'current'
    }
  }
}

// Quatro sprints de duas semanas; entre S1 e S2 há um intervalo de 05/09 a 07/09.
const PERIODS = {
  s1: ['2026-08-24', '2026-09-04'],
  s2: ['2026-09-08', '2026-09-18'],
  s3: ['2026-09-21', '2026-10-02'],
  s4: ['2026-10-05', '2026-10-16']
} as const

const loja = Object.entries(PERIODS).map(([k, [s, f]]) => iteration(`Loja ${k}`, s, f))
const app = [iteration('App s3', ...PERIODS.s3)]

/** O par da caracterização da T-02: Loja com as quatro sprints, App só com a s3. */
const two = [
  { productId: 'loja', iterations: loja },
  { productId: 'app', iterations: app }
]

const keyOf = (period: readonly [string, string]): string => `${period[0]}_${period[1]}`

function setToday(year: number, month: number, day: number): void {
  vi.setSystemTime(new Date(year, month - 1, day, 10, 0, 0))
}

describe('buildUnifiedSprints', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ancora na sprint atual e devolve ela e as anteriores, da mais nova para a mais antiga', () => {
    setToday(2026, 9, 24)
    const sprints = buildUnifiedSprints(two)
    expect(sprints.map((s) => s.key)).toEqual([
      keyOf(PERIODS.s3),
      keyOf(PERIODS.s2),
      keyOf(PERIODS.s1)
    ])
  })

  it('une as iterações dos dois Produtos que correm no mesmo período', () => {
    setToday(2026, 9, 24)
    const [current, previous] = buildUnifiedSprints(two)
    expect(current.iterations.loja?.name).toBe('Loja s3')
    expect(current.iterations.app?.name).toBe('App s3')
    expect(previous.iterations.loja?.name).toBe('Loja s2')
    expect(previous.iterations.app).toBeUndefined()
    expect(current.startDate).toBe('2026-09-21T00:00:00Z')
    expect(current.label).toContain('→')
  })

  it('respeita o limite', () => {
    setToday(2026, 10, 7)
    const sprints = buildUnifiedSprints(two, 2)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s4), keyOf(PERIODS.s3)])
  })

  it('no intervalo entre sprints, sem preferFuture, ancora na última sprint encerrada', () => {
    setToday(2026, 9, 7)
    const sprints = buildUnifiedSprints(two)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s1)])
  })

  it('no intervalo entre sprints, com preferFuture, ancora na próxima sprint', () => {
    setToday(2026, 9, 7)
    const sprints = buildUnifiedSprints(two, 1, true)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s2)])
  })

  it('com preferFuture, devolve a âncora e as seguintes, da mais próxima para a mais distante', () => {
    setToday(2026, 9, 7)
    const sprints = buildUnifiedSprints(two, 5, true)
    expect(sprints.map((s) => s.key)).toEqual([
      keyOf(PERIODS.s2),
      keyOf(PERIODS.s3),
      keyOf(PERIODS.s4)
    ])
  })

  it('com preferFuture, respeita o limite das sprints seguintes', () => {
    setToday(2026, 8, 25)
    const sprints = buildUnifiedSprints(two, 2, true)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s1), keyOf(PERIODS.s2)])
  })

  it('o último dia da sprint ainda conta como sprint atual', () => {
    setToday(2026, 9, 18)
    const sprints = buildUnifiedSprints(two, 1, true)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s2)])
  })

  it('com todas as sprints no futuro e sem preferFuture, cai na mais nova', () => {
    setToday(2026, 1, 5)
    const sprints = buildUnifiedSprints(two, 5)
    expect(sprints[0].key).toBe(keyOf(PERIODS.s4))
  })

  it('com todas as sprints no passado e preferFuture, ancora na mais recente encerrada', () => {
    setToday(2026, 12, 1)
    const sprints = buildUnifiedSprints(two, 1, true)
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s4)])
  })

  it('sem iterações, devolve lista vazia', () => {
    setToday(2026, 9, 24)
    expect(buildUnifiedSprints([])).toEqual([])
  })

  it('com um Produto só, cada iteração vira uma sprint', () => {
    setToday(2026, 9, 24)
    const sprints = buildUnifiedSprints([{ productId: 'loja', iterations: loja }])
    expect(sprints.map((s) => s.key)).toEqual([
      keyOf(PERIODS.s3),
      keyOf(PERIODS.s2),
      keyOf(PERIODS.s1)
    ])
    expect(sprints.map((s) => Object.keys(s.iterations))).toEqual([['loja'], ['loja'], ['loja']])
  })

  it('com três Produtos, une por período e mantém a ordem dos Produtos', () => {
    setToday(2026, 9, 24)
    // O Portal numera diferente e entra primeiro na lista de iterações dele.
    const portal = [iteration('Portal 40', ...PERIODS.s3), iteration('Portal 39', ...PERIODS.s2)]
    const [current, previous, oldest] = buildUnifiedSprints([
      ...two,
      { productId: 'portal', iterations: portal }
    ])
    expect(Object.keys(current.iterations)).toEqual(['loja', 'app', 'portal'])
    expect(current.iterations.portal?.name).toBe('Portal 40')
    expect(Object.keys(previous.iterations)).toEqual(['loja', 'portal'])
    expect(Object.keys(oldest.iterations)).toEqual(['loja'])
  })

  it('período em que só um Produto tem sprint ainda vira sprint unificada', () => {
    setToday(2026, 9, 24)
    const sprints = buildUnifiedSprints([
      { productId: 'loja', iterations: [] },
      { productId: 'app', iterations: app }
    ])
    expect(sprints.map((s) => s.key)).toEqual([keyOf(PERIODS.s3)])
    expect(Object.keys(sprints[0].iterations)).toEqual(['app'])
  })
})
