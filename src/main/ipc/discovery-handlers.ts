import { AppError } from '@shared/errors'
import { withOrganization } from '../services/azure/client'
import {
  discoveryOrganization,
  getAreaTree,
  getProcessDetails,
  listFields,
  listProjects,
  listTeams,
  suggestProcessProfile
} from '../services/azure/discovery'
import { handle } from './registry'

/**
 * Descoberta para o assistente de Configuração. Diferente dos dashboards, não
 * passa pela seleção nem exige Configuração válida: a organização vem de
 * `discoveryOrganization`, e a fronteira de rede (RN-SEC-18) vale do mesmo jeito.
 */
function discover<T>(task: () => Promise<T>): Promise<T> {
  return withOrganization(discoveryOrganization(), task)
}

/** O nome do projeto chega da janela e vira segmento de URL: só texto não vazio. */
function projectName(project: unknown): string {
  if (typeof project !== 'string' || project.trim() === '') {
    throw new AppError('PROFILE_INVALID', 'Informe o projeto do Azure a consultar.')
  }
  return project.trim()
}

export function registerDiscoveryHandlers(): void {
  handle('discoverProjects', () => discover(listProjects))
  handle('discoverTeams', (project) => discover(() => listTeams(projectName(project))))
  handle('discoverAreas', (project) => discover(() => getAreaTree(projectName(project))))
  handle('discoverProcess', (project) =>
    discover(async () => {
      const details = await getProcessDetails(projectName(project))
      return { ...details, suggestion: suggestProcessProfile(details) }
    })
  )
  handle('discoverFields', (project) => discover(() => listFields(projectName(project))))
}
