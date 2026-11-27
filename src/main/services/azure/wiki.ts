import type { WikiPage } from '@shared/flow-absorb'
import { fetchAzure } from './client'

/**
 * Leitura do catálogo na wiki do Azure DevOps (RN-CAT-01, ADR 0015): a árvore abaixo
 * da página raiz e o conteúdo de cada página. Só `GET` (RN-SEC-20), no mesmo host e
 * pelo mesmo cliente das telas (RN-SEC-18).
 */

interface WikiNode {
  path: string
  subPages?: WikiNode[]
}

/** Um catálogo não tem mil domínios: o teto só evita ler uma wiki inteira por engano. */
const MAX_PAGES = 300
/** Leituras de página em paralelo. */
const PARALLEL = 6

function flatten(node: WikiNode): string[] {
  return [node.path, ...(node.subPages ?? []).flatMap(flatten)]
}

export async function readWikiPages(
  project: string,
  wiki: string,
  rootPage: string
): Promise<WikiPage[]> {
  const base = `/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wiki)}/pages`
  const tree = await fetchAzure<WikiNode>(
    `${base}?path=${encodeURIComponent(rootPage)}&recursionLevel=full&api-version=7.1`
  )
  const root = rootPage.replace(/\/+$/, '')
  const paths = flatten(tree)
    .filter((path) => path !== root && path !== rootPage)
    .slice(0, MAX_PAGES)

  const pages: WikiPage[] = []
  for (let i = 0; i < paths.length; i += PARALLEL) {
    const batch = await Promise.all(
      paths
        .slice(i, i + PARALLEL)
        .map((path) =>
          fetchAzure<{ path: string; content?: string }>(
            `${base}?path=${encodeURIComponent(path)}&includeContent=true&api-version=7.1`
          )
        )
    )
    // Página só de agrupamento, sem texto, não vira arquivo.
    for (const page of batch) {
      if (typeof page.content === 'string' && page.content.trim() !== '') {
        pages.push({ path: page.path, content: page.content })
      }
    }
  }
  return pages
}
