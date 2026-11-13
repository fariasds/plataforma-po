import type { Configuration } from '@shared/config/schema'
import type { SprintDeliveryResult } from '@shared/dashboards'

/**
 * Tipos de desenvolvimento da seleção (RN-ENT-05): os do Perfil de processo de cada
 * Produto, somados quando é um Grupo.
 */
export function developmentTypesOf(config: Configuration, selectionId: string): string[] {
  const group = config.groups.find((g) => g.id === selectionId)
  const productIds = group ? group.products : [selectionId]
  const types = new Set<string>()
  for (const product of config.products) {
    if (!productIds.includes(product.id)) continue
    for (const type of config.processProfiles[product.processProfile].developmentTypes) {
      types.add(type)
    }
  }
  return [...types]
}

export interface DeliverySummary {
  delivered: number
  totalInSprint: number
  /** RN-ENT-04: sem planejado, 0 — nunca divisão por zero. */
  completionRate: number
  totalHoursInSprint: number
  devHoursInSprint: number
  /** RN-ENT-05: sem horas, 0. */
  devPercent: number
  /** RN-ENT-10: contagem por tipo, da maior para a menor. */
  typeCounts: [type: string, count: number][]
}

export function summarizeDelivery(
  data: SprintDeliveryResult | undefined,
  developmentTypes: readonly string[]
): DeliverySummary {
  const deliveredItems = data?.deliveredItems ?? []
  const typeDistributionInSprint = data?.typeDistributionInSprint ?? []

  const counts: Record<string, number> = {}
  for (const { workItem } of deliveredItems) {
    const type = workItem.fields['System.WorkItemType']
    counts[type] = (counts[type] ?? 0) + 1
  }

  const totalInSprint = data?.totalInSprint ?? 0
  const delivered = deliveredItems.length
  const totalHoursInSprint = typeDistributionInSprint.reduce((s, d) => s + d.value, 0)
  const devHoursInSprint = typeDistributionInSprint
    .filter((d) => developmentTypes.includes(d.name))
    .reduce((s, d) => s + d.value, 0)

  return {
    delivered,
    totalInSprint,
    completionRate: totalInSprint > 0 ? Math.round((delivered / totalInSprint) * 100) : 0,
    totalHoursInSprint,
    devHoursInSprint,
    devPercent:
      totalHoursInSprint > 0 ? Math.round((devHoursInSprint / totalHoursInSprint) * 100) : 0,
    typeCounts: Object.entries(counts).sort((a, b) => b[1] - a[1])
  }
}
