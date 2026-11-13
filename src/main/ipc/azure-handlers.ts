import { getBugAnalysisData } from '../services/azure/bug-analysis'
import { getDailyData } from '../services/azure/daily'
import { getCurrentUser } from '../services/azure/directory'
import { getPlanningData } from '../services/azure/planning'
import { getPlanningItem } from '../services/azure/planning-item'
import { getSprintDeliveryData } from '../services/azure/sprint-delivery'
import { getTeamPerformanceData } from '../services/azure/team-performance'
import { activeScope } from '../services/azure/scope'
import { getUnifiedSprints } from '../services/azure/unified-sprints'
import { handle } from './registry'

/**
 * One handler per screen. Each does the whole job in the main process — fetch,
 * history walking and aggregation — and hands the renderer a finished result.
 * This is what the Next server components used to do at request time.
 *
 * A seleção chega do renderer e é conferida antes de qualquer consulta: ID que
 * não está na Configuração em uso resolve com `SELECTION_UNKNOWN`.
 */
export function registerAzureHandlers(): void {
  handle('getSprints', (limit, preferFuture) => getUnifiedSprints(limit, preferFuture))

  handle('getSprintDelivery', (selectionId, sprint) => {
    activeScope(selectionId)
    return getSprintDeliveryData(selectionId, sprint)
  })

  handle('getTeamPerformance', (selectionId, sprints) => {
    activeScope(selectionId)
    return getTeamPerformanceData(selectionId, sprints)
  })

  handle('getBugAnalysis', (selectionId, sprints, selectedSprint) => {
    activeScope(selectionId)
    return getBugAnalysisData(selectionId, sprints, selectedSprint)
  })

  handle('getPlanning', (selectionId, sprint) => {
    activeScope(selectionId)
    return getPlanningData(selectionId, sprint)
  })

  handle('getPlanningItem', (id) => getPlanningItem(id))

  handle('getDaily', (selectionId, sprint) => {
    activeScope(selectionId)
    return getDailyData(selectionId, sprint)
  })

  handle('getCurrentUser', () => getCurrentUser())
}
