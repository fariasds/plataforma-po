import type { FollowUpView } from '@shared/flow-follow-up'
import { followUpView } from '../../flow/follow-up'
import { requireActiveProfile } from '../../profile/profile-store'
import { requireActiveConfig } from '../azure/scope'

/** O acompanhamento do Produto para a janela: a Configuração e o Perfil em uso. */
export function getFollowUp(productId: string): FollowUpView {
  return followUpView(requireActiveConfig(), requireActiveProfile().id, productId)
}
