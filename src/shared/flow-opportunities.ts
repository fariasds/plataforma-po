import type { FeedbackLink, FlowSnapshot } from './flow-snapshot'

/**
 * As oportunidades do fluxo do PO e o encaixe de cada uma (RN-FLX-14 a RN-FLX-16,
 * RN-FLX-25). Uma oportunidade é uma dor com evidência: um feedback do Azure, algo
 * que o PO trouxe na conversa, ou um bug cuja análise concluiu que falta regra.
 *
 * Lógica pura: o main lê o retrato e os arquivos de `oportunidades/` e `bugs/`.
 */

export type OpportunitySource = 'feedback' | 'conversa' | 'bug'
export type FitStatus = 'Sem encaixe' | 'Proposto' | 'Encaixada' | 'Descartada'
export type BugVerdict = 'Bug' | 'Não é bug' | 'A validar'

/** O que o app lê de um arquivo de `oportunidades/`. */
export interface OpportunityFile {
  file: string
  title: string
  /** `feedback` com o ID, ou `conversa`. */
  origin: { source: 'feedback'; id: number } | { source: 'conversa' } | null
  /** A Feature indicada: `#<id>`, `nova: <título>` ou nada. */
  feature: { id: number } | { newTitle: string } | null
  discarded: { date: string | null; reason: string } | null
}

/** O que o app lê de uma Análise de Bug, em `bugs/`. */
export interface BugAnalysis {
  file: string
  bugId: number | null
  title: string
  verdict: BugVerdict | null
  violated: string[]
  preserve: string[]
  /** A Feature indicada para a regra ausente, quando o veredito é "A validar". */
  feature: { id: number } | { newTitle: string } | null
}

export interface Opportunity {
  /** `feedback:<id>`, `conversa:<arquivo>` ou `bug:<id>`. */
  key: string
  source: OpportunitySource
  /** ID do work item no Azure, quando há. */
  azureId: number | null
  title: string
  /** Arquivo em `oportunidades/` ou `bugs/`, quando há. */
  file: string | null
  fit: FitStatus
  /** A Feature em que ela entra ou entrou. */
  feature: { id: number; title: string | null } | { newTitle: string } | null
  /** O que o PO faz no Azure para fechar o encaixe (RN-FLX-16), ou `null`. */
  action: string | null
  discardReason: string | null
}

// ─── Leitura dos arquivos ────────────────────────────────────────────────────

function lines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/)
}

function heading(all: string[], fallback: string): string {
  return all.map((l) => /^#\s+(.+?)\s*$/.exec(l)?.[1]).find((t) => t !== undefined) ?? fallback
}

function featureLine(all: string[]): OpportunityFile['feature'] {
  const line = all.find((l) => /^Feature:/.test(l))
  if (!line) return null
  const value = line.replace(/^Feature:\s*/, '').trim()
  const id = /^#(\d+)\b/.exec(value)
  if (id) return { id: Number(id[1]) }
  const created = /^nova:\s*(.+)$/i.exec(value)
  return created ? { newTitle: created[1].trim() } : null
}

export function parseOpportunityFile(file: string, text: string): OpportunityFile {
  const all = lines(text)
  const originLine =
    all
      .find((l) => /^Origem:/.test(l))
      ?.replace(/^Origem:\s*/, '')
      .trim() ?? ''
  const feedbackId = /feedback\s*#(\d+)/i.exec(originLine)
  const origin: OpportunityFile['origin'] = feedbackId
    ? { source: 'feedback', id: Number(feedbackId[1]) }
    : /^conversa\b/i.test(originLine)
      ? { source: 'conversa' }
      : null
  const discardLine = all.find((l) => /^Descartada:/.test(l))
  const discarded = discardLine
    ? (() => {
        const value = discardLine.replace(/^Descartada:\s*/, '')
        const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(value)?.[1] ?? null
        const reason = value
          .split('·')
          .slice(date ? 1 : 0)
          .join('·')
          .trim()
        return { date, reason }
      })()
    : null
  return {
    file,
    title: heading(all, file.replace(/\.md$/i, '')),
    origin,
    feature: featureLine(all),
    discarded
  }
}

function verdict(value: string | undefined): BugVerdict | null {
  const v = (value ?? '').toLowerCase()
  if (v.startsWith('não é bug') || v.startsWith('nao e bug')) return 'Não é bug'
  if (v.startsWith('a validar')) return 'A validar'
  if (v.startsWith('bug')) return 'Bug'
  return null
}

function ruleList(all: string[], label: string): string[] {
  const line = all.find((l) => new RegExp(`^${label}:`).test(l)) ?? ''
  return [...new Set([...line.matchAll(/RN-(?:[A-Z]{2,}-)*[A-Z]{2,}-\d+/g)].map((m) => m[0]))]
}

export function parseBugAnalysis(file: string, text: string): BugAnalysis {
  const all = lines(text)
  const title = heading(all, file.replace(/\.md$/i, ''))
  const fromTitle = /BUG\s*#?(\d+)/i.exec(title)?.[1]
  const fromFile = /BUG-(\d+)/i.exec(file)?.[1]
  return {
    file,
    bugId: fromTitle ? Number(fromTitle) : fromFile ? Number(fromFile) : null,
    title: title.replace(/^BUG\s*#?\d+\s*·\s*/i, ''),
    verdict: verdict(all.find((l) => /^Veredito:/.test(l))?.replace(/^Veredito:\s*/, '')),
    violated: ruleList(all, 'Violada'),
    preserve: ruleList(all, 'Preservar'),
    feature: featureLine(all)
  }
}

// ─── O encaixe ───────────────────────────────────────────────────────────────

const LINK_PHRASE: Record<FeedbackLink, string> = {
  parent: 'como pai de',
  child: 'como filho de',
  related: 'com vínculo Related a'
}

export interface OpportunitiesInput {
  snapshot: FlowSnapshot | null
  files: OpportunityFile[]
  bugs: BugAnalysis[]
  /** O vínculo que a Configuração declara para o feedback (RN-CFG-14); `null` sem feedback. */
  link: FeedbackLink | null
}

/** Toda oportunidade do Produto, com o encaixe calculado (RN-FLX-15). */
export function buildOpportunities(input: OpportunitiesInput): Opportunity[] {
  const featureTitle = new Map((input.snapshot?.features ?? []).map((f) => [f.id, f.title]))
  const withTitle = (feature: OpportunityFile['feature']): Opportunity['feature'] =>
    feature && 'id' in feature
      ? { id: feature.id, title: featureTitle.get(feature.id) ?? null }
      : feature

  const fileForFeedback = new Map(
    input.files.flatMap((f) => (f.origin?.source === 'feedback' ? [[f.origin.id, f] as const] : []))
  )
  const result: Opportunity[] = []

  // Feedback do Azure (RN-FLX-14): o vínculo no Azure manda; o arquivo, se houver, propõe.
  for (const feedback of input.snapshot?.feedbacks ?? []) {
    const file = fileForFeedback.get(feedback.id) ?? null
    const linked = feedback.featureIds[0]
    let fit: FitStatus = 'Sem encaixe'
    let feature: Opportunity['feature'] = null
    let action: string | null = null
    if (linked !== undefined) {
      fit = 'Encaixada'
      feature = { id: linked, title: featureTitle.get(linked) ?? null }
    } else if (file?.discarded) {
      fit = 'Descartada'
    } else if (file?.feature) {
      fit = 'Proposto'
      feature = withTitle(file.feature)
      if ('id' in file.feature && input.link) {
        action = `No Azure, ligar #${feedback.id} ${LINK_PHRASE[input.link]} #${file.feature.id}.`
      } else if ('newTitle' in file.feature) {
        action = `Criar no Azure a Feature "${file.feature.newTitle}" e ligar #${feedback.id} a ela.`
      }
    }
    result.push({
      key: `feedback:${feedback.id}`,
      source: 'feedback',
      azureId: feedback.id,
      title: feedback.title,
      file: file?.file ?? null,
      fit,
      feature,
      action,
      discardReason: fit === 'Descartada' ? (file?.discarded?.reason ?? null) : null
    })
  }

  // Da conversa: não há item no Azure; a Feature indicada que existe já é o encaixe.
  for (const file of input.files.filter((f) => f.origin?.source !== 'feedback')) {
    let fit: FitStatus = 'Sem encaixe'
    let action: string | null = null
    if (file.discarded) fit = 'Descartada'
    else if (file.feature && 'id' in file.feature) {
      fit = featureTitle.has(file.feature.id) ? 'Encaixada' : 'Proposto'
      if (fit === 'Proposto')
        action = `A Feature #${file.feature.id} não está no retrato: confira o ID.`
    } else if (file.feature) {
      fit = 'Proposto'
      action = `Criar no Azure a Feature "${file.feature.newTitle}" e trocar a linha Feature: pelo ID.`
    }
    result.push({
      key: `conversa:${file.file}`,
      source: 'conversa',
      azureId: null,
      title: file.title,
      file: file.file,
      fit,
      feature: withTitle(file.feature),
      action,
      discardReason: file.discarded?.reason ?? null
    })
  }

  // RN-FLX-25: regra ausente é oportunidade. Com a Feature indicada, ela já tem destino.
  for (const bug of input.bugs.filter((b) => b.verdict === 'A validar')) {
    const feature = withTitle(bug.feature)
    result.push({
      key: `bug:${bug.bugId ?? bug.file}`,
      source: 'bug',
      azureId: bug.bugId,
      title: bug.title,
      file: bug.file,
      fit: feature ? 'Proposto' : 'Sem encaixe',
      feature,
      action: feature ? null : 'Nenhuma regra decide este bug: decida se vira Feature.',
      discardReason: null
    })
  }

  const order: Record<FitStatus, number> = {
    'Sem encaixe': 0,
    Proposto: 1,
    Encaixada: 2,
    Descartada: 3
  }
  return result.sort((a, b) => order[a.fit] - order[b.fit] || a.key.localeCompare(b.key))
}

/** Quantas oportunidades cada Feature tem, encaixadas ou propostas, para o Roadmap. */
export function opportunitiesByFeature(opportunities: readonly Opportunity[]): Map<number, number> {
  const count = new Map<number, number>()
  for (const o of opportunities) {
    if ((o.fit === 'Encaixada' || o.fit === 'Proposto') && o.feature && 'id' in o.feature) {
      count.set(o.feature.id, (count.get(o.feature.id) ?? 0) + 1)
    }
  }
  return count
}

export interface OpportunitiesView {
  productId: string
  snapshotTakenAt: string | null
  /** `false` sem feedback na Configuração: as oportunidades vêm só da conversa e dos bugs. */
  feedbackConfigured: boolean
  workFolder: 'unset' | 'missing' | 'ok'
  opportunities: Opportunity[]
}
