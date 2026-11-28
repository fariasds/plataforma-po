import { describe, expect, it } from 'vitest'
import type { BoardFeature, FlowBoard } from './flow-board'
import {
  applyRoadmapChange,
  buildRoadmap,
  buildTimeline,
  cascadePlan,
  DEFAULT_ROADMAP_SETTINGS,
  EMPTY_ROADMAP,
  loadStatus,
  milestoneDiff,
  parseRoadmapFile,
  RoadmapChangeSchema,
  suggestStart,
  type RoadmapFile,
  type RoadmapProductInput
} from './roadmap'

// RN-RDM-01 a RN-RDM-21. Dados fictícios: organização `contoso`.

/** Sprints de duas semanas a partir de 2026-08-24; hoje cai na sétima. */
const SPRINTS = Array.from({ length: 7 }, (_, i) => {
  const start = new Date(Date.UTC(2026, 7, 24 + i * 14))
  const finish = new Date(start.getTime() + 11 * 86_400_000)
  return {
    startDate: start.toISOString(),
    finishDate: finish.toISOString(),
    label: `Sprint ${i + 1}`
  }
})
const TODAY = '2026-11-26'
const day = (i: number): string =>
  new Date(Date.UTC(2026, 7, 24 + i * 14)).toISOString().slice(0, 10)

function feature(over: Partial<BoardFeature>): BoardFeature {
  return {
    key: '#1',
    featureId: 1,
    slug: null,
    title: 'F',
    azureState: 'New',
    priority: null,
    phase: 'Discovery',
    readmePhase: null,
    checklist: null,
    pendencies: [],
    divergences: [],
    staleDays: null,
    stale: false,
    rules: [],
    plan: null,
    reconciliation: { pbis: [], feature: null },
    ...over
  }
}

function product(
  productId: string,
  features: BoardFeature[],
  file: RoadmapFile,
  extra: Partial<RoadmapProductInput> = {}
): RoadmapProductInput {
  const board: FlowBoard = { productId, workFolder: 'ok', snapshotTakenAt: null, features }
  return {
    productId,
    board,
    file,
    error: null,
    opportunities: new Map(),
    children: [],
    plannedDev: new Map(),
    deliveredStates: ['Done'],
    terminalStates: ['Done', 'Removed'],
    pbiTypes: ['Product Backlog Item'],
    ...extra
  }
}

const plan = (d: number, q: number, l: number, len = 2): RoadmapFile['features'][string] => ({
  discovery: { start: day(d), length: len },
  quebra: { start: day(q), length: len },
  delivery: { start: day(l), length: len },
  archived: false
})

describe('a linha do tempo (RN-RDM-15)', () => {
  it('projeta as sprints que o Azure ainda não tem, pela cadência', () => {
    const { sprints, current } = buildTimeline(SPRINTS, TODAY, 4)
    expect(current).toBe(6)
    expect(sprints).toHaveLength(11)
    expect(sprints[7]).toMatchObject({ start: '2026-11-30', finish: '2026-12-11', projected: true })
  })

  it('na criação, as três Janelas coladas (RN-RDM-06)', () => {
    const { sprints } = buildTimeline(SPRINTS, TODAY, 6)
    const p = cascadePlan(sprints, 6)
    expect([p.discovery.start, p.quebra.start, p.delivery.start]).toEqual([
      sprints[6].start,
      sprints[8].start,
      sprints[10].start
    ])
  })
})

describe('plano e fato', () => {
  it('Janela que terminou sem a Fase esperada fica fora da Janela (RN-RDM-17)', () => {
    const view = buildRoadmap({
      products: [
        product(
          'loja',
          [
            feature({ key: '#1', featureId: 1, phase: 'Discovery' }),
            feature({ key: '#2', featureId: 2, phase: 'Em quebra' })
          ],
          { ...EMPTY_ROADMAP, features: { '#1': plan(2, 4, 6), '#2': plan(2, 4, 6) } }
        )
      ],
      sprints: SPRINTS,
      today: TODAY,
      settings: DEFAULT_ROADMAP_SETTINGS
    })
    const out = (key: string): string[] =>
      view.features
        .find((f) => f.key === key)!
        .windows.filter((w) => w.outOfWindow)
        .map((w) => w.kind)
    expect(out('#1')).toEqual(['discovery', 'quebra'])
    // Chegou à Quebra: o Discovery está cumprido; a Quebra terminou sem Publicada.
    expect(out('#2')).toEqual(['quebra'])
    expect(view.features[0].currentWindow).toBe('delivery')
  })

  it('progresso de Delivery pelo plano; sem plano, pelos filhos no Azure (RN-RDM-19)', () => {
    const view = buildRoadmap({
      products: [
        product(
          'loja',
          [feature({ key: '#1', featureId: 1, slug: 'um' }), feature({ key: '#2', featureId: 2 })],
          EMPTY_ROADMAP,
          {
            plannedDev: new Map([['um', [11, 12]]]),
            children: [
              { id: 11, parentId: 1, state: 'Done', type: 'Product Backlog Item' },
              { id: 12, parentId: 1, state: 'New', type: 'Product Backlog Item' },
              { id: 21, parentId: 2, state: 'Done', type: 'Product Backlog Item' },
              { id: 22, parentId: 2, state: 'Removed', type: 'Product Backlog Item' }
            ]
          }
        )
      ],
      sprints: SPRINTS,
      today: TODAY,
      settings: DEFAULT_ROADMAP_SETTINGS
    })
    expect(view.features.map((f) => f.delivery)).toEqual([
      { done: 1, total: 2, source: 'plano' },
      { done: 1, total: 1, source: 'azure' }
    ])
  })

  it('o rascunho adotado mantém o plano (RN-RDM-02); rascunho vem por último (RN-RDM-20)', () => {
    const view = buildRoadmap({
      products: [
        product(
          'loja',
          [
            feature({ key: 'pasta:nova', featureId: null, slug: 'nova', azureState: null }),
            feature({ key: '#9', featureId: 9, slug: 'adotada', priority: 10 }),
            feature({ key: '#8', featureId: 8, priority: 30 })
          ],
          { ...EMPTY_ROADMAP, features: { 'pasta:adotada': plan(6, 7, 8) } }
        )
      ],
      sprints: SPRINTS,
      today: TODAY,
      settings: DEFAULT_ROADMAP_SETTINGS
    })
    expect(view.features.map((f) => f.key)).toEqual(['#8', '#9', 'pasta:nova'])
    expect(view.features[1].plan?.discovery.start).toBe(day(6))
  })
})

describe('sobrecarga', () => {
  it('soma todos os Produtos, sem filtro (RN-RDM-12), com as faixas (RN-RDM-11)', () => {
    const view = buildRoadmap({
      products: [
        product('loja', [feature({ key: '#1', featureId: 1 })], {
          ...EMPTY_ROADMAP,
          features: { '#1': plan(6, 8, 10) }
        }),
        product(
          'app',
          [feature({ key: '#2', featureId: 2 }), feature({ key: '#3', featureId: 3 })],
          {
            ...EMPTY_ROADMAP,
            features: { '#2': plan(6, 8, 10), '#3': plan(6, 8, 10) }
          }
        )
      ],
      sprints: SPRINTS,
      today: TODAY,
      settings: DEFAULT_ROADMAP_SETTINGS
    })
    // Três Discoveries na sprint corrente: peso 3 de 2 em Produto/UX.
    expect(view.load[6].produto).toEqual({ weight: 3, features: 3, status: 'sobrecarga' })
    // Três Quebras: 1,5 de 3 no Time Técnico.
    expect(view.load[8].tecnico).toEqual({ weight: 1.5, features: 3, status: 'dentro' })
    expect(loadStatus(2, 2)).toBe('limite')
  })

  it('arquivada some da soma, mas guarda o plano (RN-RDM-03)', () => {
    const file = applyRoadmapChange(
      { ...EMPTY_ROADMAP, features: { '#1': plan(6, 8, 10) } },
      { kind: 'archive', key: '#1', archived: true }
    )
    const view = buildRoadmap({
      products: [product('loja', [feature({ key: '#1', featureId: 1 })], file)],
      sprints: SPRINTS,
      today: TODAY,
      settings: DEFAULT_ROADMAP_SETTINGS
    })
    expect(view.features[0]).toMatchObject({ archived: true })
    expect(view.load[6].produto.weight).toBe(0)
  })

  it('sugere a primeira sprint em que a Janela cabe (RN-RDM-14)', () => {
    const features = [1, 2].map((n) => ({
      key: `#${n}`,
      windows: [
        { kind: 'discovery' as const, start: '', length: 2, from: 6, end: 7, outOfWindow: false }
      ]
    }))
    expect(
      suggestStart({
        features,
        key: '#3',
        kind: 'discovery',
        length: 2,
        from: 6,
        sprints: 12,
        settings: DEFAULT_ROADMAP_SETTINGS
      })
    ).toBe(8)
  })
})

describe('o arquivo e o marco', () => {
  it('arquivo que não valida vira plano vazio, com o motivo', () => {
    expect(parseRoadmapFile('{"version":2}').error).not.toBeNull()
    expect(parseRoadmapFile(null)).toEqual({ file: EMPTY_ROADMAP, error: null })
  })

  it('a chave da Feature não aceita caminho', () => {
    expect(
      RoadmapChangeSchema.safeParse({ kind: 'archive', key: 'pasta:../x', archived: true }).success
    ).toBe(false)
    expect(
      RoadmapChangeSchema.safeParse({ kind: 'archive', key: '#12', archived: true }).success
    ).toBe(true)
  })

  it('o marco mostra o que mudou desde ele (RN-RDM-21)', () => {
    let file: RoadmapFile = {
      ...EMPTY_ROADMAP,
      features: { '#1': plan(2, 4, 6), '#2': plan(2, 4, 6) }
    }
    file = applyRoadmapChange(file, {
      kind: 'milestone',
      name: 'Revisão',
      takenAt: '2026-11-01T00:00:00Z'
    })
    file = applyRoadmapChange(file, { kind: 'plan', key: '#1', plan: plan(2, 5, 6) })
    file = applyRoadmapChange(file, { kind: 'archive', key: '#2', archived: true })
    file = applyRoadmapChange(file, { kind: 'plan', key: '#3', plan: plan(6, 8, 10) })
    expect(milestoneDiff(file.milestones[0], file).map((c) => [c.kind, c.key])).toEqual([
      ['movida', '#1'],
      ['arquivada', '#2'],
      ['entrou', '#3']
    ])
  })
})
