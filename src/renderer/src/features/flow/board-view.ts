import type { BoardFeature, FlowPhase, FlowStage, Pendency } from '@shared/flow-board'

/**
 * Como a tela Features arruma o quadro: o funil com as cinco Fases do fluxo e, à
 * parte, o que está arquivado ou fora do fluxo. Lógica pura, testável sem React.
 */

export const FUNNEL: readonly FlowPhase[] = [
  'Sem Discovery',
  'Discovery',
  'Pronta para quebra',
  'Em quebra',
  'Publicada'
]

export interface FunnelColumn {
  phase: FlowPhase
  features: BoardFeature[]
}

export function funnelColumns(features: readonly BoardFeature[]): FunnelColumn[] {
  return FUNNEL.map((phase) => ({ phase, features: features.filter((f) => f.phase === phase) }))
}

export function outsideFunnel(features: readonly BoardFeature[]): BoardFeature[] {
  return features.filter((f) => !FUNNEL.includes(f.phase))
}

/** Quantos IDs do Azure o PO pode confirmar agora nesta Feature (RN-FLX-12, RN-FLX-13). */
export function idsToConfirm(feature: BoardFeature): number {
  const pbis = feature.reconciliation.pbis.filter((r) => r.candidates.length > 0).length
  const draft = feature.reconciliation.feature?.candidates.length ? 1 : 0
  return pbis + draft
}

const STAGES: readonly FlowStage[] = ['Encaixe', 'Discovery', 'Quebra', 'Regras', 'Acompanhamento']

export function pendenciesByStage(
  feature: BoardFeature
): Array<{ stage: FlowStage; items: Pendency[] }> {
  return STAGES.map((stage) => ({
    stage,
    items: feature.pendencies.filter((p) => p.stage === stage)
  })).filter((group) => group.items.length > 0)
}
