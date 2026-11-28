import { describe, expect, it } from 'vitest'
import { parseFeatureFolder, type FeatureFolderFiles } from './flow-artifacts'
import { STALE_DAYS, buildFlowBoard, type BoardInput, type RuleCatalog } from './flow-board'
import type { FlowSnapshot } from './flow-snapshot'

// RN-FLX-05 a RN-FLX-11, RN-FLX-18, RN-FLX-19. Dados fictícios: organização `contoso`.

const NOW = new Date('2026-11-26T10:00:00')
const DAY = 24 * 60 * 60 * 1000

const BRIEF = [
  '## 1. Problema',
  'Dor.',
  '## 2. Para quem',
  'Cliente.',
  '## 5. Objetivo e métrica',
  'Meta.',
  '## 6. Escopo',
  '- Loja',
  '## 7. Requisitos',
  '- **R1** · Algo'
].join('\n')

function plan(rules = '', status = 'Escrito', azure = '#4211'): string {
  return [
    '### P1 · DEV · Fazer algo',
    `Azure: ${azure} · Status: ${status}`,
    'Requisitos: R1',
    rules ? `RNs: ${rules}` : ''
  ].join('\n')
}

function folder(slug: string, overrides: Partial<FeatureFolderFiles> = {}): FeatureFolderFiles {
  return {
    slug,
    files: ['README.md', 'discovery/brief.md', 'plano-pbis.md'],
    readme: '# Pix\nFeature: #4102\n',
    brief: BRIEF,
    decisions: null,
    plan: plan(),
    ...overrides
  }
}

function snapshot(partial: Partial<FlowSnapshot> = {}): FlowSnapshot {
  return {
    version: 1,
    productId: 'loja',
    takenAt: '2026-11-26T09:00:00.000Z',
    windowStart: '2026-05-30',
    priorityField: null,
    features: [],
    children: [],
    feedbacks: null,
    bugs: [],
    ...partial
  }
}

function board(
  folders: Array<[FeatureFolderFiles, number | null]>,
  extra: Partial<BoardInput> = {}
): ReturnType<typeof buildFlowBoard> {
  return buildFlowBoard({
    productId: 'loja',
    workFolder: 'ok',
    snapshot: snapshot(),
    folders: folders.map(([files, age]) => ({
      folder: parseFeatureFolder(files),
      lastModified: age === null ? null : NOW.getTime() - age * DAY
    })),
    now: NOW,
    deliveredStates: ['Done'],
    terminalStates: ['Done', 'Removed'],
    catalog: null,
    ...extra
  })
}

const FEATURE = {
  id: 4102,
  type: 'Feature',
  title: 'Pagamento por Pix no checkout',
  state: 'New',
  parentId: null,
  priority: 29,
  createdDate: '',
  stateChangeDate: null,
  childIds: [4211]
}

describe('a Fase', () => {
  it('Pronta para quebra com o checklist inteiro e nenhuma regra; Em quebra com regra', () => {
    expect(board([[folder('pix'), 1]]).features[0].phase).toBe('Pronta para quebra')
    expect(board([[folder('pix', { plan: plan('RN-PAG-016') }), 1]]).features[0].phase).toBe(
      'Em quebra'
    )
  })

  it('Publicada só com o catálogo citando um PBI da Feature na Origem', () => {
    const files = folder('pix', { plan: plan('RN-PAG-016, 017') })
    const catalog = (origins: Record<string, number[]>): RuleCatalog => ({
      origins: (id) => origins[id] ?? null,
      find: (id) =>
        origins[id]
          ? { status: 'Ativa', updated: null, origins: origins[id], consulted: false }
          : null
    })
    expect(
      board([[files, 1]], { catalog: catalog({ 'RN-PAG-016': [4211], 'RN-PAG-017': [4211, 9] }) })
        .features[0].phase
    ).toBe('Publicada')
    expect(
      board([[files, 1]], { catalog: catalog({ 'RN-PAG-016': [4211], 'RN-PAG-017': [9] }) })
        .features[0].phase
    ).toBe('Em quebra')
  })

  it('a linha Fase do README só aparece quando diverge', () => {
    const readme = (phase: string): string => `# Pix\nFase: ${phase}\nFeature: #4102\n`
    expect(
      board([[folder('pix', { readme: readme('Discovery') }), 1]]).features[0].readmePhase
    ).toBe('Discovery')
    expect(
      board([[folder('pix', { readme: readme('Pronta para quebra') }), 1]]).features[0].readmePhase
    ).toBeNull()
  })
})

describe('parada há N dias (RN-FLX-11)', () => {
  it(`destaca acima de ${STALE_DAYS} dias, e só em Discovery e Pronta para quebra`, () => {
    expect(board([[folder('pix'), STALE_DAYS]]).features[0]).toMatchObject({
      staleDays: STALE_DAYS,
      stale: false
    })
    expect(board([[folder('pix'), STALE_DAYS + 1]]).features[0].stale).toBe(true)
    expect(board([[folder('pix', { plan: plan('RN-PAG-016') }), 90]]).features[0].stale).toBe(false)
  })
})

describe('Feature do retrato sem pasta', () => {
  it('aberta entra como Sem Discovery; fechada sem pasta fica de fora', () => {
    const result = board([], {
      snapshot: snapshot({
        features: [FEATURE, { ...FEATURE, id: 4060, state: 'Done', childIds: [] }]
      })
    })
    expect(result.features.map((f) => [f.key, f.phase])).toEqual([['#4102', 'Sem Discovery']])
  })
})

describe('pendências e divergências', () => {
  it('duas pastas para a mesma Feature', () => {
    const result = board([
      [folder('pix'), 1],
      [folder('pix-antiga'), 1]
    ])
    expect(
      result.features.every((f) => f.pendencies.some((p) => p.code === 'duplicate-folder'))
    ).toBe(true)
  })

  it('PBI já entregue com a Feature ainda em Discovery (RN-FLX-09)', () => {
    const result = board([[folder('pix', { brief: '## 1. Problema\n' }), 1]], {
      snapshot: snapshot({
        features: [FEATURE],
        children: [
          { id: 4211, type: 'Product Backlog Item', title: 'QR', state: 'Done', parentId: 4102 }
        ]
      })
    })
    expect(result.features[0].phase).toBe('Discovery')
    expect(result.features[0].divergences).toEqual([
      'Já há PBI entregue (#4211) com a Feature em Discovery.'
    ])
  })

  it('regra repetida só entre Features que ainda não chegaram a Publicada (RN-FLX-19)', () => {
    const other = folder('retirada', {
      readme: '# Retirada\nFeature: #a criar\n',
      plan: plan('RN-CUP-009', 'Planejado', '#a criar')
    })
    const archived = folder('frete', {
      readme: '# Frete\nFeature: #4070\nArquivada: 2026-10-01 · desistência\n',
      plan: plan('RN-CUP-009')
    })
    const result = board([
      [folder('pix', { plan: plan('RN-CUP-009') }), 1],
      [other, 1],
      [archived, 1]
    ])
    const shared = result.features.flatMap((f) =>
      f.pendencies.filter((p) => p.code === 'rule-shared').map((p) => [f.key, p.message])
    )
    expect(shared).toEqual([
      ['#4102', 'RN-CUP-009 também está no plano de outra Feature: pasta retirada.'],
      ['pasta:retirada', 'RN-CUP-009 também está no plano de outra Feature: #4102.']
    ])
  })
})
