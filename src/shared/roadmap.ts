import { z } from 'zod'
import type { BoardFeature, FlowBoard, FlowPhase, Pendency } from './flow-board'

/**
 * O Roadmap (RN-RDM-01 a RN-RDM-21): o plano do PO em Janelas, comparado com a Fase
 * calculada de cada Feature. O plano mora em `roadmap.json` na pasta de trabalho de
 * cada Produto (ADR 0017); a sobrecarga é somada sobre todos (RN-RDM-12). Lógica pura.
 */

export const ROADMAP_FILE = 'roadmap.json'

export const WINDOW_KINDS = ['discovery', 'quebra', 'delivery'] as const
export type WindowKind = (typeof WINDOW_KINDS)[number]

export const TRAILS = ['produto', 'tecnico'] as const
export type Trail = (typeof TRAILS)[number]

// ─── O arquivo ───────────────────────────────────────────────────────────────

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Uma Janela: a sprint em que começa (a data de início dela) e quantas sprints dura. */
export const PlannedWindowSchema = z.object({
  start: day,
  /** Zero é Janela pulada (RN-RDM-05). */
  length: z.number().int().min(0).max(26)
})
export type PlannedWindow = z.infer<typeof PlannedWindowSchema>

export const FeaturePlanSchema = z.object({
  discovery: PlannedWindowSchema,
  quebra: PlannedWindowSchema,
  delivery: PlannedWindowSchema,
  archived: z.boolean().default(false)
})
export type FeaturePlan = z.infer<typeof FeaturePlanSchema>

export const MilestoneSchema = z.object({
  name: z.string().min(1).max(80),
  takenAt: z.string(),
  features: z.record(z.string(), FeaturePlanSchema)
})
export type Milestone = z.infer<typeof MilestoneSchema>

export const RoadmapFileSchema = z.object({
  version: z.literal(1),
  /** Chave da Feature como o quadro a conhece: `#<id>` ou `pasta:<slug>`. */
  features: z.record(z.string(), FeaturePlanSchema).default({}),
  milestones: z.array(MilestoneSchema).default([])
})
export type RoadmapFile = z.infer<typeof RoadmapFileSchema>

export const EMPTY_ROADMAP: RoadmapFile = { version: 1, features: {}, milestones: [] }

/** Pesos e limites. São do PO, não de um Produto: a sobrecarga é global (RN-RDM-12). */
export const RoadmapSettingsSchema = z.object({
  weights: z.object({
    discovery: z.object({ produto: z.number().min(0).max(5), tecnico: z.number().min(0).max(5) }),
    quebra: z.object({ produto: z.number().min(0).max(5), tecnico: z.number().min(0).max(5) }),
    delivery: z.object({ produto: z.number().min(0).max(5), tecnico: z.number().min(0).max(5) })
  }),
  limits: z.object({ produto: z.number().min(0.5).max(20), tecnico: z.number().min(0.5).max(20) })
})
export type RoadmapSettings = z.infer<typeof RoadmapSettingsSchema>

/** RN-RDM-10 e RN-RDM-11: a proposta inicial. */
export const DEFAULT_ROADMAP_SETTINGS: RoadmapSettings = {
  weights: {
    discovery: { produto: 1, tecnico: 0 },
    quebra: { produto: 1, tecnico: 0.5 },
    delivery: { produto: 0, tecnico: 1 }
  },
  limits: { produto: 2, tecnico: 3 }
}

export const DEFAULT_WINDOW_LENGTH = 2

export const roadmapKeys = { settings: 'roadmap:settings' } as const

/** Lê o arquivo; o que não valida vira o plano vazio, com o motivo. */
export function parseRoadmapFile(text: string | null): { file: RoadmapFile; error: string | null } {
  if (text === null) return { file: EMPTY_ROADMAP, error: null }
  try {
    const parsed = RoadmapFileSchema.safeParse(JSON.parse(text))
    return parsed.success
      ? { file: parsed.data, error: null }
      : { file: EMPTY_ROADMAP, error: parsed.error.issues[0]?.message ?? 'inválido' }
  } catch (err) {
    return { file: EMPTY_ROADMAP, error: (err as Error).message }
  }
}

// ─── A linha do tempo ────────────────────────────────────────────────────────

export interface TimelineSprint {
  /** Data de início, `AAAA-MM-DD`: é a âncora das Janelas. */
  start: string
  finish: string
  label: string
  /** Projetada pela cadência: o Azure ainda não tem a iteração. */
  projected: boolean
}

const DAY_MS = 86_400_000

function toDay(iso: string): string {
  return iso.slice(0, 10)
}

function addDays(dayIso: string, days: number): string {
  return new Date(Date.parse(`${dayIso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function shortLabel(start: string, finish: string): string {
  const fmt = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return `${fmt(start)}–${fmt(finish)}`
}

/**
 * As sprints do Azure em ordem, mais as projetadas pela cadência da última até cobrir
 * `ahead` sprints depois da corrente (RN-RDM-15).
 */
export function buildTimeline(
  sprints: ReadonlyArray<{ startDate: string; finishDate: string; label: string }>,
  today: string,
  ahead: number
): { sprints: TimelineSprint[]; current: number } {
  const known = [...new Map(sprints.map((s) => [toDay(s.startDate), s])).values()]
    .map((s) => ({
      start: toDay(s.startDate),
      finish: toDay(s.finishDate),
      label: s.label,
      projected: false
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const list: TimelineSprint[] = [...known]
  if (list.length === 0) return { sprints: [], current: -1 }
  const currentOf = (): number => {
    const inside = list.findIndex((s) => s.start <= today && today <= s.finish)
    if (inside >= 0) return inside
    const next = list.findIndex((s) => s.start > today)
    return next >= 0 ? next : list.length - 1
  }
  const last = list[list.length - 1]
  const length = Math.max(
    1,
    Math.round((Date.parse(last.finish) - Date.parse(last.start)) / DAY_MS) + 1
  )
  const gap =
    list.length > 1
      ? Math.max(
          1,
          Math.round((Date.parse(last.start) - Date.parse(list[list.length - 2].start)) / DAY_MS)
        )
      : length
  while (list.length - 1 - currentOf() < ahead || list[list.length - 1].finish < today) {
    const prev = list[list.length - 1]
    const start = addDays(prev.start, gap)
    const finish = addDays(start, length - 1)
    list.push({ start, finish, label: shortLabel(start, finish), projected: true })
    if (list.length > 400) break
  }
  return { sprints: list, current: currentOf() }
}

/** A sprint da âncora: a que começa nela ou, se nenhuma começa, a que a contém. */
export function sprintIndex(timeline: readonly TimelineSprint[], start: string): number {
  const exact = timeline.findIndex((s) => s.start === start)
  if (exact >= 0) return exact
  const inside = timeline.findIndex((s) => s.start <= start && start <= s.finish)
  if (inside >= 0) return inside
  if (timeline.length === 0) return 0
  // Fora da linha do tempo, conta pela cadência: uma Janela antiga continua inteira,
  // com índice negativo, em vez de ser encurtada.
  const gap =
    timeline.length > 1
      ? Math.max(1, (Date.parse(timeline[1].start) - Date.parse(timeline[0].start)) / DAY_MS)
      : 14
  if (start < timeline[0].start) {
    return -Math.ceil((Date.parse(timeline[0].start) - Date.parse(start)) / DAY_MS / gap)
  }
  return timeline.length - 1
}

/** RN-RDM-06: na criação, as três Janelas coladas a partir da sprint escolhida. */
export function cascadePlan(
  timeline: readonly TimelineSprint[],
  start: number,
  lengths: Record<WindowKind, number> = {
    discovery: DEFAULT_WINDOW_LENGTH,
    quebra: DEFAULT_WINDOW_LENGTH,
    delivery: DEFAULT_WINDOW_LENGTH
  }
): FeaturePlan {
  let at = start
  const window = (kind: WindowKind): PlannedWindow => {
    const index = Math.min(at, timeline.length - 1)
    at += lengths[kind]
    return { start: timeline[index].start, length: lengths[kind] }
  }
  return {
    discovery: window('discovery'),
    quebra: window('quebra'),
    delivery: window('delivery'),
    archived: false
  }
}

// ─── O quadro do Roadmap ─────────────────────────────────────────────────────

export interface RoadmapWindow {
  kind: WindowKind
  start: string
  length: number
  /** Índices na linha do tempo; `end` é a última sprint coberta. */
  from: number
  end: number
  /** A Janela terminou e a Feature não chegou aonde o plano dizia (RN-RDM-17). */
  outOfWindow: boolean
}

export interface RoadmapFeature {
  key: string
  productId: string
  featureId: number | null
  slug: string | null
  title: string
  draft: boolean
  azureState: string | null
  priority: number | null
  phase: FlowPhase
  pendencies: Pendency[]
  opportunities: number
  /** PBIs de desenvolvimento entregues sobre o total ativo (RN-RDM-19). */
  delivery: { done: number; total: number; source: 'plano' | 'azure' } | null
  plan: FeaturePlan | null
  /** Arquivada no Roadmap: some da linha do tempo e da soma, sem perder o plano (RN-RDM-03). */
  archived: boolean
  windows: RoadmapWindow[]
  /** A Janela que contém a sprint corrente (RN-RDM-07). */
  currentWindow: WindowKind | null
  /** O Azure diz fechada e o plano ainda tem Janela pela frente (RN-RDM-08). */
  divergence: boolean
}

export type LoadStatus = 'dentro' | 'limite' | 'sobrecarga'

export interface TrailLoad {
  weight: number
  features: number
  status: LoadStatus
}

export interface RoadmapView {
  timeline: TimelineSprint[]
  current: number
  settings: RoadmapSettings
  products: Array<{ productId: string; workFolder: FlowBoard['workFolder']; error: string | null }>
  features: RoadmapFeature[]
  /** Por sprint da linha do tempo, sempre de todos os Produtos (RN-RDM-12). */
  load: Array<Record<Trail, TrailLoad>>
  /** Os marcos, mais novo primeiro, com o que mudou em cada Produto desde ele (RN-RDM-21). */
  milestones: RoadmapMilestone[]
}

export interface RoadmapMilestone {
  name: string
  takenAt: string
  changes: Array<MilestoneChange & { productId: string }>
}

export interface RoadmapProductInput {
  productId: string
  board: FlowBoard
  file: RoadmapFile
  error: string | null
  opportunities: ReadonlyMap<number, number>
  /** Filhos das Features no retrato, para o progresso sem plano. */
  children: ReadonlyArray<{ id: number; parentId: number | null; state: string; type: string }>
  /** PBIs de desenvolvimento ativos do plano de cada pasta, com o ID do Azure. */
  plannedDev: ReadonlyMap<string, number[]>
  deliveredStates: readonly string[]
  terminalStates: readonly string[]
  pbiTypes: readonly string[]
}

const PHASE_ORDER: FlowPhase[] = [
  'Sem Discovery',
  'Discovery',
  'Pronta para quebra',
  'Em quebra',
  'Publicada'
]

function atLeast(phase: FlowPhase, target: FlowPhase): boolean {
  const index = PHASE_ORDER.indexOf(phase)
  return index >= 0 && index >= PHASE_ORDER.indexOf(target)
}

/** O plano de uma Feature, inclusive o do rascunho que acabou de ganhar o ID (RN-RDM-02). */
export function planOf(
  file: RoadmapFile,
  feature: Pick<BoardFeature, 'key' | 'slug'>
): FeaturePlan | null {
  return (
    file.features[feature.key] ??
    (feature.slug !== null ? file.features[`pasta:${feature.slug}`] : undefined) ??
    null
  )
}

export function windowsOf(
  plan: FeaturePlan,
  timeline: readonly TimelineSprint[]
): Array<Omit<RoadmapWindow, 'outOfWindow'>> {
  return WINDOW_KINDS.map((kind) => {
    const from = sprintIndex(timeline, plan[kind].start)
    return {
      kind,
      start: plan[kind].start,
      length: plan[kind].length,
      from,
      end: from + plan[kind].length - 1
    }
  })
}

export function buildRoadmap(input: {
  products: RoadmapProductInput[]
  sprints: ReadonlyArray<{ startDate: string; finishDate: string; label: string }>
  today: string
  settings: RoadmapSettings
  ahead?: number
}): RoadmapView {
  const { sprints: timeline, current } = buildTimeline(
    input.sprints,
    input.today,
    input.ahead ?? 12
  )
  const features: RoadmapFeature[] = []

  for (const product of input.products) {
    const delivered = new Set(product.deliveredStates.map((s) => s.toLowerCase()))
    const terminal = new Set(product.terminalStates.map((s) => s.toLowerCase()))
    const pbiTypes = new Set(product.pbiTypes.map((s) => s.toLowerCase()))
    const stateOf = new Map(product.children.map((c) => [c.id, c.state.toLowerCase()]))

    for (const feature of product.board.features) {
      if (feature.phase === 'Arquivada' || feature.phase === 'Fora do fluxo') continue
      const plan = planOf(product.file, feature)

      // RN-RDM-19: o plano manda; sem plano, os filhos da Feature no Azure.
      const planned = feature.slug !== null ? product.plannedDev.get(feature.slug) : undefined
      let delivery: RoadmapFeature['delivery'] = null
      if (planned && planned.length > 0) {
        delivery = {
          done: planned.filter((id) => delivered.has(stateOf.get(id) ?? '')).length,
          total: planned.length,
          source: 'plano'
        }
      } else if (feature.featureId !== null) {
        const kids = product.children.filter(
          (c) =>
            c.parentId === feature.featureId &&
            pbiTypes.has(c.type.toLowerCase()) &&
            (delivered.has(c.state.toLowerCase()) || !terminal.has(c.state.toLowerCase()))
        )
        if (kids.length > 0) {
          delivery = {
            done: kids.filter((c) => delivered.has(c.state.toLowerCase())).length,
            total: kids.length,
            source: 'azure'
          }
        }
      }

      const windows: RoadmapWindow[] = plan
        ? windowsOf(plan, timeline).map((w) => {
            const ended = w.length > 0 && w.end < current
            let reached = true
            if (ended && w.kind === 'discovery')
              reached = atLeast(feature.phase, 'Pronta para quebra')
            if (ended && w.kind === 'quebra')
              reached =
                feature.phase === 'Publicada' &&
                (feature.plan === null || feature.plan.written >= feature.plan.active)
            if (ended && w.kind === 'delivery')
              reached = delivery !== null && delivery.total > 0 && delivery.done >= delivery.total
            return { ...w, outOfWindow: ended && !reached }
          })
        : []
      const currentWindow =
        windows.find((w) => w.length > 0 && w.from <= current && current <= w.end)?.kind ?? null
      const lastEnd = Math.max(-1, ...windows.filter((w) => w.length > 0).map((w) => w.end))
      const closed =
        feature.azureState !== null &&
        (delivered.has(feature.azureState.toLowerCase()) ||
          terminal.has(feature.azureState.toLowerCase()))

      features.push({
        key: feature.key,
        productId: product.productId,
        featureId: feature.featureId,
        slug: feature.slug,
        title: feature.title,
        draft: feature.featureId === null,
        azureState: feature.azureState,
        priority: feature.priority,
        phase: feature.phase,
        pendencies: feature.pendencies,
        opportunities:
          feature.featureId !== null ? (product.opportunities.get(feature.featureId) ?? 0) : 0,
        delivery,
        plan,
        archived: plan?.archived ?? false,
        windows,
        currentWindow,
        divergence: closed && lastEnd >= current
      })
    }
  }

  // RN-RDM-20: prioridade maior primeiro; sem prioridade depois; rascunho por último.
  features.sort((a, b) => {
    if (a.draft !== b.draft) return a.draft ? 1 : -1
    if (a.priority !== b.priority) {
      if (a.priority === null) return 1
      if (b.priority === null) return -1
      return b.priority - a.priority
    }
    return a.title.localeCompare(b.title, 'pt-BR')
  })

  return {
    timeline,
    current,
    settings: input.settings,
    products: input.products.map((p) => ({
      productId: p.productId,
      workFolder: p.board.workFolder,
      error: p.error
    })),
    features,
    load: computeLoad(
      features.filter((f) => !f.archived),
      timeline.length,
      input.settings
    ),
    milestones: mergedMilestones(input.products)
  }
}

// ─── Sobrecarga ──────────────────────────────────────────────────────────────

export function loadStatus(weight: number, limit: number): LoadStatus {
  // Pesos são frações de meio: arredondar evita 2,0000001 virar sobrecarga.
  const w = Math.round(weight * 1000)
  const l = Math.round(limit * 1000)
  return w < l ? 'dentro' : w === l ? 'limite' : 'sobrecarga'
}

/**
 * RN-RDM-10 a RN-RDM-12: o peso de cada Janela em toda sprint que ela cobre, somado
 * sobre todas as Features de todos os Produtos. Recebe a lista inteira: o filtro de
 * Produto entra depois, na tela.
 */
export function computeLoad(
  features: ReadonlyArray<Pick<RoadmapFeature, 'windows'>>,
  sprints: number,
  settings: RoadmapSettings
): Array<Record<Trail, TrailLoad>> {
  return Array.from({ length: sprints }, (_, index) => {
    const entry = {} as Record<Trail, TrailLoad>
    for (const trail of TRAILS) {
      let weight = 0
      let count = 0
      for (const feature of features) {
        const w = feature.windows.find((x) => x.length > 0 && x.from <= index && index <= x.end)
        const add = w ? settings.weights[w.kind][trail] : 0
        if (add > 0) {
          weight += add
          count += 1
        }
      }
      entry[trail] = { weight, features: count, status: loadStatus(weight, settings.limits[trail]) }
    }
    return entry
  })
}

/**
 * RN-RDM-14: a primeira sprint, a partir de `from`, em que a Janela cabe sem estourar
 * o limite de nenhuma trilha em que pesa. `null` se não cabe na linha do tempo.
 */
export function suggestStart(input: {
  features: ReadonlyArray<Pick<RoadmapFeature, 'key' | 'windows'>>
  key: string
  kind: WindowKind
  length: number
  from: number
  sprints: number
  settings: RoadmapSettings
}): number | null {
  if (input.length === 0) return input.from
  const others = input.features.map((f) =>
    f.key === input.key ? { windows: f.windows.filter((w) => w.kind !== input.kind) } : f
  )
  const load = computeLoad(others, input.sprints, input.settings)
  for (let start = Math.max(0, input.from); start + input.length <= input.sprints; start++) {
    let fits = true
    for (let i = start; i < start + input.length && fits; i++) {
      for (const trail of TRAILS) {
        const add = input.settings.weights[input.kind][trail]
        if (add > 0 && load[i][trail].weight + add > input.settings.limits[trail] + 1e-9)
          fits = false
      }
    }
    if (fits) return start
  }
  return null
}

// ─── Marcos ──────────────────────────────────────────────────────────────────

function mergedMilestones(
  products: ReadonlyArray<Pick<RoadmapProductInput, 'productId' | 'file'>>
): RoadmapMilestone[] {
  const seen = new Map<string, RoadmapMilestone>()
  for (const { productId, file } of products) {
    for (const m of file.milestones) {
      const id = `${m.takenAt}|${m.name}`
      const entry = seen.get(id) ?? { name: m.name, takenAt: m.takenAt, changes: [] }
      entry.changes.push(...milestoneDiff(m, file).map((c) => ({ ...c, productId })))
      seen.set(id, entry)
    }
  }
  return [...seen.values()].sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

export type MilestoneChange =
  | { kind: 'entrou'; key: string }
  | { kind: 'arquivada'; key: string }
  | { kind: 'saiu'; key: string }
  | { kind: 'movida'; key: string; window: WindowKind; from: PlannedWindow; to: PlannedWindow }

/** RN-RDM-21: o que mudou no plano desde o marco. */
export function milestoneDiff(milestone: Milestone, current: RoadmapFile): MilestoneChange[] {
  const changes: MilestoneChange[] = []
  const keys = new Set([...Object.keys(milestone.features), ...Object.keys(current.features)])
  for (const key of [...keys].sort()) {
    const before = milestone.features[key]
    const now = current.features[key]
    if (!before && now) {
      if (!now.archived) changes.push({ kind: 'entrou', key })
      continue
    }
    if (before && !now) {
      changes.push({ kind: 'saiu', key })
      continue
    }
    if (!before || !now) continue
    if (now.archived && !before.archived) {
      changes.push({ kind: 'arquivada', key })
      continue
    }
    for (const window of WINDOW_KINDS) {
      if (
        before[window].start !== now[window].start ||
        before[window].length !== now[window].length
      ) {
        changes.push({ kind: 'movida', key, window, from: before[window], to: now[window] })
      }
    }
  }
  return changes
}

// ─── Mudanças que a janela grava ─────────────────────────────────────────────

const featureKey = z.string().regex(/^(#\d{1,9}|pasta:[^/\\]{1,120})$/)

/** O que a janela pede para gravar. Chega pelo IPC: é validado no main antes. */
export const RoadmapChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('plan'), key: featureKey, plan: FeaturePlanSchema }),
  z.object({ kind: z.literal('archive'), key: featureKey, archived: z.boolean() }),
  z.object({
    kind: z.literal('milestone'),
    name: z.string().trim().min(1).max(80),
    takenAt: z.string()
  })
])
export type RoadmapChange = z.input<typeof RoadmapChangeSchema>

export function applyRoadmapChange(file: RoadmapFile, change: RoadmapChange): RoadmapFile {
  if (change.kind === 'milestone') {
    return {
      ...file,
      milestones: [
        ...file.milestones,
        { name: change.name, takenAt: change.takenAt, features: structuredClone(file.features) }
      ]
    }
  }
  const features = { ...file.features }
  // A chave do rascunho adotado passa a ser a da Feature do Azure (RN-RDM-02).
  if (change.kind === 'plan') {
    features[change.key] = FeaturePlanSchema.parse(change.plan)
    return { ...file, features }
  }
  const existing = features[change.key]
  if (!existing) return file
  features[change.key] = { ...existing, archived: change.archived }
  return { ...file, features }
}
