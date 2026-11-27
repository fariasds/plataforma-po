import { contentHash, diffRules, parseCatalogPage, type RuleDiff } from './flow-catalog'

/**
 * Absorver o catálogo da wiki (RN-CAT-03, ADR 0015): a wiki é a versão oficial, a
 * cópia na pasta de trabalho é a de trabalho. O que a última absorção trouxe fica
 * anotado em `catalogo/.absorcao.json`, para saber o que mudou de cada lado.
 *
 * Lógica pura: o main lê a wiki e o disco, e grava o que daqui sair.
 */

export const ABSORB_FILE = '.absorcao.json'

export interface WikiPage {
  /** Caminho da página na wiki, como o Azure devolve: `/Catálogo/Loja/Cupons`. */
  path: string
  content: string
}

export interface AbsorbBase {
  version: 1
  /** Quando foi a última absorção, em ISO. */
  absorbedAt: string
  source: { wiki: string; rootPage: string }
  /** Cada página absorvida: o arquivo local e o resumo do conteúdo que veio da wiki. */
  pages: Record<string, { file: string; hash: string }>
}

export type AbsorbStatus =
  'new' | 'changed' | 'unchanged' | 'local-changed' | 'conflict' | 'removed-in-wiki'

export interface AbsorbPageEntry {
  path: string
  file: string
  status: AbsorbStatus
  /** O que muda nas regras se a versão da wiki entrar. */
  rules: RuleDiff
}

export interface AbsorbPlan {
  pages: AbsorbPageEntry[]
  /** Arquivos do catálogo que nunca vieram da wiki: páginas novas do PO, a publicar. */
  localOnly: string[]
}

/** Caractere que o Windows não aceita em nome de arquivo. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"\\|?*\u0000-\u001f]/g

/**
 * O arquivo local de uma página, relativo a `catalogo/`: o caminho abaixo da página
 * raiz, uma pasta por nível. A raiz em si é índice e não vira arquivo.
 */
export function pageFile(rootPage: string, pagePath: string): string | null {
  const root = rootPage.replace(/\/+$/, '')
  if (pagePath === root || !pagePath.startsWith(`${root}/`)) return null
  const segments = pagePath
    .slice(root.length + 1)
    .split('/')
    .map((segment) => segment.replace(UNSAFE, '-').replace(/^\.+/, '').trim())
  if (segments.some((segment) => segment === '')) return null
  return `${segments.join('/')}.md`
}

/** O que a absorção faria, página a página, comparando wiki, cópia local e a última absorção. */
export function planAbsorb(
  rootPage: string,
  wiki: readonly WikiPage[],
  local: Readonly<Record<string, string>>,
  base: AbsorbBase | null,
  idPattern: string
): AbsorbPlan {
  const pages: AbsorbPageEntry[] = []
  const seenFiles = new Set<string>()
  const parse = (
    file: string,
    text: string | undefined
  ): ReturnType<typeof parseCatalogPage> | null =>
    text === undefined ? null : parseCatalogPage(file, text, idPattern)

  for (const page of wiki) {
    const file = base?.pages[page.path]?.file ?? pageFile(rootPage, page.path)
    if (!file) continue
    seenFiles.add(file)
    const localText = local[file]
    const known = base?.pages[page.path]
    const wikiHash = contentHash(page.content)
    let status: AbsorbStatus
    if (!known) {
      if (localText === undefined) status = 'new'
      else status = contentHash(localText) === wikiHash ? 'unchanged' : 'conflict'
    } else {
      const wikiChanged = wikiHash !== known.hash
      const localChanged = localText === undefined || contentHash(localText) !== known.hash
      status = wikiChanged
        ? localChanged
          ? 'conflict'
          : 'changed'
        : localChanged
          ? 'local-changed'
          : 'unchanged'
    }
    pages.push({
      path: page.path,
      file,
      status,
      rules: diffRules(parse(file, localText), parse(file, page.content))
    })
  }

  const inWiki = new Set(wiki.map((p) => p.path))
  for (const [path, known] of Object.entries(base?.pages ?? {})) {
    if (inWiki.has(path)) continue
    seenFiles.add(known.file)
    pages.push({
      path,
      file: known.file,
      status: 'removed-in-wiki',
      rules: { added: [], changed: [], removed: [] }
    })
  }

  pages.sort((a, b) => a.file.localeCompare(b.file))
  const localOnly = Object.keys(local)
    .filter((file) => !seenFiles.has(file))
    .sort()
  return { pages, localOnly }
}

export interface AbsorbResult {
  /** Arquivos a gravar em `catalogo/`, com o conteúdo da wiki. */
  writes: Array<{ file: string; content: string }>
  base: AbsorbBase
  /** Páginas em conflito que o PO não escolheu: ficam como estão. */
  skipped: string[]
}

/**
 * Aplica a absorção. Página nova ou mudada só na wiki entra; mudada só aqui fica,
 * e continua a publicar; em conflito, entra só se o PO escolheu a da wiki.
 */
export function applyAbsorb(
  plan: AbsorbPlan,
  wiki: readonly WikiPage[],
  previous: AbsorbBase | null,
  source: AbsorbBase['source'],
  useWiki: ReadonlySet<string>,
  now: Date
): AbsorbResult {
  const contentOf = new Map(wiki.map((p) => [p.path, p.content]))
  const pages: AbsorbBase['pages'] = {}
  const writes: AbsorbResult['writes'] = []
  const skipped: string[] = []
  for (const entry of plan.pages) {
    const content = contentOf.get(entry.path)
    if (content === undefined) continue // saiu da wiki: a cópia local fica, sem vínculo.
    const take =
      entry.status === 'new' ||
      entry.status === 'changed' ||
      (entry.status === 'conflict' && useWiki.has(entry.path))
    if (take) writes.push({ file: entry.file, content })
    if (entry.status === 'conflict' && !take) skipped.push(entry.path)
    // A base só anda para a versão da wiki que de fato entrou ou que já era igual.
    const kept = previous?.pages[entry.path]
    if (take || entry.status === 'unchanged' || entry.status === 'local-changed') {
      pages[entry.path] = {
        file: entry.file,
        hash: take || entry.status === 'unchanged' ? contentHash(content) : kept!.hash
      }
    } else if (kept) {
      pages[entry.path] = kept
    }
  }
  return {
    writes,
    base: { version: 1, absorbedAt: now.toISOString(), source, pages },
    skipped
  }
}

/** Arquivos do catálogo diferentes da última absorção, ou que nunca vieram dela (RN-CAT-06). */
export function filesToPublish(
  local: Readonly<Record<string, string>>,
  base: AbsorbBase | null
): string[] {
  const hashOf = new Map(Object.values(base?.pages ?? {}).map((p) => [p.file, p.hash]))
  return Object.entries(local)
    .filter(([file, text]) => hashOf.get(file) !== contentHash(text))
    .map(([file]) => file)
    .sort()
}

// ─── O que a janela recebe ───────────────────────────────────────────────────

export interface CatalogRuleView {
  id: string
  title: string
  status: string | null
  validation: string | null
  updated: string | null
}

export interface CatalogPageView {
  file: string
  title: string
  rules: CatalogRuleView[]
  /** Diferente da última absorção, ou nunca veio dela (RN-CAT-06). */
  toPublish: boolean
}

export interface CatalogView {
  productId: string
  /** `null`: o Produto não declara catálogo na Configuração. */
  source: { kind: 'wiki'; wiki: string; rootPage: string } | { kind: 'local' } | null
  workFolder: 'unset' | 'missing' | 'ok'
  /** Quando foi a última absorção da wiki, em ISO. */
  absorbedAt: string | null
  pages: CatalogPageView[]
  /** IDs que aparecem em mais de uma página. */
  duplicates: string[]
  /** Os catálogos de outros Produtos que este consulta (RN-CAT-05). */
  consults: Array<{ productId: string; name: string; rules: number | null }>
}

export interface AbsorbPreview extends AbsorbPlan {
  productId: string
  wiki: string
  rootPage: string
}
