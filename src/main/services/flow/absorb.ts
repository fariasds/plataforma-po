import { join } from 'path'
import { AppError } from '@shared/errors'
import {
  ABSORB_FILE,
  applyAbsorb,
  planAbsorb,
  type AbsorbPreview,
  type CatalogView,
  type WikiPage
} from '@shared/flow-absorb'
import { writeFileAtomic } from '../../profile/atomic-write'
import { readWikiPages } from '../azure/wiki'
import { catalogPath, getCatalogView, productCatalog, type ProductCatalog } from './catalog'

/**
 * Absorver o catálogo da wiki (RN-CAT-03): a janela pede a diferença, o PO vê, e só
 * então pede para absorver, escolhendo a versão das páginas em conflito. A wiki é
 * lida de novo na hora de gravar: o que entra é o que está lá agora.
 */

export interface WikiCatalog extends ProductCatalog {
  wiki: string
  project: string
  rootPage: string
  dir: string
}

export function wikiCatalog(productId: string): WikiCatalog {
  const catalog = productCatalog(productId)
  const source = catalog.product.catalog?.source
  if (!source || source.kind !== 'wiki') {
    throw new AppError(
      'CATALOG_INVALID',
      'Este Produto não declara uma wiki como fonte do catálogo. Defina "catalog.source" na Configuração.'
    )
  }
  if (catalog.workFolder !== 'ok' || catalog.dir === null) {
    throw new AppError(
      'WORK_FOLDER_INVALID',
      'Escolha a pasta de trabalho do Produto antes de absorver.'
    )
  }
  return {
    ...catalog,
    dir: catalog.dir,
    wiki: source.wiki,
    project: source.project ?? catalog.product.project,
    rootPage: source.rootPage
  }
}

function plan(catalog: WikiCatalog, wiki: WikiPage[]): ReturnType<typeof planAbsorb> {
  return planAbsorb(
    catalog.rootPage,
    wiki,
    catalog.files,
    catalog.base,
    catalog.product.catalog!.ruleIdPattern
  )
}

/** O que a absorção faria, sem gravar nada. */
export async function previewCatalogAbsorb(productId: string): Promise<AbsorbPreview> {
  const catalog = wikiCatalog(productId)
  const wiki = await readWikiPages(catalog.project, catalog.wiki, catalog.rootPage)
  return {
    productId: catalog.product.id,
    wiki: catalog.wiki,
    rootPage: catalog.rootPage,
    ...plan(catalog, wiki)
  }
}

/**
 * Absorve. `useWiki` são as páginas em conflito em que o PO escolheu a versão da
 * wiki; as outras em conflito ficam como estão, e continuam a publicar.
 */
export async function absorbCatalog(productId: string, useWiki: string[]): Promise<CatalogView> {
  if (!Array.isArray(useWiki) || !useWiki.every((p) => typeof p === 'string')) {
    throw new AppError('CATALOG_INVALID', 'Escolha as páginas pela lista da diferença.')
  }
  const catalog = wikiCatalog(productId)
  const wiki = await readWikiPages(catalog.project, catalog.wiki, catalog.rootPage)
  const result = applyAbsorb(
    plan(catalog, wiki),
    wiki,
    catalog.base,
    { wiki: catalog.wiki, rootPage: catalog.rootPage },
    new Set(useWiki),
    new Date()
  )
  // Confere todos os caminhos antes de gravar o primeiro: ou entra tudo, ou nada.
  const targets = result.writes.map((write) => ({
    ...write,
    target: catalogPath(catalog.dir, write.file)
  }))
  for (const write of targets) writeFileAtomic(write.target, write.content)
  writeFileAtomic(join(catalog.dir, ABSORB_FILE), JSON.stringify(result.base, null, 2) + '\n')
  return getCatalogView(catalog.product.id)
}
