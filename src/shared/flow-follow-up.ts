import type { ParsedFeatureFolder } from './flow-artifacts'
import type { CatalogIndex } from './flow-catalog'
import type { BugAnalysis, BugVerdict } from './flow-opportunities'
import type { FlowSnapshot } from './flow-snapshot'

/**
 * O acompanhamento depois da entrega (RN-FLX-21 a RN-FLX-24): quais bugs faltam
 * analisar, onde eles se concentram, por Feature e por regra, e quais regras novas
 * já foram entregues e ainda não foram conferidas em uso. Lógica pura.
 */

export type BugPath = 'azure' | 'regra' | 'ambos'

export interface FollowUpBug {
  id: number
  title: string
  state: string
  open: boolean
  verdict: BugVerdict | null
}

export interface FeatureBugs {
  featureId: number
  title: string
  bugs: Array<FollowUpBug & { via: BugPath }>
}

export interface RuleBugs {
  rule: string
  title: string | null
  bugs: number[]
}

export interface RuleToConfirm {
  rule: string
  title: string
  file: string
  /** O PBI da Origem ou das Atualizações que já foi entregue. */
  pbi: number
  pbiState: string
}

export interface FollowUpView {
  productId: string
  snapshotTakenAt: string | null
  workFolder: 'unset' | 'missing' | 'ok'
  catalogConfigured: boolean
  /** Bugs abertos do retrato sem arquivo de análise em `bugs/` (RN-FLX-21). */
  unanalyzed: FollowUpBug[]
  byFeature: FeatureBugs[]
  byRule: RuleBugs[]
  toConfirm: RuleToConfirm[]
}

export interface FollowUpInput {
  productId: string
  snapshot: FlowSnapshot | null
  analyses: BugAnalysis[]
  folders: ParsedFeatureFolder[]
  catalog: CatalogIndex | null
  deliveredStates: readonly string[]
  workFolder: FollowUpView['workFolder']
}

export function buildFollowUp(input: FollowUpInput): FollowUpView {
  const { snapshot, analyses, catalog } = input
  const delivered = new Set(input.deliveredStates.map((s) => s.toLowerCase()))
  const features = new Map((snapshot?.features ?? []).map((f) => [f.id, f]))
  const children = new Map((snapshot?.children ?? []).map((c) => [c.id, c]))
  const analysisOf = new Map(
    analyses.flatMap((a) => (a.bugId !== null ? [[a.bugId, a] as const] : []))
  )

  // Todo bug conhecido: o do retrato e o que só tem análise (fechado há mais tempo).
  const bugs = new Map<number, FollowUpBug>()
  for (const bug of snapshot?.bugs ?? []) {
    bugs.set(bug.id, {
      id: bug.id,
      title: bug.title,
      state: bug.state,
      open: bug.open,
      verdict: analysisOf.get(bug.id)?.verdict ?? null
    })
  }
  for (const analysis of analyses) {
    if (analysis.bugId === null || bugs.has(analysis.bugId)) continue
    bugs.set(analysis.bugId, {
      id: analysis.bugId,
      title: analysis.title,
      state: '',
      open: false,
      verdict: analysis.verdict
    })
  }

  // RN-FLX-21: aberto e sem análise.
  const unanalyzed = [...bugs.values()].filter((b) => b.open && !analysisOf.has(b.id))

  // RN-FLX-22, caminho 1: o vínculo no Azure, direto na Feature ou num PBI dela.
  const viaAzure = new Map<number, Set<number>>()
  for (const bug of snapshot?.bugs ?? []) {
    const parent = bug.parentId
    if (parent === null) continue
    const featureId = features.has(parent) ? parent : (children.get(parent)?.parentId ?? null)
    if (featureId === null || !features.has(featureId)) continue
    viaAzure.set(bug.id, new Set([...(viaAzure.get(bug.id) ?? []), featureId]))
  }

  // Caminho 2: a regra violada, pela Origem dela, até o plano da Feature que tem o PBI.
  const featureOfPbi = new Map<number, number>()
  for (const folder of input.folders) {
    if (folder.featureId === null) continue
    for (const pbi of folder.plan?.pbis ?? []) {
      if (pbi.azureId !== null) featureOfPbi.set(pbi.azureId, folder.featureId)
    }
  }
  const viaRule = new Map<number, Set<number>>()
  for (const analysis of analyses) {
    if (analysis.bugId === null || analysis.verdict !== 'Bug') continue
    for (const id of analysis.violated) {
      const rule = catalog?.rules.get(id)
      if (!rule) continue
      for (const pbi of [...rule.origins, ...rule.updates]) {
        const featureId = featureOfPbi.get(pbi)
        if (featureId === undefined) continue
        viaRule.set(analysis.bugId, new Set([...(viaRule.get(analysis.bugId) ?? []), featureId]))
      }
    }
  }

  const byFeatureMap = new Map<number, FeatureBugs>()
  for (const bug of bugs.values()) {
    // "Não é bug" não conta em lugar nenhum.
    if (bug.verdict === 'Não é bug') continue
    const azure = viaAzure.get(bug.id) ?? new Set<number>()
    const rule = viaRule.get(bug.id) ?? new Set<number>()
    for (const featureId of new Set([...azure, ...rule])) {
      const via: BugPath =
        azure.has(featureId) && rule.has(featureId)
          ? 'ambos'
          : azure.has(featureId)
            ? 'azure'
            : 'regra'
      const entry = byFeatureMap.get(featureId) ?? {
        featureId,
        title:
          features.get(featureId)?.title ??
          input.folders.find((f) => f.featureId === featureId)?.title ??
          `#${featureId}`,
        bugs: []
      }
      entry.bugs.push({ ...bug, via })
      byFeatureMap.set(featureId, entry)
    }
  }
  const byFeature = [...byFeatureMap.values()]
    .map((f) => ({ ...f, bugs: f.bugs.sort((a, b) => a.id - b.id) }))
    .sort((a, b) => b.bugs.length - a.bugs.length || a.featureId - b.featureId)

  // RN-FLX-23: bugs com veredito "Bug", por regra violada.
  const byRuleMap = new Map<string, Set<number>>()
  for (const analysis of analyses) {
    if (analysis.bugId === null || analysis.verdict !== 'Bug') continue
    for (const id of analysis.violated) {
      byRuleMap.set(id, new Set([...(byRuleMap.get(id) ?? []), analysis.bugId]))
    }
  }
  const byRule = [...byRuleMap.entries()]
    .map(([rule, ids]) => ({
      rule,
      title: catalog?.rules.get(rule)?.title ?? null,
      bugs: [...ids].sort((a, b) => a - b)
    }))
    .sort((a, b) => b.bugs.length - a.bugs.length || a.rule.localeCompare(b.rule))

  // RN-FLX-24: regra não validada cujo PBI já está num estado de entrega.
  const toConfirm: RuleToConfirm[] = []
  for (const rule of catalog?.rules.values() ?? []) {
    if (rule.validation !== 'Não validada') continue
    const pbi = [...rule.origins, ...rule.updates]
      .map((id) => children.get(id))
      .find((child) => child !== undefined && delivered.has(child.state.toLowerCase()))
    if (pbi) {
      toConfirm.push({
        rule: rule.id,
        title: rule.title,
        file: rule.file,
        pbi: pbi.id,
        pbiState: pbi.state
      })
    }
  }
  toConfirm.sort((a, b) => a.rule.localeCompare(b.rule))

  return {
    productId: input.productId,
    snapshotTakenAt: snapshot?.takenAt ?? null,
    workFolder: input.workFolder,
    catalogConfigured: catalog !== null,
    unanalyzed: unanalyzed.sort((a, b) => a.id - b.id),
    byFeature,
    byRule,
    toConfirm
  }
}
