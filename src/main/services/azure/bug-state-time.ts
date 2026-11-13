import type { BugItem, BugStateName, BugStateSlot, CritSlotData } from '@shared/dashboards'
import { fetchAzure } from './client'
import { calcBusinessHours } from '@shared/business-hours'
import { createCalendar, type Calendar } from '@shared/calendar'
import type { Configuration } from '@shared/config/schema'
import type { WorkItemUpdate, WorkItemUpdatesResponse } from '@shared/azure'
import type { UnifiedSprint } from '@shared/azure'
import { sprintShortName } from '@shared/azure'
import { requireActiveConfig } from './scope'
import { mergeStateOrders } from './bug-analysis'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONCURRENT = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** O que o cálculo precisa saber do Perfil de processo de um bug. */
export interface BugFlow {
  /** Estado em que o bug nasce: o primeiro de `bugStateOrder` (RN-BUG-17). */
  initialState: string
  /** Estados em que o relógio para (RN-BUG-17). */
  terminalStates: ReadonlySet<string>
}

type CriticalityLevel = Configuration['criticality'][number]

/**
 * Nível de criticidade do valor do campo, pelo prefixo em `matches`, sem
 * diferenciar maiúsculas (RN-BUG-05). `null` quando nenhum nível casa.
 */
export function classifyCriticality(
  value: string,
  levels: readonly CriticalityLevel[]
): string | null {
  const lower = value.toLowerCase()
  const level = levels.find((l) => l.matches.some((m) => lower.startsWith(m.toLowerCase())))
  return level?.name ?? null
}

function getAppliedAt(sorted: WorkItemUpdate[], index: number): string {
  return index > 0 ? sorted[index - 1].revisedDate : sorted[0].revisedDate
}

/** Horas úteis (RN-GLB-07) acumuladas em cada estado, até o bug chegar a um terminal. */
export function computeStateDurations(
  updates: WorkItemUpdate[],
  createdDate: string,
  flow: BugFlow,
  calendar: Calendar
): Partial<Record<string, number>> {
  const sorted = [...updates].sort((a, b) => a.id - b.id)
  const durations: Partial<Record<string, number>> = {}

  let currentState = flow.initialState
  let stateEnteredAt = createdDate

  for (let i = 0; i < sorted.length; i++) {
    const stateField = sorted[i].fields?.['System.State']
    if (!stateField) continue

    const appliedAt = getAppliedAt(sorted, i)

    if (!flow.terminalStates.has(currentState) && new Date(appliedAt) > new Date(stateEnteredAt)) {
      const hours = calcBusinessHours(stateEnteredAt, appliedAt, calendar)
      if (hours > 0) {
        durations[currentState] = Math.round(((durations[currentState] ?? 0) + hours) * 10) / 10
      }
    }

    currentState = stateField.newValue
    stateEnteredAt = appliedAt
  }

  return durations
}

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

// ─── Slot Builder ─────────────────────────────────────────────────────────────

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

/** Média por estado, só dos estados de `stateOrder` e nessa ordem. */
function avgStates(
  durations: Partial<Record<string, number>>[],
  stateOrder: readonly BugStateName[]
): Partial<Record<BugStateName, number>> {
  if (durations.length === 0) return {}
  const result: Partial<Record<BugStateName, number>> = {}
  const n = durations.length
  for (const stateName of stateOrder) {
    const total = durations.reduce((sum, d) => sum + (d[stateName] ?? 0), 0)
    const avg = Math.round((total / n) * 10) / 10
    if (avg > 0) result[stateName] = avg
  }
  return result
}

interface SlotAccumulator {
  all: Partial<Record<string, number>>[]
  byLevel: Map<string, Partial<Record<string, number>>[]>
}

function makeSlot(
  key: string,
  label: string,
  fullLabel: string,
  acc: SlotAccumulator,
  stateOrder: readonly BugStateName[],
  levelNames: readonly string[]
): BugStateSlot {
  const byCategory: Record<string, CritSlotData> = {}
  for (const name of levelNames) {
    const list = acc.byLevel.get(name) ?? []
    byCategory[name] = { states: avgStates(list, stateOrder), bugCount: list.length }
  }
  return {
    key,
    label,
    fullLabel,
    states: avgStates(acc.all, stateOrder),
    bugCount: acc.all.length,
    byCategory
  }
}

function emptyAcc(): SlotAccumulator {
  return { all: [], byLevel: new Map() }
}

function pushDurations(
  acc: SlotAccumulator,
  durations: Partial<Record<string, number>>,
  level: string | null
): void {
  acc.all.push(durations)
  if (level === null) return
  if (!acc.byLevel.has(level)) acc.byLevel.set(level, [])
  acc.byLevel.get(level)!.push(durations)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getBugStateTimeData(
  allBugs: BugItem[],
  sprints: UnifiedSprint[]
): Promise<{
  sprintSlots: BugStateSlot[]
  monthSlots: BugStateSlot[]
  stateOrder: BugStateName[]
}> {
  const config = requireActiveConfig()
  const closedBugs = allBugs.filter((b) => !!b.closedDate)

  // Cada bug segue o Perfil de processo do Produto de onde veio.
  const productProfile = new Map(
    config.products.map((p) => [p.id, config.processProfiles[p.processProfile]])
  )
  const profilesInUse = [...new Set(closedBugs.map((b) => productProfile.get(b.productId)))].filter(
    (p) => p !== undefined
  )
  const stateOrder = mergeStateOrders(profilesInUse.map((p) => p.bugStateOrder))

  if (closedBugs.length === 0) return { sprintSlots: [], monthSlots: [], stateOrder }

  const calendar = createCalendar(config.calendar)
  const levelNames = config.criticality.map((l) => l.name)
  const uniqueIds = [...new Set(closedBugs.map((b) => b.id))]
  const updatesMap = await fetchUpdatesForIds(uniqueIds)

  const sprintAccMap = new Map<string, SlotAccumulator>()
  const monthAccMap = new Map<string, SlotAccumulator>()

  for (const bug of closedBugs) {
    const profile = productProfile.get(bug.productId)
    if (!profile) continue
    const flow: BugFlow = {
      initialState: profile.bugStateOrder[0],
      terminalStates: new Set(profile.terminalStates)
    }
    const updates = updatesMap.get(bug.id) ?? []
    const durations = computeStateDurations(updates, bug.createdDate, flow, calendar)
    const level = classifyCriticality(bug.criticality, config.criticality)

    // Sprint bucket (where bug was CLOSED)
    const sprintKey = bug.closedSprintKey ?? bug.sprintKey
    if (!sprintAccMap.has(sprintKey)) sprintAccMap.set(sprintKey, emptyAcc())
    pushDurations(sprintAccMap.get(sprintKey)!, durations, level)

    // Month bucket (based on closedDate)
    const closedMonth = bug.closedDate!.substring(0, 7)
    if (!monthAccMap.has(closedMonth)) monthAccMap.set(closedMonth, emptyAcc())
    pushDurations(monthAccMap.get(closedMonth)!, durations, level)
  }

  // Sprint slots (oldest → newest)
  const sprintSlots: BugStateSlot[] = [...sprints].reverse().flatMap((sprint) => {
    const acc = sprintAccMap.get(sprint.key)
    if (!acc?.all.length) return []
    const shortLabel = sprintShortName(sprint) ?? sprint.label.slice(0, 8)
    return [makeSlot(sprint.key, shortLabel, sprint.label, acc, stateOrder, levelNames)]
  })

  // Month slots
  const monthSlots: BugStateSlot[] = [...monthAccMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, acc]) => {
      const [year, month] = monthKey.split('-').map(Number)
      const label = `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`
      const fullLabel = `${MONTH_LONG[month - 1]} de ${year}`
      return makeSlot(monthKey, label, fullLabel, acc, stateOrder, levelNames)
    })

  return { sprintSlots, monthSlots, stateOrder }
}
