import { refreshFlowSnapshot } from '../services/azure/flow-snapshot'
import { handle } from './registry'

/**
 * Fluxo do PO (ADR 0011). A janela pede o retrato de um Produto; o main lê o
 * Azure, grava nos Dados de trabalho e devolve só o resumo. O ID do Produto é
 * conferido contra a Configuração em uso antes de qualquer consulta.
 */
export function registerFlowHandlers(): void {
  handle('refreshFlowSnapshot', (productId) => refreshFlowSnapshot(productId))
}
