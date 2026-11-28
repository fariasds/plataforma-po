import type { Configuration } from '@shared/config/schema'
import { buildFollowUp, type FollowUpView } from '@shared/flow-follow-up'
import { storedSnapshot } from './board'
import { productCatalog } from './catalog-files'
import { getWorkFolder } from '../profile/work-folders'
import { readFeatureFolders } from './feature-folders'
import { readBugAnalyses } from './opportunities'

/**
 * O acompanhamento de um Produto (RN-FLX-21 a RN-FLX-24): o retrato, as Análises de
 * Bug, os planos das Features e o catálogo próprio. Só leitura; a janela e o servidor
 * MCP calculam por aqui.
 */
export function followUpView(
  config: Configuration,
  profileId: string,
  productId: string
): FollowUpView {
  const own = productCatalog(config, profileId, productId)
  const processProfile = config.processProfiles[own.product.processProfile]
  const root = own.workFolder === 'ok' ? getWorkFolder(profileId, own.product.id) : null
  return buildFollowUp({
    productId: own.product.id,
    snapshot: storedSnapshot(profileId, own.product.id),
    analyses: root ? readBugAnalyses(root) : [],
    folders: root ? readFeatureFolders(root).map((f) => f.folder) : [],
    catalog: root && own.product.catalog ? own.index : null,
    deliveredStates: processProfile.deliveredStates,
    workFolder: own.workFolder
  })
}
