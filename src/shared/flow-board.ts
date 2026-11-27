import {
  ARTIFACT_FILES,
  isActivePbi,
  type ArtifactFile,
  type ParsedFeatureFolder
} from './flow-artifacts'
import {
  reconcileDraft,
  reconcilePlan,
  type PbiReconciliation,
  type TitleMatch
} from './flow-reconcile'
import type { FlowSnapshot } from './flow-snapshot'

/**
 * Em que ponto cada Feature está, calculado dos artefatos e do retrato, nunca
 * digitado (RN-FLX-05). Lógica pura: o main lê o disco e o retrato e chama daqui.
 */

export type FlowPhase =
  | 'Sem Discovery'
  | 'Discovery'
  | 'Pronta para quebra'
  | 'Em quebra'
  | 'Publicada'
  | 'Arquivada'
  | 'Fora do fluxo'

/** A ordem do funil, da esquerda para a direita. */
export const PHASE_ORDER: readonly FlowPhase[] = [
  'Sem Discovery',
  'Discovery',
  'Pronta para quebra',
  'Em quebra',
  'Publicada',
  'Fora do fluxo',
  'Arquivada'
]

/** Feature em Discovery ou Pronta para quebra parada há mais que isto é destacada (RN-FLX-11). */
export const STALE_DAYS = 30

export type FlowStage = 'Encaixe' | 'Discovery' | 'Quebra' | 'Regras' | 'Acompanhamento'

export interface Pendency {
  code:
    | 'brief-missing'
    | 'brief-section'
    | 'decision-proposed'
    | 'question-blocks'
    | 'question-unmarked'
    | 'plan-missing'
    | 'requirement-uncovered'
    | 'pbi-without-azure'
    | 'design-not-written'
    | 'rule-without-dev'
    | 'rule-shared'
    | 'unrecognized-line'
    | 'duplicate-folder'
    | 'not-in-snapshot'
  stage: FlowStage
  message: string
  file?: ArtifactFile
  line?: number
}

export interface ChecklistItem {
  key: 'brief' | 'decisions' | 'questions' | 'plan' | 'design'
  label: string
  ok: boolean
}

export interface BoardFeature {
  /** `#<id>` para Feature do Azure, `pasta:<slug>` para rascunho. */
  key: string
  featureId: number | null
  /** Pasta em `features/`, ou `null` quando a Feature ainda não tem pasta. */
  slug: string | null
  title: string
  /** Estado no Azure, ou `null` para o rascunho e para a Feature fora do retrato. */
  azureState: string | null
  priority: number | null
  phase: FlowPhase
  /** A linha `Fase:` do README, quando existe e diverge do cálculo. */
  readmePhase: string | null
  /** O checklist de "Pronta para quebra", quando a Feature tem Discovery. */
  checklist: ChecklistItem[] | null
  pendencies: Pendency[]
  /** O que o Azure diz e o plano contradiz (RN-FLX-09). Informa, não muda a Fase. */
  divergences: string[]
  /** Dias desde a última alteração na pasta; `null` sem pasta. */
  staleDays: number | null
  stale: boolean
  /** As regras da Feature: a soma das linhas `RNs` dos PBIs ativos do plano (RN-FLX-18). */
  rules: string[]
  /** PBIs ativos do plano e quantos deles estão escritos. */
  plan: { active: number; written: number } | null
  /**
   * O que o app reconheceu no Azure e o PO confirma com um clique: os PBIs ativos sem
   * ID (RN-FLX-12) e, no rascunho, a Feature (RN-FLX-13).
   */
  reconciliation: { pbis: PbiReconciliation[]; feature: TitleMatch | null }
}

export type WorkFolderState = 'unset' | 'missing' | 'ok'

export interface FlowBoard {
  productId: string
  workFolder: WorkFolderState
  /** Data do retrato usado, ou `null` sem retrato (RN-FLX-02). */
  snapshotTakenAt: string | null
  features: BoardFeature[]
}

/** O catálogo do Produto, quando existir (fatia do Catálogo). Sem ele, nenhuma Feature chega a Publicada. */
export interface RuleCatalog {
  /** A regra existe e cita estes PBIs na Origem ou nas Atualizações? */
  origins(ruleId: string): number[] | null
}

export interface FeatureFolderInput {
  folder: ParsedFeatureFolder
  /** Última alteração de um arquivo da pasta, em milissegundos; `null` se não deu para ler. */
  lastModified: number | null
}

export interface BoardInput {
  productId: string
  workFolder: WorkFolderState
  snapshot: FlowSnapshot | null
  folders: FeatureFolderInput[]
  now: Date
  /** Do Perfil de processo do Produto. */
  deliveredStates: readonly string[]
  terminalStates: readonly string[]
  catalog: RuleCatalog | null
}

// ─── Fase e checklist ────────────────────────────────────────────────────────

function featureRules(folder: ParsedFeatureFolder): string[] {
  const active = folder.plan?.pbis.filter(isActivePbi) ?? []
  return [...new Set(active.flatMap((pbi) => pbi.rules))]
}

/** O Passo 6 do Discovery, verificado (RN-FLX-06). */
export function readinessChecklist(folder: ParsedFeatureFolder): ChecklistItem[] {
  const brief = folder.brief
  const sections = brief?.sections
  const active = folder.plan?.pbis.filter(isActivePbi) ?? []
  const covered = new Set([
    ...active.flatMap((pbi) => pbi.requirements),
    ...(folder.plan?.justified ?? [])
  ])
  return [
    {
      key: 'brief',
      label: 'Brief com Problema, Para quem, Objetivo e Escopo',
      ok:
        !!sections && sections.problem && sections.audience && sections.objective && sections.scope
    },
    {
      key: 'decisions',
      label: 'Nenhuma Decisão em Proposta',
      ok: !(folder.decisions ?? []).some((d) => d.status === 'Proposta')
    },
    {
      key: 'questions',
      label: 'Nenhuma pergunta em aberto que bloqueie a quebra',
      ok: !(brief?.questions ?? []).some((q) => !q.answered && q.blocks !== false)
    },
    {
      key: 'plan',
      label: 'Plano de PBIs cobrindo todo Requisito',
      ok:
        active.length > 0 &&
        (brief?.requirements ?? []).every((requirement) => covered.has(requirement.key))
    },
    {
      key: 'design',
      label: 'PBIs de design escritos',
      ok: active.filter((pbi) => pbi.type !== 'DEV').every((pbi) => pbi.status === 'Escrito')
    }
  ]
}

function isPublished(
  folder: ParsedFeatureFolder,
  rules: string[],
  catalog: RuleCatalog | null
): boolean {
  if (!catalog || rules.length === 0) return false
  const pbiIds = new Set(
    (folder.plan?.pbis ?? []).flatMap((pbi) => (pbi.azureId !== null ? [pbi.azureId] : []))
  )
  return rules.every((rule) => (catalog.origins(rule) ?? []).some((id) => pbiIds.has(id)))
}

/** A Fase de uma pasta de Feature (RN-FLX-05, RN-FLX-07, RN-FLX-08). */
export function folderPhase(folder: ParsedFeatureFolder, catalog: RuleCatalog | null): FlowPhase {
  if (folder.archived) return 'Arquivada'
  if (folder.onlyReadme) return 'Sem Discovery'
  if (!folder.hasDiscovery && !folder.plan) return 'Fora do fluxo'
  const rules = featureRules(folder)
  if (rules.length > 0) return isPublished(folder, rules, catalog) ? 'Publicada' : 'Em quebra'
  return readinessChecklist(folder).every((item) => item.ok) ? 'Pronta para quebra' : 'Discovery'
}

// ─── Pendências ──────────────────────────────────────────────────────────────

const BRIEF_SECTIONS = {
  problem: 'Problema',
  audience: 'Para quem',
  objective: 'Objetivo e métrica',
  scope: 'Escopo'
} as const

function reconciliationHint(match: PbiReconciliation | undefined): string {
  if (!match) return ''
  const ids = match.candidates.map((c) => `#${c.id}`).join(', ')
  switch (match.match) {
    case 'exact':
      return ` No Azure, ${ids} tem o mesmo título: confirme.`
    case 'similar':
      return ` No Azure, ${ids} tem um título parecido: confirme se é ele.`
    case 'ambiguous':
      return ` No Azure, mais de um filho serve (${ids}): escolha qual.`
    case 'none':
      return ''
  }
}

function discoveryPendencies(
  folder: ParsedFeatureFolder,
  reconciliation: PbiReconciliation[] = []
): Pendency[] {
  const result: Pendency[] = []
  const brief = folder.brief
  if (!brief) {
    result.push({
      code: 'brief-missing',
      stage: 'Discovery',
      message: 'Falta o Brief (discovery/brief.md).'
    })
  } else {
    for (const [key, label] of Object.entries(BRIEF_SECTIONS)) {
      if (!brief.sections[key as keyof typeof BRIEF_SECTIONS]) {
        result.push({
          code: 'brief-section',
          stage: 'Discovery',
          message: `A seção "${label}" do Brief está vazia.`,
          file: ARTIFACT_FILES.brief
        })
      }
    }
    for (const question of brief.questions.filter((q) => !q.answered)) {
      if (question.blocks === true) {
        result.push({
          code: 'question-blocks',
          stage: 'Discovery',
          message: `Pergunta em aberto que bloqueia a quebra: ${questionText(question.text)}`,
          file: ARTIFACT_FILES.brief,
          line: question.line
        })
      } else if (question.blocks === null) {
        result.push({
          code: 'question-unmarked',
          stage: 'Discovery',
          message: `Pergunta em aberto sem dizer se bloqueia a quebra: ${questionText(question.text)}`,
          file: ARTIFACT_FILES.brief,
          line: question.line
        })
      }
    }
  }

  for (const decision of (folder.decisions ?? []).filter((d) => d.status === 'Proposta')) {
    result.push({
      code: 'decision-proposed',
      stage: 'Discovery',
      message: `${decision.key} está em Proposta.`,
      file: ARTIFACT_FILES.decisions,
      line: decision.line
    })
  }

  const plan = folder.plan
  if (!plan) {
    result.push({
      code: 'plan-missing',
      stage: 'Discovery',
      message: 'Falta o Plano de PBIs (plano-pbis.md).'
    })
    return result
  }
  const active = plan.pbis.filter(isActivePbi)
  const covered = new Set([...active.flatMap((pbi) => pbi.requirements), ...plan.justified])
  for (const requirement of brief?.requirements ?? []) {
    if (!covered.has(requirement.key)) {
      result.push({
        code: 'requirement-uncovered',
        stage: 'Discovery',
        message: `${requirement.key} não tem PBI nem justificativa na cobertura.`,
        file: ARTIFACT_FILES.plan
      })
    }
  }
  for (const pbi of active) {
    if (pbi.azureId === null) {
      result.push({
        code: 'pbi-without-azure',
        stage: 'Discovery',
        message: `${pbi.key} ainda não tem o ID do Azure.${reconciliationHint(
          reconciliation.find((r) => r.pbi === pbi.key)
        )}`,
        file: ARTIFACT_FILES.plan,
        line: pbi.line
      })
    }
    if (pbi.type !== 'DEV' && pbi.status !== 'Escrito') {
      result.push({
        code: 'design-not-written',
        stage: 'Discovery',
        message: `${pbi.key} (${pbi.type === 'DESIGN' ? 'design' : 'ajuste visual'}) ainda não está escrito.`,
        file: ARTIFACT_FILES.plan,
        line: pbi.line
      })
    }
  }
  return result
}

function ruleWithoutDev(folder: ParsedFeatureFolder): Pendency[] {
  const active = folder.plan?.pbis.filter(isActivePbi) ?? []
  const inDev = new Set(active.filter((pbi) => pbi.type === 'DEV').flatMap((pbi) => pbi.rules))
  return featureRules(folder)
    .filter((rule) => !inDev.has(rule))
    .map((rule) => ({
      code: 'rule-without-dev' as const,
      stage: 'Quebra' as const,
      message: `${rule} não está em nenhum PBI de desenvolvimento.`,
      file: ARTIFACT_FILES.plan
    }))
}

function unrecognizedPendencies(folder: ParsedFeatureFolder): Pendency[] {
  return folder.unrecognized.map((u) => ({
    code: 'unrecognized-line' as const,
    stage: 'Discovery' as const,
    message: `Linha não reconhecida: ${u.reason}`,
    file: u.file,
    line: u.line
  }))
}

// ─── Quadro ──────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000

function folderLabel(folder: ParsedFeatureFolder): string {
  return folder.featureId !== null ? `#${folder.featureId}` : `pasta ${folder.slug}`
}

/** A pergunta sem o negrito do Markdown e sem a marca de bloqueio no fim. */
function questionText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\s*[—-]\s*`[^`]*`.*$/, '')
    .trim()
}

/** O quadro de um Produto: toda Feature do retrato e toda pasta, com a Fase e o próximo passo. */
export function buildFlowBoard(input: BoardInput): FlowBoard {
  const { snapshot, catalog } = input
  const delivered = new Set(input.deliveredStates.map((s) => s.toLowerCase()))
  const terminal = new Set(input.terminalStates.map((s) => s.toLowerCase()))
  const byId = new Map((snapshot?.features ?? []).map((f) => [f.id, f]))
  const childById = new Map((snapshot?.children ?? []).map((c) => [c.id, c]))
  const folders = input.folders

  // Pastas por Feature, para a pendência de pasta repetida.
  const foldersOf = new Map<number, string[]>()
  for (const { folder } of folders) {
    if (folder.featureId === null) continue
    foldersOf.set(folder.featureId, [...(foldersOf.get(folder.featureId) ?? []), folder.slug])
  }

  // Regras de cada pasta que ainda não chegou a Publicada, para a RN-FLX-19.
  const phases = new Map(folders.map(({ folder }) => [folder.slug, folderPhase(folder, catalog)]))
  const rulesOwners = new Map<string, ParsedFeatureFolder[]>()
  for (const { folder } of folders) {
    const phase = phases.get(folder.slug)
    if (phase === 'Publicada' || phase === 'Arquivada') continue
    for (const rule of featureRules(folder)) {
      rulesOwners.set(rule, [...(rulesOwners.get(rule) ?? []), folder])
    }
  }

  const features: BoardFeature[] = []
  const withFolder = new Set(
    folders.flatMap(({ folder }) => (folder.featureId !== null ? [folder.featureId] : []))
  )

  for (const { folder, lastModified } of folders) {
    const azure = folder.featureId !== null ? byId.get(folder.featureId) : undefined
    const phase = phases.get(folder.slug)!
    const rules = featureRules(folder)
    const pendencies: Pendency[] = []
    const divergences: string[] = []
    const inFlow = phase !== 'Arquivada' && phase !== 'Fora do fluxo'
    const children = (azure?.childIds ?? []).flatMap((id) => childById.get(id) ?? [])
    const reconciliation = {
      pbis: inFlow ? reconcilePlan(folder, children) : [],
      feature: inFlow ? reconcileDraft(folder, snapshot?.features ?? [], withFolder) : null
    }

    if (inFlow && phase !== 'Sem Discovery') {
      pendencies.push(
        ...discoveryPendencies(folder, reconciliation.pbis),
        ...ruleWithoutDev(folder)
      )
      for (const rule of rules) {
        const others = (rulesOwners.get(rule) ?? []).filter((other) => other.slug !== folder.slug)
        if (others.length === 0) continue
        const inCatalog = catalog?.origins(rule) != null
        pendencies.push({
          code: 'rule-shared',
          stage: 'Quebra',
          message: inCatalog
            ? `${rule} também é alterada no plano de outra Feature: ${others.map(folderLabel).join(', ')}.`
            : `${rule} também está no plano de outra Feature: ${others.map(folderLabel).join(', ')}.`,
          file: ARTIFACT_FILES.plan
        })
      }
    }
    // Pasta arquivada ou anterior ao fluxo não tem pendência (RN-FLX-07, RN-FLX-08).
    if (inFlow) pendencies.push(...unrecognizedPendencies(folder))

    const siblings = folder.featureId !== null ? (foldersOf.get(folder.featureId) ?? []) : []
    if (siblings.length > 1) {
      pendencies.push({
        code: 'duplicate-folder',
        stage: 'Discovery',
        message: `A Feature #${folder.featureId} tem mais de uma pasta: ${siblings.join(', ')}.`
      })
    }
    if (folder.featureId !== null && snapshot && !azure && inFlow) {
      pendencies.push({
        code: 'not-in-snapshot',
        stage: 'Discovery',
        message: `A Feature #${folder.featureId} não está no retrato: fechada há mais de 180 dias, removida ou de outro Produto.`
      })
    }

    if (azure) {
      const state = azure.state.toLowerCase()
      if (terminal.has(state) && phase !== 'Publicada' && phase !== 'Arquivada') {
        divergences.push(`O Azure diz ${azure.state}, e a Fase é ${phase}.`)
      }
      if (phase === 'Discovery' || phase === 'Pronta para quebra' || phase === 'Sem Discovery') {
        const deliveredChildren = azure.childIds.filter((id) => {
          const child = childById.get(id)
          return child !== undefined && delivered.has(child.state.toLowerCase())
        })
        if (deliveredChildren.length > 0) {
          divergences.push(
            `Já há PBI entregue (${deliveredChildren.map((id) => `#${id}`).join(', ')}) com a Feature em ${phase}.`
          )
        }
      }
    }

    const staleDays =
      lastModified === null
        ? null
        : Math.max(0, Math.floor((input.now.getTime() - lastModified) / DAY))
    const active = folder.plan?.pbis.filter(isActivePbi) ?? null
    features.push({
      key: folder.featureId !== null ? `#${folder.featureId}` : `pasta:${folder.slug}`,
      featureId: folder.featureId,
      slug: folder.slug,
      title: azure?.title ?? folder.title ?? folder.slug,
      azureState: azure?.state ?? null,
      priority: azure?.priority ?? null,
      phase,
      readmePhase:
        folder.readmePhase !== null && folder.readmePhase.toLowerCase() !== phase.toLowerCase()
          ? folder.readmePhase
          : null,
      checklist: inFlow && phase !== 'Sem Discovery' ? readinessChecklist(folder) : null,
      pendencies,
      divergences,
      staleDays,
      stale:
        staleDays !== null &&
        (phase === 'Discovery' || phase === 'Pronta para quebra') &&
        staleDays > STALE_DAYS,
      rules,
      plan: active
        ? { active: active.length, written: active.filter((p) => p.status === 'Escrito').length }
        : null,
      reconciliation
    })
  }

  // Feature aberta no Azure, sem pasta: ainda não começou o Discovery.
  for (const feature of snapshot?.features ?? []) {
    if (withFolder.has(feature.id) || terminal.has(feature.state.toLowerCase())) continue
    features.push({
      key: `#${feature.id}`,
      featureId: feature.id,
      slug: null,
      title: feature.title,
      azureState: feature.state,
      priority: feature.priority,
      phase: 'Sem Discovery',
      readmePhase: null,
      checklist: null,
      pendencies: [],
      divergences: [],
      staleDays: null,
      stale: false,
      rules: [],
      plan: null,
      reconciliation: { pbis: [], feature: null }
    })
  }

  // Por Fase; dentro dela, maior prioridade primeiro, depois o ID; o rascunho por último.
  const nullsLast = (a: number | null, b: number | null, sign: 1 | -1): number =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : sign * (a - b)
  features.sort(
    (a, b) =>
      PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) ||
      nullsLast(a.priority, b.priority, -1) ||
      nullsLast(a.featureId, b.featureId, 1) ||
      a.key.localeCompare(b.key)
  )

  return {
    productId: input.productId,
    workFolder: input.workFolder,
    snapshotTakenAt: snapshot?.takenAt ?? null,
    features
  }
}
