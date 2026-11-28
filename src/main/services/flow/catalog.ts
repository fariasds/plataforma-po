import type { CatalogView } from '@shared/flow-absorb'
import type { RuleCatalog } from '@shared/flow-board'
import {
  boardCatalog as boardCatalogFor,
  catalogView,
  productCatalog as productCatalogFor,
  type ProductCatalog
} from '../../flow/catalog-files'
import { requireActiveProfile } from '../../profile/profile-store'
import { requireActiveConfig } from '../azure/scope'

/** O catálogo do Produto para a janela: a Configuração e o Perfil em uso. */

export { catalogPath, CATALOG_DIR, type ProductCatalog } from '../../flow/catalog-files'

export function productCatalog(productId: string): ProductCatalog {
  return productCatalogFor(requireActiveConfig(), requireActiveProfile().id, productId)
}

export function boardCatalog(productId: string): RuleCatalog | null {
  return boardCatalogFor(requireActiveConfig(), requireActiveProfile().id, productId)
}

export function getCatalogView(productId: string): CatalogView {
  return catalogView(requireActiveConfig(), requireActiveProfile().id, productId)
}
