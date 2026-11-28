import { existsSync, statSync } from 'fs'
import {
  applyRoadmapChange,
  parseRoadmapFile,
  RoadmapChangeSchema,
  RoadmapSettingsSchema,
  roadmapKeys,
  buildRoadmap,
  type RoadmapChange,
  type RoadmapFile,
  type RoadmapSettings,
  type RoadmapView
} from '@shared/roadmap'
import { AppError } from '@shared/errors'
import { flowBoard } from '../../flow/board'
import { productOf } from '../../flow/catalog-files'
import { readRoadmapText, roadmapInputs, roadmapPath, roadmapSettings } from '../../flow/roadmap'
import { writeFileAtomic } from '../../profile/atomic-write'
import { requireActiveProfile } from '../../profile/profile-store'
import { writeWorkData } from '../../profile/work-data'
import { getWorkFolder } from '../../profile/work-folders'
import { getUnifiedSprints } from '../azure/unified-sprints'
import { requireActiveConfig } from '../azure/scope'

/**
 * O Roadmap para a janela (RN-RDM-01 a RN-RDM-21). Lê as sprints do Azure e o plano
 * de todas as pastas de trabalho; grava só o `roadmap.json`, que é do app, e os pesos
 * e limites nos Dados de trabalho do Perfil (ADR 0017).
 */

const PAST_SPRINTS = 6
const FUTURE_SPRINTS = 12

function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export async function getRoadmap(): Promise<RoadmapView> {
  const config = requireActiveConfig()
  const profileId = requireActiveProfile().id
  const [past, future] = await Promise.all([
    getUnifiedSprints(PAST_SPRINTS, false),
    getUnifiedSprints(FUTURE_SPRINTS, true)
  ])
  return buildRoadmap({
    products: roadmapInputs(config, profileId),
    sprints: [...past, ...future],
    today: today(),
    settings: roadmapSettings(profileId),
    ahead: FUTURE_SPRINTS
  })
}

function workFolderOf(productId: string): string {
  const config = requireActiveConfig()
  const product = productOf(config, productId)
  const root = getWorkFolder(requireActiveProfile().id, product.id)
  if (root === null || !existsSync(root) || !statSync(root).isDirectory()) {
    throw new AppError('WORK_FOLDER_INVALID', 'O Produto não tem pasta de trabalho disponível.')
  }
  return root
}

/**
 * Grava uma mudança no plano de um Produto. A chave tem de ser de uma Feature que o
 * quadro conhece; a do rascunho adotado é trocada pela do Azure (RN-RDM-02).
 */
export function updateRoadmap(productId: string, input: RoadmapChange): void {
  const parsed = RoadmapChangeSchema.safeParse(input)
  if (!parsed.success) throw new AppError('ROADMAP_INVALID', 'Mudança do Roadmap fora do formato.')
  const change = parsed.data
  const root = workFolderOf(productId)
  const { file, error } = parseRoadmapFile(readRoadmapText(root))
  // Arquivo que não valida não é sobrescrito: o PO perderia o plano sem ver.
  if (error !== null) throw new AppError('ROADMAP_INVALID', `O roadmap.json não é válido: ${error}`)
  let next: RoadmapFile = file
  if (change.kind !== 'milestone') {
    const config = requireActiveConfig()
    const board = flowBoard(config, requireActiveProfile().id, productId)
    const feature = board.features.find((f) => f.key === change.key)
    if (!feature) throw new AppError('ROADMAP_STALE', 'A Feature não está mais no quadro.')
    if (feature.slug !== null && feature.featureId !== null) {
      const draftKey = `pasta:${feature.slug}`
      if (next.features[draftKey] && !next.features[feature.key]) {
        const features = { ...next.features, [feature.key]: next.features[draftKey] }
        delete features[draftKey]
        next = { ...next, features }
      }
    }
  }
  next = applyRoadmapChange(next, change)
  writeFileAtomic(roadmapPath(root), `${JSON.stringify(next, null, 2)}\n`)
}

/** RN-RDM-21: o marco é gravado em toda pasta de trabalho disponível, com o mesmo nome. */
export function createRoadmapMilestone(name: string): number {
  const config = requireActiveConfig()
  const takenAt = new Date().toISOString()
  let written = 0
  for (const product of config.products) {
    try {
      workFolderOf(product.id)
    } catch {
      continue
    }
    updateRoadmap(product.id, { kind: 'milestone', name: name.trim(), takenAt })
    written += 1
  }
  return written
}

export function setRoadmapSettings(settings: RoadmapSettings): RoadmapSettings {
  const parsed = RoadmapSettingsSchema.parse(settings)
  writeWorkData(requireActiveProfile().id, roadmapKeys.settings, parsed)
  return parsed
}
