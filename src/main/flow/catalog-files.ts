import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'fs'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import type { Configuration, Product } from '@shared/config/schema'
import { AppError } from '@shared/errors'
import { ABSORB_FILE, filesToPublish, type AbsorbBase, type CatalogView } from '@shared/flow-absorb'
import type { RuleCatalog, WorkFolderState } from '@shared/flow-board'
import {
  buildCatalogIndex,
  parseCatalogPage,
  ruleCatalog,
  type CatalogIndex
} from '@shared/flow-catalog'
import { getWorkFolder } from '../profile/work-folders'

/**
 * O catálogo de regras na pasta de trabalho (ADR 0015): `catalogo/`, uma página por
 * arquivo Markdown. Leitura do disco, e a conferência de que todo arquivo escrito
 * fica dentro dela.
 *
 * Mora fora de `services/` porque o servidor MCP também lê o catálogo, e ele não
 * alcança o caminho do Azure (RN-SEC-34). Recebe a Configuração e o Perfil: a
 * janela passa os em uso; o servidor, os do Perfil em que está preso.
 */

export const CATALOG_DIR = 'catalogo'

const MAX_FILES = 500
const MAX_FILE_BYTES = 2 * 1024 * 1024

export interface ProductCatalog {
  product: Product
  workFolder: WorkFolderState
  /** A pasta `catalogo/`, quando a pasta de trabalho existe. */
  dir: string | null
  /** Conteúdo de cada página, pelo caminho relativo a `catalogo/`. */
  files: Record<string, string>
  base: AbsorbBase | null
  index: CatalogIndex
}

function folderState(path: string | null): WorkFolderState {
  if (path === null) return 'unset'
  return existsSync(path) && statSync(path).isDirectory() ? 'ok' : 'missing'
}

/** As páginas de `catalogo/`, sem seguir link simbólico e sem arquivo começado por ponto. */
export function readCatalogFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  let count = 0
  const walk = (current: string): void => {
    let names: string[]
    try {
      names = readdirSync(current)
    } catch {
      return
    }
    for (const name of names.sort()) {
      if (name.startsWith('.') || count >= MAX_FILES) continue
      const full = join(current, name)
      let stat
      try {
        stat = lstatSync(full)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) walk(full)
      else if (stat.isFile() && name.toLowerCase().endsWith('.md') && stat.size <= MAX_FILE_BYTES) {
        files[relative(dir, full).split(sep).join('/')] = readFileSync(full, 'utf8')
        count++
      }
    }
  }
  if (existsSync(dir)) walk(dir)
  return files
}

export function readAbsorbBase(dir: string): AbsorbBase | null {
  const file = join(dir, ABSORB_FILE)
  if (!existsSync(file)) return null
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as AbsorbBase
    return value && value.version === 1 && typeof value.pages === 'object' ? value : null
  } catch {
    return null
  }
}

/**
 * O caminho de uma página dentro de `catalogo/`. Recusa caminho absoluto, `..` e
 * qualquer coisa que resolva para fora da pasta: o nome pode ter vindo da wiki.
 */
export function catalogPath(dir: string, file: string): string {
  const target = resolve(dir, file)
  const rel = relative(resolve(dir), target)
  if (
    typeof file !== 'string' ||
    !file.toLowerCase().endsWith('.md') ||
    isAbsolute(file) ||
    rel === '' ||
    rel.startsWith('..') ||
    isAbsolute(rel)
  ) {
    throw new AppError(
      'CATALOG_INVALID',
      `Página do catálogo com caminho inválido: "${String(file)}".`
    )
  }
  return target
}

export function productOf(config: Configuration, productId: string): Product {
  const product = config.products.find((p) => p.id === productId)
  if (!product) {
    throw new AppError(
      'SELECTION_UNKNOWN',
      `"${String(productId)}" não é um Produto da Configuração em uso.`
    )
  }
  return product
}

export function productCatalog(
  config: Configuration,
  profileId: string,
  productId: string
): ProductCatalog {
  const product = productOf(config, productId)
  const root = getWorkFolder(profileId, product.id)
  const workFolder = folderState(root)
  const dir = workFolder === 'ok' ? join(root!, CATALOG_DIR) : null
  const pattern = product.catalog?.ruleIdPattern
  const files = dir && pattern ? readCatalogFiles(dir) : {}
  const index = buildCatalogIndex(
    pattern
      ? Object.entries(files).map(([file, text]) => parseCatalogPage(file, text, pattern))
      : []
  )
  return { product, workFolder, dir, files, base: dir ? readAbsorbBase(dir) : null, index }
}

/** O catálogo do Produto e os que ele consulta, como o quadro do fluxo usa. `null` sem catálogo. */
export function boardCatalog(
  config: Configuration,
  profileId: string,
  productId: string
): RuleCatalog | null {
  const own = productCatalog(config, profileId, productId)
  if (!own.product.catalog || own.workFolder !== 'ok') return null
  const consulted = own.product.catalog.consults.map(
    (id) => productCatalog(config, profileId, id).index
  )
  return ruleCatalog(own.index, consulted)
}

export function catalogView(
  config: Configuration,
  profileId: string,
  productId: string
): CatalogView {
  const own = productCatalog(config, profileId, productId)
  const catalog = own.product.catalog
  const toPublish = new Set(
    catalog?.source.kind === 'wiki' ? filesToPublish(own.files, own.base) : []
  )
  return {
    productId: own.product.id,
    source:
      catalog === null
        ? null
        : catalog.source.kind === 'wiki'
          ? { kind: 'wiki', wiki: catalog.source.wiki, rootPage: catalog.source.rootPage }
          : { kind: 'local' },
    workFolder: own.workFolder,
    absorbedAt: own.base?.absorbedAt ?? null,
    pages: own.index.pages.map((page) => ({
      file: page.file,
      title: page.title,
      rules: page.rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        status: rule.status,
        validation: rule.validation,
        updated: rule.updated
      })),
      toPublish: toPublish.has(page.file)
    })),
    duplicates: own.index.duplicates,
    consults: (catalog?.consults ?? []).map((id) => {
      const other = productCatalog(config, profileId, id)
      return {
        productId: id,
        name: other.product.name,
        rules: other.product.catalog && other.workFolder === 'ok' ? other.index.rules.size : null
      }
    })
  }
}
