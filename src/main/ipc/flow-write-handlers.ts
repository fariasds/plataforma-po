import { absorbCatalog } from '../services/flow/absorb'
import { linkDraftFeature, linkPlannedPbi } from '../services/flow/reconcile'
import { createRoadmapMilestone, setRoadmapSettings, updateRoadmap } from '../services/flow/roadmap'
import { handle } from './registry'

/**
 * O que a janela grava na pasta de trabalho: só a confirmação de um ID que o
 * próprio main encontrou (RN-FLX-12, RN-FLX-13). Nenhum destes lê o Azure; eles
 * usam o retrato já gravado.
 */
export function registerFlowWriteHandlers(): void {
  handle('linkPlannedPbi', (productId, slug, pbiKey, azureId) =>
    linkPlannedPbi(productId, slug, pbiKey, azureId)
  )
  handle('linkDraftFeature', (productId, slug, featureId) =>
    linkDraftFeature(productId, slug, featureId)
  )
  // Absorver grava no catálogo da pasta o que veio da wiki, depois de o PO ver a diferença.
  handle('absorbCatalog', (productId, useWiki) => absorbCatalog(productId, useWiki))
  // O plano do Roadmap é do app: só a janela grava o roadmap.json (ADR 0017).
  handle('updateRoadmap', (productId, change) => updateRoadmap(productId, change))
  handle('createRoadmapMilestone', (name) => createRoadmapMilestone(name))
  handle('setRoadmapSettings', (settings) => setRoadmapSettings(settings))
}
