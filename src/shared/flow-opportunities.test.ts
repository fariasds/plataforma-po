import { describe, expect, it } from 'vitest'
import {
  buildOpportunities,
  opportunitiesByFeature,
  parseBugAnalysis,
  parseOpportunityFile
} from './flow-opportunities'
import type { FlowSnapshot } from './flow-snapshot'

// RN-FLX-14 a RN-FLX-16, RN-FLX-25. Dados fictícios: organização `contoso`.

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
      state: 'New',
      parentId: null,
      priority: null,
      createdDate: '',
      stateChangeDate: null,
      childIds: []
    }
  ],
  children: [],
  feedbacks: [
    {
      id: 5198,
      type: 'Feedback',
      title: 'Cupom some',
      state: 'Approved',
      parentId: null,
      description: '',
      featureIds: []
    },
    {
      id: 5199,
      type: 'Feedback',
      title: 'Ligado',
      state: 'Approved',
      parentId: null,
      description: '',
      featureIds: [4088]
    }
  ],
  bugs: []
}

describe('a leitura dos arquivos', () => {
  it('oportunidade: título, origem, Feature e descarte', () => {
    expect(
      parseOpportunityFile(
        'oportunidades/a.md',
        '# A dor\nOrigem: feedback #5198\nFeature: #4088\n'
      )
    ).toMatchObject({
      title: 'A dor',
      origin: { source: 'feedback', id: 5198 },
      feature: { id: 4088 }
    })
    expect(
      parseOpportunityFile('oportunidades/b.md', '# B\nOrigem: conversa\nFeature: nova: Lista\n')
        .feature
    ).toEqual({ newTitle: 'Lista' })
    expect(
      parseOpportunityFile(
        'oportunidades/c.md',
        '# C\nOrigem: conversa\nDescartada: 2026-11-05 · sem verba\n'
      ).discarded
    ).toEqual({ date: '2026-11-05', reason: 'sem verba' })
  })

  it('análise de bug: ID, veredito e regras afetadas', () => {
    const bug = parseBugAnalysis(
      'bugs/BUG-5301-x.md',
      '# BUG 5301 · Cupom duplicado\nVeredito: Bug\nViolada: RN-CUP-004\nPreservar: RN-PAG-012, RN-ELN-APP-001\n'
    )
    expect(bug).toMatchObject({
      bugId: 5301,
      title: 'Cupom duplicado',
      verdict: 'Bug',
      violated: ['RN-CUP-004'],
      preserve: ['RN-PAG-012', 'RN-ELN-APP-001']
    })
    expect(parseBugAnalysis('bugs/x.md', '# X\nVeredito: Não é bug\n').verdict).toBe('Não é bug')
  })
})

describe('o encaixe (RN-FLX-15)', () => {
  const files = [
    parseOpportunityFile('oportunidades/a.md', '# A\nOrigem: feedback #5198\nFeature: #4088\n'),
    parseOpportunityFile('oportunidades/b.md', '# B\nOrigem: conversa\nFeature: #9999\n')
  ]

  it('o vínculo do Azure encaixa; o arquivo só propõe, com o gesto no Azure (RN-FLX-16)', () => {
    const result = buildOpportunities({ snapshot: SNAPSHOT, files, bugs: [], link: 'child' })
    expect(result.find((o) => o.key === 'feedback:5199')?.fit).toBe('Encaixada')
    expect(result.find((o) => o.key === 'feedback:5198')).toMatchObject({
      fit: 'Proposto',
      action: 'No Azure, ligar #5198 como filho de #4088.'
    })
  })

  it('a conversa com Feature fora do retrato fica proposta, pedindo conferência', () => {
    const b = buildOpportunities({ snapshot: SNAPSHOT, files, bugs: [], link: null }).find(
      (o) => o.key === 'conversa:oportunidades/b.md'
    )
    expect(b).toMatchObject({ fit: 'Proposto', action: expect.stringMatching(/confira o ID/) })
  })

  it('bug "A validar" volta ao começo; "Bug" e "Não é bug" não (RN-FLX-25)', () => {
    const bugs = [
      parseBugAnalysis('bugs/BUG-1-x.md', '# BUG 1 · Sem regra\nVeredito: A validar\n'),
      parseBugAnalysis('bugs/BUG-2-x.md', '# BUG 2 · Erro\nVeredito: Bug\n')
    ]
    const result = buildOpportunities({ snapshot: SNAPSHOT, files: [], bugs, link: null })
    expect(result.filter((o) => o.source === 'bug').map((o) => [o.key, o.fit])).toEqual([
      ['bug:1', 'Sem encaixe']
    ])
  })

  it('conta as oportunidades por Feature, para o Roadmap', () => {
    const result = buildOpportunities({ snapshot: SNAPSHOT, files, bugs: [], link: 'parent' })
    expect(opportunitiesByFeature(result).get(4088)).toBe(2)
  })
})
