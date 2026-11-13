import type { ReworkSlot } from '@shared/dashboards'
import { fetchAzure, postAzure } from './client'
import { activeScope, requireActiveConfig, type ResolvedProduct } from './scope'
import { productAreaClauses, wiqlList } from './sprint-delivery'
import type { WiqlResponse } from '@shared/azure'
import type { UnifiedSprint } from '@shared/azure'
import { sprintShortName } from '@shared/azure'

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * Sem `customFields.reworkCount` o indicador não é calculado: as listas vêm
 * vazias e `unavailable` diz o que configurar. Zero seria mentira — o item pode
 * ter voltado dez vezes sem que o app saiba.
 */
export interface ReworkData {
  sprintSlots: ReworkSlot[]
  monthSlots: ReworkSlot[]
  unavailable?: 'customFields.reworkCount'
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface ReworkItemFields {
  'Microsoft.VSTS.Common.ClosedDate'?: string
  [key: string]: unknown
}

interface ReworkWorkItemsResponse {
  value: Array<{ id: number; fields: ReworkItemFields }>
}

interface RawReworkItem {
  closedDate: string
  reworkTimes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isWithinSprint(dateStr: string, sprint: UnifiedSprint): boolean {
  const date = parseLocalDate(dateStr)
  const start = parseLocalDate(sprint.startDate)
  const finish = parseLocalDate(sprint.finishDate)
  finish.setHours(23, 59, 59, 999)
  return date >= start && date <= finish
}

const CHUNK_SIZE = 200

async function fetchChunked(
  projectName: string,
  ids: number[],
  reworkField: string
): Promise<Array<{ id: number; fields: ReworkItemFields }>> {
  const fields = `System.Id,Microsoft.VSTS.Common.ClosedDate,${reworkField}`
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE))
  }
  const responses = await Promise.all(
    chunks.map((chunk) =>
      fetchAzure<ReworkWorkItemsResponse>(
        `/${projectName}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.1`
      )
    )
  )
  return responses.flatMap((r) => r.value)
}

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez'
]
const MONTH_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

function aggregateIntoSlots(
  items: RawReworkItem[],
  sprints: UnifiedSprint[]
): { sprintSlots: ReworkSlot[]; monthSlots: ReworkSlot[] } {
  type SlotData = { total: number; reworkBreaks: Map<number, number> }

  const sprintMap = new Map<string, SlotData>()
  for (const sprint of sprints) {
    sprintMap.set(sprint.key, { total: 0, reworkBreaks: new Map() })
  }

  const monthMap = new Map<string, SlotData>()

  for (const item of items) {
    // Sprint assignment
    const matchedSprint = sprints.find((s) => isWithinSprint(item.closedDate, s))
    if (matchedSprint) {
      const slot = sprintMap.get(matchedSprint.key)!
      slot.total++
      if (item.reworkTimes > 0) {
        slot.reworkBreaks.set(item.reworkTimes, (slot.reworkBreaks.get(item.reworkTimes) ?? 0) + 1)
      }
    }

    // Month assignment (uses UTC month to be consistent with closedDate format)
    const d = new Date(item.closedDate)
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { total: 0, reworkBreaks: new Map() })
    const mslot = monthMap.get(monthKey)!
    mslot.total++
    if (item.reworkTimes > 0) {
      mslot.reworkBreaks.set(item.reworkTimes, (mslot.reworkBreaks.get(item.reworkTimes) ?? 0) + 1)
    }
  }

  function toSlot(key: string, label: string, fullLabel: string, data: SlotData): ReworkSlot {
    const reworkCount = [...data.reworkBreaks.values()].reduce((s, c) => s + c, 0)
    const breakdown = [...data.reworkBreaks.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([times, count]) => ({ times, count }))
    return {
      key,
      label,
      fullLabel,
      total: data.total,
      reworkCount,
      reworkRate: data.total > 0 ? Math.round((reworkCount / data.total) * 100) : null,
      breakdown
    }
  }

  const sprintSlots = [...sprints].reverse().flatMap((sprint) => {
    const data = sprintMap.get(sprint.key)
    if (!data || data.total === 0) return []
    const label = sprintShortName(sprint) ?? sprint.label.slice(0, 8)
    return [toSlot(sprint.key, label, sprint.label, data)]
  })

  const monthSlots = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-').map(Number)
      const label = `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`
      const fullLabel = `${MONTH_LONG[month - 1]} de ${year}`
      return toSlot(monthKey, label, fullLabel, data)
    })

  return { sprintSlots, monthSlots }
}

// ─── Por Produto ─────────────────────────────────────────────────────────────

// Itens entregues por data de fechamento, com ou sem sprint: o retrabalho não
// depende de iteração, então Produto de fluxo contínuo entra do mesmo jeito.
async function fetchReworkForProduct(
  product: ResolvedProduct,
  reworkField: string,
  rangeStart: string,
  rangeEnd: string
): Promise<RawReworkItem[]> {
  const profile = product.processProfile
  const projectName = product.project

  const wiql = await postAzure<WiqlResponse>(`/${projectName}/_apis/wit/wiql?api-version=7.1`, {
    query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] IN (${wiqlList(profile.workItemTypes)})
              AND [System.State] IN (${wiqlList(profile.deliveredStates)})
              AND [Microsoft.VSTS.Common.ClosedDate] >= '${rangeStart}'
              AND [Microsoft.VSTS.Common.ClosedDate] <= '${rangeEnd}'
              ${productAreaClauses(product)}
              ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC`
  })

  if (wiql.workItems.length === 0) return []

  const ids = wiql.workItems.map((w) => w.id)
  const items = await fetchChunked(projectName, ids, reworkField)

  return items
    .filter((item) => !!item.fields['Microsoft.VSTS.Common.ClosedDate'])
    .map((item) => {
      const rw = item.fields[reworkField]
      return {
        closedDate: item.fields['Microsoft.VSTS.Common.ClosedDate']!,
        reworkTimes: typeof rw === 'number' ? rw : 0
      }
    })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getReworkData(
  selectionId: string,
  sprints: UnifiedSprint[]
): Promise<ReworkData> {
  const reworkField = requireActiveConfig().customFields.reworkCount
  const { products } = activeScope(selectionId)
  if (!reworkField) {
    return { sprintSlots: [], monthSlots: [], unavailable: 'customFields.reworkCount' }
  }

  const sorted = [...sprints].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  )
  const rangeStart = sorted[0].startDate.split('T')[0]
  const rangeEnd = sorted[sorted.length - 1].finishDate.split('T')[0]

  const perProduct = await Promise.all(
    products.map((product) => fetchReworkForProduct(product, reworkField, rangeStart, rangeEnd))
  )
  const rawItems = perProduct.flat()

  console.log(
    `[rework] selection=${selectionId} items=${rawItems.length} ` +
      `withRework=${rawItems.filter((i) => i.reworkTimes > 0).length}`
  )

  return aggregateIntoSlots(rawItems, sprints)
}
