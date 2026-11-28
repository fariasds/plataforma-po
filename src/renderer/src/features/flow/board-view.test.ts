import { describe, expect, it } from 'vitest'
import type { BoardFeature } from '@shared/flow-board'
import type { PbiReconciliation } from '@shared/flow-reconcile'
import { funnelColumns, idsToConfirm, outsideFunnel, pendenciesByStage } from './board-view'

// RN-FLX-05, RN-FLX-10, RN-FLX-12. Dados fictícios: organização `contoso`.

function feature(partial: Partial<BoardFeature>): BoardFeature {
  return {
    key: '#4102',
    featureId: 4102,
    slug: 'pix',
    title: 'Pagamento por Pix',
    azureState: 'New',
    priority: null,
    phase: 'Discovery',
    readmePhase: null,
    checklist: null,
    pendencies: [],
    divergences: [],
    staleDays: 1,
    stale: false,
    rules: [],
    plan: null,
    reconciliation: { pbis: [], feature: null },
    ...partial
  }
}

describe('o funil', () => {
  it('cinco colunas na ordem do fluxo; arquivada e fora do fluxo ficam à parte', () => {
    const features = [
      feature({ key: 'a', phase: 'Em quebra' }),
      feature({ key: 'b', phase: 'Arquivada' }),
      feature({ key: 'c', phase: 'Discovery' }),
      feature({ key: 'd', phase: 'Fora do fluxo' })
    ]
    expect(funnelColumns(features).map((c) => [c.phase, c.features.map((f) => f.key)])).toEqual([
      ['Sem Discovery', []],
      ['Discovery', ['c']],
      ['Pronta para quebra', []],
      ['Em quebra', ['a']],
      ['Publicada', []]
    ])
    expect(outsideFunnel(features).map((f) => f.key)).toEqual(['b', 'd'])
  })
})

describe('o cartão', () => {
  it('conta só os IDs que têm candidato para confirmar', () => {
    const match = (candidates: number[]): PbiReconciliation => ({
      pbi: 'P1',
      title: 'x',
      match: 'exact' as const,
      candidates: candidates.map((id) => ({ id, title: 'x', state: 'New', type: 'PBI' }))
    })
    expect(
      idsToConfirm(
        feature({
          reconciliation: {
            pbis: [match([4213]), match([])],
            feature: {
              match: 'exact',
              candidates: [{ id: 4120, title: 'x', state: 'New', type: 'Feature' }]
            }
          }
        })
      )
    ).toBe(2)
  })

  it('pendências agrupadas pela etapa, na ordem do fluxo', () => {
    const groups = pendenciesByStage(
      feature({
        pendencies: [
          { code: 'rule-shared', stage: 'Quebra', message: 'q' },
          { code: 'decision-proposed', stage: 'Discovery', message: 'd' }
        ]
      })
    )
    expect(groups.map((g) => g.stage)).toEqual(['Discovery', 'Quebra'])
  })
})
