/**
 * O retrato do Azure para o fluxo do PO (RN-FLX-01, RN-FLX-02, ADR 0011).
 *
 * A janela lê o Azure e grava este retrato nos Dados de trabalho; o servidor MCP
 * o lê do disco, porque não faz rede nem lê o PAT (RN-SEC-34). Aqui ficam o
 * formato, os limites e a lógica pura, longe do Electron, para serem testáveis.
 */

/** Features e bugs fechados entram no retrato até este tanto de dias depois (RN-FLX-01). */
export const SNAPSHOT_WINDOW_DAYS = 180

/** Os limites do pedido à IA (RN-SEC-24), porque o retrato também vai para ela. */
export const SNAPSHOT_TITLE_CHARS = 300
export const SNAPSHOT_DESCRIPTION_CHARS = 4000
/**
 * Soma das descrições de um retrato. Acima disso cada uma recebe uma fatia
 * igual: os Dados de trabalho têm teto de 1 MB por arquivo.
 */
export const SNAPSHOT_DESCRIPTIONS_TOTAL_CHARS = 400_000

/** Como o feedback se liga à Feature no Azure (`poFlow.feedback.link`, RN-CFG-14). */
export type FeedbackLink = 'parent' | 'child' | 'related'

export interface SnapshotItem {
  id: number
  type: string
  title: string
  state: string
  /** Pai no Azure (`System.Parent`), ou `null`. */
  parentId: number | null
}

export interface SnapshotFeature extends SnapshotItem {
  /** Valor do campo de prioridade do Produto; `null` sem o campo ou sem valor. */
  priority: number | null
  createdDate: string
  /** Última troca de estado. Com a Feature fechada, é quando ela fechou. */
  stateChangeDate: string | null
  /** IDs dos filhos, na ordem do Azure. */
  childIds: number[]
}

export interface SnapshotFeedback extends SnapshotItem {
  /** Texto puro, redigido e cortado (RN-SEC-24). */
  description: string
  /** Features do retrato ligadas a este feedback, pelo vínculo da Configuração. */
  featureIds: number[]
}

export interface SnapshotBug extends SnapshotItem {
  createdDate: string
  closedDate: string | null
  /** `true` enquanto o bug não está num estado terminal do Perfil de processo. */
  open: boolean
  /** Só o bug aberto leva descrição: é ele que ainda vai ser analisado. */
  description: string
}

export interface FlowSnapshot {
  version: 1
  productId: string
  /** Quando o retrato foi tirado, em ISO com hora. A IA diz esta data ao PO (RN-FLX-02). */
  takenAt: string
  /** Primeiro dia da janela de fechados, `AAAA-MM-DD`. */
  windowStart: string
  /** O campo de prioridade lido, ou `null` sem campo configurado. */
  priorityField: string | null
  features: SnapshotFeature[]
  /** Filhos das Features, de qualquer tipo. */
  children: SnapshotItem[]
  /** `null` quando o Produto não declara feedback na Configuração. */
  feedbacks: SnapshotFeedback[] | null
  bugs: SnapshotBug[]
}

/**
 * O que a janela recebe depois de atualizar: as contagens e a data. A descrição
 * nunca atravessa para a janela (RN-SEC-24).
 */
export interface FlowSnapshotSummary {
  productId: string
  takenAt: string
  features: number
  children: number
  /** `null` sem feedback configurado. */
  feedbacks: number | null
  bugs: number
  openBugs: number
}

function keyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
}

/** Chaves dos Dados de trabalho do fluxo do PO, pelo ID do Produto (RN-CFG-08). */
export const flowKeys = {
  snapshot: (productId: string): string => `flow:snapshot:${keyPart(productId)}`
}

/** `AAAA-MM-DD` de `days` dias antes de `now`, no fuso da máquina. */
export function windowStartDate(now: Date, days = SNAPSHOT_WINDOW_DAYS): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Quanto de descrição cabe a cada item para o retrato inteiro não passar do teto. */
export function snapshotDescriptionBudget(itemCount: number): number {
  if (itemCount <= 0) return SNAPSHOT_DESCRIPTION_CHARS
  return Math.min(
    SNAPSHOT_DESCRIPTION_CHARS,
    Math.floor(SNAPSHOT_DESCRIPTIONS_TOTAL_CHARS / itemCount)
  )
}

/** ID do work item no fim da URL de um vínculo (`…/workItems/123`). */
export function relationTargetId(url: unknown): number | null {
  if (typeof url !== 'string') return null
  const match = /\/workItems\/(\d+)$/i.exec(url)
  return match ? Number(match[1]) : null
}

/**
 * Features ligadas a um feedback, pelo vínculo que a Configuração declara
 * (RN-CFG-14). `related` traz os IDs dos itens com vínculo "Related" com o feedback.
 */
export function linkedFeatureIds(
  feedback: { id: number; parentId: number | null; related: number[] },
  features: readonly { id: number; parentId: number | null }[],
  link: FeedbackLink
): number[] {
  const known = new Set(features.map((f) => f.id))
  switch (link) {
    case 'parent':
      return features.filter((f) => f.parentId === feedback.id).map((f) => f.id)
    case 'child':
      return feedback.parentId !== null && known.has(feedback.parentId) ? [feedback.parentId] : []
    case 'related':
      return [...new Set(feedback.related)].filter((id) => known.has(id)).sort((a, b) => a - b)
  }
}

export function summarizeSnapshot(snapshot: FlowSnapshot): FlowSnapshotSummary {
  return {
    productId: snapshot.productId,
    takenAt: snapshot.takenAt,
    features: snapshot.features.length,
    children: snapshot.children.length,
    feedbacks: snapshot.feedbacks?.length ?? null,
    bugs: snapshot.bugs.length,
    openBugs: snapshot.bugs.filter((bug) => bug.open).length
  }
}
