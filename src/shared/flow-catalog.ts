import type { RuleCatalog } from './flow-board'

/**
 * O catálogo de regras de negócio de um Produto (ADR 0015): uma página por domínio,
 * em Markdown, na pasta `catalogo/` da pasta de trabalho. A regra é reconhecida
 * pelo título, `### <ID> · <título>` (RN-CAT-02); o corpo é da IA e do PO.
 *
 * Lógica pura: o main lê os arquivos e chama daqui.
 */

export type RuleStatus = 'Ativa' | 'Em revisão' | 'Descontinuada'
export type RuleValidation = 'Não validada' | 'Validada' | 'Divergente'

export interface CatalogRule {
  id: string
  title: string
  /** Arquivo em `catalogo/`, com `/`. */
  file: string
  line: number
  status: RuleStatus | null
  validation: RuleValidation | null
  /** PBIs da linha `Origem:`. */
  origins: number[]
  /** PBIs citados no bloco "Atualizações" da regra. */
  updates: number[]
  /** `AAAA-MM-DD` da linha `Atualizado:`, ou `null`. */
  updated: string | null
  /** Resumo do texto da regra, para saber se ela mudou entre duas versões. */
  hash: string
}

export interface CatalogPage {
  file: string
  /** O primeiro `# Título` da página, ou o nome do arquivo. */
  title: string
  rules: CatalogRule[]
}

export interface CatalogIndex {
  pages: CatalogPage[]
  rules: Map<string, CatalogRule>
  /** IDs que aparecem em mais de um título. Vale o primeiro. */
  duplicates: string[]
}

// ─── Resumo de texto ─────────────────────────────────────────────────────────

/**
 * Resumo de 53 bits do texto (cyrb53), com o fim de linha normalizado: serve para
 * saber se uma página ou regra mudou, não para segurança.
 */
export function contentHash(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

// ─── Leitura de uma página ───────────────────────────────────────────────────

function meta(line: string, label: string): string | null {
  const match = new RegExp(`${label}:\\s*([^\`·]*)`).exec(line)
  return match ? match[1].trim() : null
}

function withoutParentheses(text: string): string {
  let result = text
  for (let i = 0; i < 5 && /\([^()]*\)/.test(result); i++)
    result = result.replace(/\([^()]*\)/g, ' ')
  return result
}

function ruleStatus(value: string | null): RuleStatus | null {
  const v = (value ?? '').toLowerCase()
  if (v.startsWith('ativa')) return 'Ativa'
  if (v.startsWith('em revis')) return 'Em revisão'
  if (v.startsWith('descontinuada')) return 'Descontinuada'
  return null
}

function ruleValidation(value: string | null): RuleValidation | null {
  const v = (value ?? '').toLowerCase()
  if (v.startsWith('não validada') || v.startsWith('nao validada')) return 'Não validada'
  if (v.startsWith('validada')) return 'Validada'
  if (v.startsWith('divergente')) return 'Divergente'
  return null
}

/** As regras de uma página do catálogo, pelo padrão de ID do Produto (RN-CAT-02). */
export function parseCatalogPage(file: string, text: string, idPattern: string): CatalogPage {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const heading = new RegExp(`^###\\s+(${idPattern})\\s*·\\s*(.+?)\\s*$`)
  const title =
    lines.map((l) => /^#\s+(.+?)\s*$/.exec(l)?.[1]).find((t) => t !== undefined) ??
    file.replace(/\.md$/i, '').split('/').pop()!

  const starts: Array<{ index: number; id: string; title: string }> = []
  lines.forEach((line, index) => {
    const match = heading.exec(line)
    if (match) starts.push({ index, id: match[1], title: match[2] })
  })

  const rules = starts.map((start, n) => {
    // O corpo vai até o próximo título de nível 1 a 3.
    let end = n + 1 < starts.length ? starts[n + 1].index : lines.length
    for (let i = start.index + 1; i < end; i++) {
      if (/^#{1,3}\s/.test(lines[i])) {
        end = i
        break
      }
    }
    const body = lines.slice(start.index, end)
    const metaLine = body.slice(1, 4).find((l) => /Status:|Origem:|Atualizado:/.test(l)) ?? ''
    const origin = meta(metaLine, 'Origem')
    const updatesAt = body.findIndex((l) => /Atualiza[çc][õo]es/i.test(l))
    const updates =
      updatesAt < 0
        ? []
        : body
            .slice(updatesAt)
            .flatMap((l) => [...l.matchAll(/(?:#|\bPBI\s*#?)(\d{2,})/gi)].map((m) => Number(m[1])))
    return {
      id: start.id,
      title: start.title,
      file,
      line: start.index + 1,
      status: ruleStatus(meta(metaLine, 'Status')),
      validation: ruleValidation(meta(metaLine, 'Validação')),
      origins: origin
        ? [
            ...new Set(
              [...withoutParentheses(origin).matchAll(/\b(\d{3,})\b/g)].map((m) => Number(m[1]))
            )
          ]
        : [],
      updates: [...new Set(updates)],
      updated: /\b(\d{4}-\d{2}-\d{2})\b/.exec(meta(metaLine, 'Atualizado') ?? '')?.[1] ?? null,
      hash: contentHash(body.join('\n').trimEnd())
    }
  })
  return { file, title, rules }
}

export function buildCatalogIndex(pages: CatalogPage[]): CatalogIndex {
  const rules = new Map<string, CatalogRule>()
  const duplicates = new Set<string>()
  for (const page of pages) {
    for (const rule of page.rules) {
      if (rules.has(rule.id)) duplicates.add(rule.id)
      else rules.set(rule.id, rule)
    }
  }
  return { pages, rules, duplicates: [...duplicates].sort() }
}

function pbisOf(rule: CatalogRule): number[] {
  return [...new Set([...rule.origins, ...rule.updates])]
}

/**
 * O catálogo como o quadro do fluxo o consulta (RN-FLX-05, RN-CAT-04): o do Produto
 * e os consultados, que só servem para citar (RN-CAT-05).
 */
export function ruleCatalog(
  index: CatalogIndex,
  consulted: readonly CatalogIndex[] = []
): RuleCatalog {
  return {
    origins: (id) => {
      const rule = index.rules.get(id)
      return rule ? pbisOf(rule) : null
    },
    find: (id) => {
      const own = index.rules.get(id)
      const rule = own ?? consulted.map((c) => c.rules.get(id)).find((r) => r !== undefined)
      if (!rule) return null
      return { status: rule.status, updated: rule.updated, origins: pbisOf(rule), consulted: !own }
    }
  }
}

// ─── Diferença entre duas versões de uma página ──────────────────────────────

export interface RuleDiff {
  added: string[]
  changed: string[]
  removed: string[]
}

/** O que muda nas regras de `before` para `after`, pelo ID e pelo texto. */
export function diffRules(before: CatalogPage | null, after: CatalogPage | null): RuleDiff {
  const old = new Map((before?.rules ?? []).map((r) => [r.id, r.hash]))
  const now = new Map((after?.rules ?? []).map((r) => [r.id, r.hash]))
  return {
    added: [...now.keys()].filter((id) => !old.has(id)),
    changed: [...now.keys()].filter((id) => old.has(id) && old.get(id) !== now.get(id)),
    removed: [...old.keys()].filter((id) => !now.has(id))
  }
}
