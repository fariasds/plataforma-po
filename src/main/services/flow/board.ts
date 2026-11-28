import type { FlowBoard } from '@shared/flow-board'
import { flowBoard } from '../../flow/board'
import { requireActiveProfile } from '../../profile/profile-store'
import { requireActiveConfig } from '../azure/scope'

/** O quadro do fluxo do PO para a janela: a Configuração e o Perfil em uso. */
export function getFlowBoard(productId: string, now = new Date()): FlowBoard {
  return flowBoard(requireActiveConfig(), requireActiveProfile().id, productId, now)
}
