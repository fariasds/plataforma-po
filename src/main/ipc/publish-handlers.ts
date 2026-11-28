import { publishCatalog } from '../services/flow/publish'
import { handle } from './registry'

/**
 * A publicação do catálogo na wiki (ADR 0016): a única escrita do app no Azure. A
 * janela pede; quem decide é o PO, no diálogo do sistema que o main abre.
 */
export function registerPublishHandlers(): void {
  handle('publishCatalog', (productId, files) =>
    publishCatalog(
      productId,
      Array.isArray(files) ? files.filter((f) => typeof f === 'string') : []
    )
  )
}
