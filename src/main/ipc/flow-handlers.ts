import { refreshFlowSnapshot } from '../services/azure/flow-snapshot'
import { previewCatalogAbsorb } from '../services/flow/absorb'
import { getFlowBoard } from '../services/flow/board'
import { getCatalogView } from '../services/flow/catalog'
import { getFollowUp } from '../services/flow/follow-up'
import { getOpportunities } from '../services/flow/opportunities'
import { handle } from './registry'

/**
 * Fluxo do PO (ADR 0011). A janela pede o retrato de um Produto; o main lê o
 * Azure, grava nos Dados de trabalho e devolve só o resumo. O ID do Produto é
 * conferido contra a Configuração em uso antes de qualquer consulta.
 */
export function registerFlowHandlers(): void {
  handle('refreshFlowSnapshot', (productId) => refreshFlowSnapshot(productId))
  handle('getFlowBoard', (productId) => getFlowBoard(productId))
  handle('getOpportunities', (productId) => getOpportunities(productId))
  handle('getFollowUp', (productId) => getFollowUp(productId))
  handle('getCatalog', (productId) => getCatalogView(productId))
  handle('previewCatalogAbsorb', (productId) => previewCatalogAbsorb(productId))
}
