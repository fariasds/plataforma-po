import { describe, expect, it } from 'vitest'
import type { ParsedFeatureFolder, PlannedPbi } from './flow-artifacts'
import { buildCatalogIndex, parseCatalogPage } from './flow-catalog'
import { buildFollowUp, type FollowUpInput } from './flow-follow-up'
import { parseBugAnalysis } from './flow-opportunities'
import type { FlowSnapshot, SnapshotBug } from './flow-snapshot'

// RN-FLX-21 a RN-FLX-24. Dados fictícios: organização `contoso`.

const PATTERN = 'RN-[A-Z]+-\\d+'

function bug(id: number, parentId: number | null, open = true): SnapshotBug {
  return {
    id,
    type: 'Bug',
    title: `Bug ${id}`,
    state: open ? 'Active' : 'Closed',
    parentId,
    createdDate: '',
    closedDate: null,
    open,
    description: ''
  }
}

const SNAPSHOT: FlowSnapshot = {
  version: 1,
  productId: 'loja',
  takenAt: '2026-11-26T13:00:00.000Z',
  windowStart: '2026-05-30',
  priorityField: null,
  features: [
    {
      id: 4088,
      type: 'Feature',
      title: 'Cupom por categoria',
      state: 'Active',
      parentId: null,
      priority: null,
      createdDate: '',
      stateChangeDate: null,
      childIds: [4101, 4102]
    },
    {
      id: 4090,
      type: 'Feature',
      title: 'Pagamento por Pix',
      state: 'Done',
      parentId: null,
      priority: null,
      createdDate: '',
      stateChangeDate: null,
      childIds: [4201]
    }
  ],
  children: [
    { id: 4101, type: 'Product Backlog Item', title: 'Regra', state: 'Done', parentId: 4088 },
    { id: 4102, type: 'Product Backlog Item', title: 'Tela', state: 'Committed', parentId: 4088 },
    { id: 4201, type: 'Product Backlog Item', title: 'QR', state: 'Done', parentId: 4090 }
  ],
  feedbacks: null,
  bugs: [bug(5301, 4101), bug(5302, null), bug(5303, null), bug(5304, 4090), bug(5306, null, false)]
}

const pbi = (azureId: number): PlannedPbi => ({
  key: `P${azureId}`,
  line: 1,
  type: 'DEV',
  title: '',
  azureId,
  status: 'Escrito',
  requirements: [],
  decisions: [],
  rules: []
})

const folder = (featureId: number, ids: number[]): ParsedFeatureFolder =>
  ({
    slug: `f${featureId}`,
    featureId,
    title: null,
    plan: { pbis: ids.map(pbi), justified: [] }
  }) as unknown as ParsedFeatureFolder

const CATALOG = buildCatalogIndex([
  parseCatalogPage(
    'Cupons.md',
    [
      '# Cupons',
      '### RN-CUP-004 · Um cupom por pedido',
      '`Status: Ativa` · `Validação: Não validada` · `Origem: PBI #4101`',
      '### RN-CUP-005 · Cupom por categoria',
      '`Status: Ativa` · `Validação: Não validada` · `Origem: PBI #4102`',
      '### RN-PAG-001 · QR expira',
      '`Status: Ativa` · `Validação: Validada` · `Origem: PBI #4201`'
    ].join('\n'),
    PATTERN
  )
])

const ANALYSES = [
  // Pelo Azure (filho do PBI 4101) e pela regra: mesma Feature, uma linha só.
  parseBugAnalysis(
    'bugs/BUG-5301-a.md',
    '# BUG 5301 · Duplicado\nVeredito: Bug\nViolada: RN-CUP-004\n'
  ),
  // Só pela regra.
  parseBugAnalysis(
    'bugs/BUG-5302-b.md',
    '# BUG 5302 · Outro\nVeredito: Bug\nViolada: RN-CUP-004\n'
  ),
  // Fechado há mais tempo, fora do retrato, ainda conta pela regra.
  parseBugAnalysis(
    'bugs/BUG-5299-c.md',
    '# BUG 5299 · Antigo\nVeredito: Bug\nViolada: RN-CUP-004\n'
  ),
  // "Não é bug" não conta, mesmo com o vínculo no Azure.
  parseBugAnalysis('bugs/BUG-5304-d.md', '# BUG 5304 · Uso\nVeredito: Não é bug\n')
]

const INPUT: FollowUpInput = {
  productId: 'loja',
  snapshot: SNAPSHOT,
  analyses: ANALYSES,
  folders: [folder(4088, [4101, 4102]), folder(4090, [4201])],
  catalog: CATALOG,
  deliveredStates: ['Done'],
  workFolder: 'ok'
}

describe('o acompanhamento', () => {
  const view = buildFollowUp(INPUT)

  it('bug aberto sem análise espera a IA (RN-FLX-21); o fechado não', () => {
    expect(view.unanalyzed.map((b) => b.id)).toEqual([5303])
  })

  it('bugs por Feature pelos dois caminhos, sem repetir, sem "Não é bug" (RN-FLX-22)', () => {
    expect(view.byFeature).toHaveLength(1)
    expect(view.byFeature[0].featureId).toBe(4088)
    expect(view.byFeature[0].bugs.map((b) => [b.id, b.via])).toEqual([
      [5299, 'regra'],
      [5301, 'ambos'],
      [5302, 'regra']
    ])
  })

  it('bug sem análise já aparece na Feature pelo vínculo do Azure', () => {
    const result = buildFollowUp({ ...INPUT, analyses: [] })
    expect(result.byFeature.map((f) => [f.featureId, f.bugs.map((b) => [b.id, b.via])])).toEqual([
      [4088, [[5301, 'azure']]],
      [4090, [[5304, 'azure']]]
    ])
  })

  it('bugs por regra violada, só com veredito "Bug" (RN-FLX-23)', () => {
    expect(view.byRule).toEqual([
      { rule: 'RN-CUP-004', title: 'Um cupom por pedido', bugs: [5299, 5301, 5302] }
    ])
  })

  it('regra não validada com PBI entregue fica a conferir (RN-FLX-24)', () => {
    expect(view.toConfirm.map((r) => [r.rule, r.pbi, r.pbiState])).toEqual([
      ['RN-CUP-004', 4101, 'Done']
    ])
  })

  it('sem catálogo, sem caminho pela regra e sem regra a conferir', () => {
    const result = buildFollowUp({ ...INPUT, catalog: null })
    expect(result.catalogConfigured).toBe(false)
    expect(result.toConfirm).toEqual([])
    expect(result.byFeature[0].bugs.map((b) => b.via)).toEqual(['azure'])
  })
})
