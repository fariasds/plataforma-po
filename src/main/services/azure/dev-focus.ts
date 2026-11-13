import type { DevFocusSlot } from '@shared/dashboards'
import { fetchAzure, postAzure } from './client'
import { activeScope, requireActiveConfig, type ResolvedProduct } from './scope'
import { calcBusinessHours } from '@shared/business-hours'
import { createCalendar, type Calendar } from '@shared/calendar'
import type { WiqlResponse, WorkItemUpdate, WorkItemUpdatesResponse } from '@shared/azure'
import type { UnifiedSprint } from '@shared/azure'
import { sprintIteration, sprintShortName } from '@shared/azure'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONCURRENT = 20
const BATCH_SIZE = 200

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

// ─── Helpers (same logic as sprint-delivery) ──────────────────────────────────

function getAppliedAt(sorted: WorkItemUpdate[], index: number): string {
  return index > 0 ? sorted[index - 1].revisedDate : sorted[0].revisedDate
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Períodos em que o item esteve no estado de desenvolvimento do Perfil de processo. */
export function getInProgressPeriods(
  updates: WorkItemUpdate[],
  inProgressState: string
): { start: Date; end: Date }[] {
  const sorted = [...updates].sort((a, b) => a.id - b.id)
  const periods: { start: Date; end: Date }[] = []
  let inProgressStart: Date | null = null

  for (let i = 0; i < sorted.length; i++) {
    const stateChange = sorted[i].fields?.['System.State']
    if (!stateChange) continue
    const appliedAt = new Date(getAppliedAt(sorted, i))

    if (stateChange.newValue === inProgressState) {
      if (!inProgressStart) inProgressStart = appliedAt
    } else if (inProgressStart) {
      periods.push({ start: inProgressStart, end: appliedAt })
      inProgressStart = null
    }
  }
  if (inProgressStart) periods.push({ start: inProgressStart, end: new Date() })

  return periods
}

function calcInSprintDevHours(
  periods: { start: Date; end: Date }[],
  fallbackStart: Date,
  fallbackEnd: Date,
  sprintStartDate: string,
  sprintFinishDate: string,
  calendar: Calendar
): number {
  const sprintStart = parseLocalDate(sprintStartDate)
  sprintStart.setHours(0, 0, 0, 0)
  const sprintEnd = parseLocalDate(sprintFinishDate)
  sprintEnd.setHours(23, 59, 59, 999)

  const activePeriods = periods.length > 0 ? periods : [{ start: fallbackStart, end: fallbackEnd }]

  let total = 0
  for (const { start, end } of activePeriods) {
    const s = start < sprintStart ? sprintStart : start
    const e = end > sprintEnd ? sprintEnd : end
    if (s < e) total += calcBusinessHours(s.toISOString(), e.toISOString(), calendar)
  }
  return Math.round(total * 10) / 10
}

// ─── Update Fetcher ───────────────────────────────────────────────────────────

async function fetchUpdatesForIds(ids: number[]): Promise<Map<number, WorkItemUpdate[]>> {
  const result = new Map<number, WorkItemUpdate[]>()

  for (let i = 0; i < ids.length; i += CONCURRENT) {
    const chunk = ids.slice(i, i + CONCURRENT)
    const settled = await Promise.all(
      chunk.map(async (id) => {
        try {
          const data = await fetchAzure<WorkItemUpdatesResponse>(
            `/_apis/wit/workitems/${id}/updates?api-version=7.1`
          )
          return { id, updates: data.value }
        } catch {
          return { id, updates: [] as WorkItemUpdate[] }
        }
      })
    )
    for (const { id, updates } of settled) result.set(id, updates)
  }

  return result
}

// ─── Per-sprint fetcher ───────────────────────────────────────────────────────

interface BasicFields {
  'System.WorkItemType': string
  'System.CreatedDate': string
  'Microsoft.VSTS.Common.ClosedDate'?: string
}
interface BasicItemsResponse {
  value: Array<{ id: number; fields: BasicFields }>
}

async function fetchSprintFocus(
  product: ResolvedProduct,
  iterationPath: string,
  sprintStartDate: string,
  sprintFinishDate: string,
  calendar: Calendar
): Promise<{ devHours: number; totalHours: number }> {
  const projectName = product.project
  const { workItemTypes, developmentTypes, inProgressState } = product.processProfile
  const devTypes = new Set(developmentTypes)
  const typeFilter = workItemTypes.map((t) => `'${t}'`).join(', ')

  const wiql = await postAzure<WiqlResponse>(`/${projectName}/_apis/wit/wiql?api-version=7.1`, {
    query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.IterationPath] = '${iterationPath}'
              AND [System.WorkItemType] IN (${typeFilter})
              ORDER BY [System.Id] ASC`
  })

  if (wiql.workItems.length === 0) return { devHours: 0, totalHours: 0 }

  const ids = wiql.workItems.map((w) => w.id)
  const fields = 'System.Id,System.WorkItemType,System.CreatedDate,Microsoft.VSTS.Common.ClosedDate'

  // Batch fetch fields
  const itemChunks: number[][] = []
  for (let i = 0; i < ids.length; i += BATCH_SIZE) itemChunks.push(ids.slice(i, i + BATCH_SIZE))
  const itemResponses = await Promise.all(
    itemChunks.map((chunk) =>
      fetchAzure<BasicItemsResponse>(
        `/${projectName}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.1`
      )
    )
  )
  const items = itemResponses.flatMap((r) => r.value)

  const updatesMap = await fetchUpdatesForIds(ids)

  let devHours = 0
  let totalHours = 0

  for (const item of items) {
    const updates = updatesMap.get(item.id) ?? []
    const periods = getInProgressPeriods(updates, inProgressState)
    const createdDate = new Date(item.fields['System.CreatedDate'])
    const closedDate = item.fields['Microsoft.VSTS.Common.ClosedDate']
      ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate'])
      : new Date()

    const hours = calcInSprintDevHours(
      periods,
      createdDate,
      closedDate,
      sprintStartDate,
      sprintFinishDate,
      calendar
    )

    totalHours += hours
    if (devTypes.has(item.fields['System.WorkItemType'])) devHours += hours
  }

  return {
    devHours: Math.round(devHours * 10) / 10,
    totalHours: Math.round(totalHours * 10) / 10
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getDevFocusData(
  selectionId: string,
  sprints: UnifiedSprint[]
): Promise<{ sprintSlots: DevFocusSlot[]; monthSlots: DevFocusSlot[] }> {
  const { products } = activeScope(selectionId)
  const calendar = createCalendar(requireActiveConfig().calendar)
  const orderedSprints = [...sprints].reverse() // oldest → newest

  const sprintSlots: DevFocusSlot[] = []

  for (const sprint of orderedSprints) {
    // Produto sem iteração nesta sprint não tem horas comparáveis (RN-DES-06): fica de fora.
    const participating = products.flatMap((product) => {
      const iteration = sprintIteration(sprint, product.id)
      return iteration ? [{ product, path: iteration.path }] : []
    })
    if (participating.length === 0) continue

    const results = await Promise.all(
      participating.map(({ product, path }) =>
        fetchSprintFocus(product, path, sprint.startDate, sprint.finishDate, calendar)
      )
    )
    const devHours = results.reduce((sum, r) => sum + r.devHours, 0)
    const totalHours = results.reduce((sum, r) => sum + r.totalHours, 0)

    const shortLabel = sprintShortName(sprint) ?? sprint.label.slice(0, 8)
    sprintSlots.push({
      key: sprint.key,
      label: shortLabel,
      fullLabel: sprint.label,
      devFocusPercent: totalHours > 0 ? Math.round((devHours / totalHours) * 100) : null,
      totalHours,
      devHours
    })
  }

  // Month slots: aggregate sprint slots by start month
  const monthMap = new Map<
    string,
    { devHours: number; totalHours: number; label: string; fullLabel: string }
  >()
  for (const slot of sprintSlots) {
    const sprint = sprints.find((s) => s.key === slot.key)
    if (!sprint) continue
    const [year, month] = sprint.startDate.split('T')[0].split('-').map(Number)
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    const label = `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`
    const fullLabel = `${MONTH_LONG[month - 1]} de ${year}`
    const existing = monthMap.get(monthKey) ?? { devHours: 0, totalHours: 0, label, fullLabel }
    existing.devHours += slot.devHours
    existing.totalHours += slot.totalHours
    monthMap.set(monthKey, existing)
  }

  const monthSlots: DevFocusSlot[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { devHours, totalHours, label, fullLabel }]) => ({
      key,
      label,
      fullLabel,
      devFocusPercent: totalHours > 0 ? Math.round((devHours / totalHours) * 100) : null,
      totalHours,
      devHours
    }))

  return { sprintSlots, monthSlots }
}
