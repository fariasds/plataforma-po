import type { OpportunitiesView } from '@shared/flow-opportunities'
import { opportunitiesView } from '../../flow/opportunities'
import { requireActiveProfile } from '../../profile/profile-store'
import { requireActiveConfig } from '../azure/scope'

/** As oportunidades do Produto para a janela: a Configuração e o Perfil em uso. */
export function getOpportunities(productId: string): OpportunitiesView {
  return opportunitiesView(requireActiveConfig(), requireActiveProfile().id, productId)
}
