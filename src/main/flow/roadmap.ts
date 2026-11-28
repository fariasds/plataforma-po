import { existsSync, lstatSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Configuration } from '@shared/config/schema'
import { isActivePbi } from '@shared/flow-artifacts'
import { opportunitiesByFeature } from '@shared/flow-opportunities'
import {
  DEFAULT_ROADMAP_SETTINGS,
  parseRoadmapFile,
  ROADMAP_FILE,
  RoadmapSettingsSchema,
  roadmapKeys,
  type RoadmapProductInput,
  type RoadmapSettings
} from '@shared/roadmap'
import { readWorkData } from '../profile/work-data'
import { getWorkFolder } from '../profile/work-folders'
import { flowBoard, storedSnapshot } from './board'
import { readFeatureFolders } from './feature-folders'
import { opportunitiesView } from './opportunities'

/**
 * O que o Roadmap lê do disco (ADR 0017): o `roadmap.json` de cada pasta de trabalho,
 * o quadro do fluxo e o retrato. Só leitura; a janela e o servidor MCP chamam daqui.
 * A linha do tempo (as sprints) vem do Azure, e por isso só a janela a monta.
 */

const MAX_ROADMAP_BYTES = 2 * 1024 * 1024

export function roadmapPath(root: string): string {
  return join(root, ROADMAP_FILE)
}

/** O texto do `roadmap.json`, ou `null` sem arquivo. Link simbólico não é seguido. */
export function readRoadmapText(root: string): string | null {
  const path = roadmapPath(root)
  if (!existsSync(path)) return null
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.size > MAX_ROADMAP_BYTES) return '{}'
  return readFileSync(path, 'utf8')
}

export function roadmapSettings(profileId: string): RoadmapSettings {
  const parsed = RoadmapSettingsSchema.safeParse(readWorkData(profileId, roadmapKeys.settings))
  return parsed.success ? parsed.data : DEFAULT_ROADMAP_SETTINGS
}

/** Tudo o que o Roadmap soma, de todos os Produtos: a sobrecarga é global (RN-RDM-12). */
export function roadmapInputs(config: Configuration, profileId: string): RoadmapProductInput[] {
  return config.products.map((product) => {
    const processProfile = config.processProfiles[product.processProfile]
    const board = flowBoard(config, profileId, product.id)
    const root = board.workFolder === 'ok' ? getWorkFolder(profileId, product.id) : null
    const { file, error } = parseRoadmapFile(root ? readRoadmapText(root) : null)
    const plannedDev = new Map<string, number[]>()
    for (const { folder } of root ? readFeatureFolders(root) : []) {
      const ids = (folder.plan?.pbis ?? [])
        .filter((p) => p.type === 'DEV' && isActivePbi(p) && p.azureId !== null)
        .map((p) => p.azureId!)
      plannedDev.set(folder.slug, ids)
    }
    return {
      productId: product.id,
      board,
      file,
      error,
      opportunities: opportunitiesByFeature(
        opportunitiesView(config, profileId, product.id).opportunities
      ),
      children: storedSnapshot(profileId, product.id)?.children ?? [],
      plannedDev,
      deliveredStates: processProfile.deliveredStates,
      terminalStates: processProfile.terminalStates,
      pbiTypes: processProfile.developmentTypes
    }
  })
}
