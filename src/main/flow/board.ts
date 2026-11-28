import { existsSync, statSync } from 'fs'
import type { Configuration } from '@shared/config/schema'
import { buildFlowBoard, type FlowBoard, type WorkFolderState } from '@shared/flow-board'
import { flowKeys, type FlowSnapshot } from '@shared/flow-snapshot'
import { readWorkData } from '../profile/work-data'
import { getWorkFolder } from '../profile/work-folders'
import { boardCatalog, productOf } from './catalog-files'
import { readFeatureFolders } from './feature-folders'

/**
 * O quadro do fluxo do PO de um Produto (RN-FLX-05 a RN-FLX-11): o retrato já
 * gravado mais a pasta de trabalho. Não fala com o Azure; quem atualiza o retrato
 * é a janela (RN-FLX-02). A janela e o servidor MCP calculam o quadro por aqui, pelo
 * mesmo código (RN-FLX-17).
 */

export function storedSnapshot(profileId: string, productId: string): FlowSnapshot | null {
  const value = readWorkData(profileId, flowKeys.snapshot(productId)) as FlowSnapshot | null
  return value && value.version === 1 && Array.isArray(value.features) ? value : null
}

export function flowBoard(
  config: Configuration,
  profileId: string,
  productId: string,
  now = new Date()
): FlowBoard {
  const product = productOf(config, productId)
  const processProfile = config.processProfiles[product.processProfile]
  const folder = getWorkFolder(profileId, product.id)
  let workFolder: WorkFolderState = 'unset'
  if (folder !== null) {
    workFolder = existsSync(folder) && statSync(folder).isDirectory() ? 'ok' : 'missing'
  }
  return buildFlowBoard({
    productId: product.id,
    workFolder,
    snapshot: storedSnapshot(profileId, product.id),
    folders: workFolder === 'ok' ? readFeatureFolders(folder!) : [],
    now,
    deliveredStates: processProfile.deliveredStates,
    terminalStates: processProfile.terminalStates,
    // Sem catálogo de regras (ADR 0015), nenhuma Feature chega a Publicada.
    catalog: workFolder === 'ok' ? boardCatalog(config, profileId, product.id) : null
  })
}
