import { isActivePbi, type ParsedFeatureFolder } from './flow-artifacts'
import type { SnapshotFeature, SnapshotItem } from './flow-snapshot'

/**
 * Reconciliação com o Azure (RN-FLX-12, RN-FLX-13, ADR 0012): o app não cria work
 * item, então o PO cria o PBI ou a Feature no Azure e o app reconhece o item na
 * leitura seguinte, pelo título. Quem confirma é o PO, com um clique; o app só
 * propõe. Lógica pura, inclusive a edição do arquivo.
 */

/** Título comparável: sem maiúscula, acento, pontuação nem espaço repetido. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Palavras que não distinguem um título de outro. */
const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'para',
  'por',
  'com',
  'que',
  'se',
  'ao',
  'aos'
])

function words(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
  )
}

/**
 * Quanto dois títulos se parecem, de 0 a 1: as palavras em comum sobre as do menor
 * título. Cobre o PO que encurta o título ao colar no Azure.
 */
export function titleSimilarity(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (wa.size === 0 || wb.size === 0) return 0
  const common = [...wa].filter((w) => wb.has(w)).length
  return common / Math.min(wa.size, wb.size)
}

/** A partir daqui o título é "parecido" (RN-FLX-12). */
export const SIMILAR_TITLE = 0.75

export type MatchKind = 'exact' | 'similar' | 'ambiguous' | 'none'

export interface Candidate {
  id: number
  title: string
  state: string
  type: string
}

export interface TitleMatch {
  match: MatchKind
  /** `exact` e `similar`: um. `ambiguous`: dois ou mais. `none`: nenhum. */
  candidates: Candidate[]
}

function candidate(item: Pick<SnapshotItem, 'id' | 'title' | 'state' | 'type'>): Candidate {
  return { id: item.id, title: item.title, state: item.state, type: item.type }
}

/**
 * Título igual vale antes de parecido. Dois iguais, ou dois igualmente parecidos,
 * ficam para o PO escolher: o app nunca escolhe sozinho.
 */
export function matchTitle(
  title: string,
  items: ReadonlyArray<Pick<SnapshotItem, 'id' | 'title' | 'state' | 'type'>>
): TitleMatch {
  const target = normalizeTitle(title)
  const exact = items.filter((item) => normalizeTitle(item.title) === target)
  if (exact.length === 1) return { match: 'exact', candidates: [candidate(exact[0])] }
  if (exact.length > 1) return { match: 'ambiguous', candidates: exact.map(candidate) }

  const scored = items
    .map((item) => ({ item, score: titleSimilarity(title, item.title) }))
    .filter((entry) => entry.score >= SIMILAR_TITLE)
    .sort((a, b) => b.score - a.score || a.item.id - b.item.id)
  if (scored.length === 0) return { match: 'none', candidates: [] }
  const best = scored.filter((entry) => entry.score === scored[0].score)
  return best.length === 1
    ? { match: 'similar', candidates: [candidate(best[0].item)] }
    : { match: 'ambiguous', candidates: best.map((entry) => candidate(entry.item)) }
}

export interface PbiReconciliation extends TitleMatch {
  /** `P3`. */
  pbi: string
  title: string
}

/**
 * PBI ativo sem ID do Azure, comparado com os filhos da Feature no retrato que
 * nenhum outro PBI do plano já usa (RN-FLX-12).
 */
export function reconcilePlan(
  folder: ParsedFeatureFolder,
  children: readonly SnapshotItem[]
): PbiReconciliation[] {
  const pbis = folder.plan?.pbis ?? []
  const used = new Set(pbis.flatMap((pbi) => (pbi.azureId !== null ? [pbi.azureId] : [])))
  const free = children.filter((child) => !used.has(child.id))
  return pbis
    .filter((pbi) => isActivePbi(pbi) && pbi.azureId === null)
    .map((pbi) => ({ pbi: pbi.key, title: pbi.title, ...matchTitle(pbi.title, free) }))
}

/**
 * Pasta rascunho (`Feature: #a criar`) comparada com as Features abertas do
 * retrato que ainda não têm pasta (RN-FLX-13).
 */
export function reconcileDraft(
  folder: ParsedFeatureFolder,
  features: readonly SnapshotFeature[],
  withFolder: ReadonlySet<number>
): TitleMatch | null {
  if (!folder.draft || !folder.title) return null
  return matchTitle(
    folder.title,
    features.filter((f) => !withFolder.has(f.id))
  )
}

// ─── Edição dos arquivos ─────────────────────────────────────────────────────

/** Troca uma linha preservando o fim de linha do arquivo (o PO pode usar CRLF). */
function replaceLine(text: string, index: number, line: string): string {
  const lines = text.split('\n')
  const cr = lines[index].endsWith('\r') ? '\r' : ''
  lines[index] = line + cr
  return lines.join('\n')
}

/**
 * O plano com `Azure: #<id>` no PBI. Mexe só no começo da linha `Azure:` daquele
 * PBI; o status e o resto ficam como o PO escreveu. `null` se o PBI não existe ou
 * não tem a linha.
 */
export function setPlanAzureId(text: string, pbiKey: string, azureId: number): string | null {
  const lines = text.split('\n')
  const start = lines.findIndex((line) =>
    new RegExp(`^###\\s+${pbiKey}\\s*·`).test(line.replace(/\r$/, ''))
  )
  if (start < 0) return null
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    if (/^#{1,3}\s/.test(line)) return null
    if (/^Azure:/.test(line)) {
      const rest = line.replace(/^Azure:\s*[^·]*/, '').trimStart()
      return replaceLine(text, i, `Azure: #${azureId}${rest ? ` ${rest}` : ''}`)
    }
  }
  return null
}

/** O README com `Feature: #<id>` no lugar de `Feature: #a criar`. `null` se não há rascunho. */
export function setReadmeFeatureId(text: string, featureId: number): string | null {
  const lines = text.split('\n')
  const index = lines.findIndex((line) => /^Feature:\s*#?\s*a criar\b/i.test(line))
  if (index < 0) return null
  const rest = lines[index].replace(/\r$/, '').replace(/^Feature:\s*#?\s*a criar\b/i, '')
  return replaceLine(text, index, `Feature: #${featureId}${rest}`)
}
