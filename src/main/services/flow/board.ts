import { existsSync, statSync } from 'fs'
import { buildFlowBoard, type FlowBoard, type WorkFolderState } from '@shared/flow-board'
import { flowKeys, type FlowSnapshot } from '@shared/flow-snapshot'
import { requireActiveProfile } from '../../profile/profile-store'
import { readWorkData } from '../../profile/work-data'
import { getWorkFolder } from '../../profile/work-folders'
import { activeProduct } from '../azure/scope'
import { readFeatureFolders } from './feature-folders'

/**
 * O quadro do fluxo do PO de um Produto (RN-FLX-05 a RN-FLX-11): o retrato já
 * gravado mais a pasta de trabalho. Não fala com o Azure; quem atualiza o retrato
 * é `refreshFlowSnapshot`.
 */

function storedSnapshot(profileId: string, productId: string): FlowSnapshot | null {
  const value = readWorkData(profileId, flowKeys.snapshot(productId)) as FlowSnapshot | null
  return value && value.version === 1 && Array.isArray(value.features) ? value : null
}

export function getFlowBoard(productId: string, now = new Date()): FlowBoard {
  const product = activeProduct(productId)
  const profile = requireActiveProfile()
  const folder = getWorkFolder(profile.id, product.id)
  let workFolder: WorkFolderState = 'unset'
  if (folder !== null) {
    workFolder = existsSync(folder) && statSync(folder).isDirectory() ? 'ok' : 'missing'
  }
  return buildFlowBoard({
    productId: product.id,
    workFolder,
    snapshot: storedSnapshot(profile.id, product.id),
    folders: workFolder === 'ok' ? readFeatureFolders(folder!) : [],
    now,
    deliveredStates: product.processProfile.deliveredStates,
    terminalStates: product.processProfile.terminalStates,
    // Sem catálogo de regras absorvido (ADR 0015), nenhuma Feature chega a Publicada.
    catalog: null
  })
}
