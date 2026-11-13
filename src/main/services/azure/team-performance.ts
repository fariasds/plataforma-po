import type { UnifiedSprint } from '@shared/azure'
import { sprintShortName } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import type { BugItem, SlaLevelStat, SlaSlot, TeamPerformanceResult } from '@shared/dashboards'
import { getBugAnalysisData } from './bug-analysis'
import { classifyCriticality, getBugStateTimeData } from './bug-state-time'
import { getDevFocusData } from './dev-focus'
import { getReworkData } from './rework'
import { requireActiveConfig } from './scope'

// ─── SLA (RN-DES-03) ─────────────────────────────────────────────────────────

type CriticalityLevel = Configuration['criticality'][number]

type LevelCounts = Map<string, { within: number; total: number }>

function toSlaSlot(
  key: string,
  label: string,
  fullLabel: string,
  counts: LevelCounts,
  levels: readonly CriticalityLevel[]
): SlaSlot {
  const stats: Record<string, SlaLevelStat> = {}
  for (const { name } of levels) {
    const { within, total } = counts.get(name) ?? { within: 0, total: 0 }
    stats[name] = { percent: total > 0 ? Math.round((within / total) * 100) : null, within, total }
  }
  return { key, label, fullLabel, levels: stats }
}

/** Soma o bug no seu nível. Sem nível reconhecido, fechamento ou prazo, ele não entra no SLA. */
function countBug(bug: BugItem, counts: LevelCounts, levels: readonly CriticalityLevel[]): void {
  const level = classifyCriticality(bug.criticality, levels)
  if (!level || !bug.closedDate || !bug.dueDate) return
  const entry = counts.get(level) ?? { within: 0, total: 0 }
  entry.total++
  if (new Date(bug.closedDate) <= new Date(bug.dueDate)) entry.within++
  counts.set(level, entry)
}

export function computeSlaSprintStats(
  allBugs: BugItem[],
  sprints: UnifiedSprint[],
  levels: readonly CriticalityLevel[]
): SlaSlot[] {
  const sprintKeySet = new Set(sprints.map((s) => s.key))
  const map = new Map<string, LevelCounts>()

  for (const bug of allBugs) {
    const sprintKey = bug.closedSprintKey ?? bug.sprintKey
    if (!sprintKeySet.has(sprintKey)) continue
    if (!map.has(sprintKey)) map.set(sprintKey, new Map())
    countBug(bug, map.get(sprintKey)!, levels)
  }

  // Oldest → newest (buildUnifiedSprints returns newest → oldest)
  return [...sprints].reverse().flatMap((sprint) => {
    const counts = map.get(sprint.key)
    if (!counts || counts.size === 0) return []

    const shortLabel = sprintShortName(sprint) ?? sprint.label.slice(0, 8)
    return [toSlaSlot(sprint.key, shortLabel, sprint.label, counts, levels)]
  })
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

export function computeSlaMonthStats(
  allBugs: BugItem[],
  levels: readonly CriticalityLevel[]
): SlaSlot[] {
  const map = new Map<string, LevelCounts>()

  for (const bug of allBugs) {
    if (!bug.closedDate) continue
    const d = new Date(bug.closedDate)
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (!map.has(monthKey)) map.set(monthKey, new Map())
    countBug(bug, map.get(monthKey)!, levels)
  }

  return [...map.entries()]
    .filter(([, counts]) => counts.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, counts]) => {
      const [year, month] = monthKey.split('-').map(Number)
      const label = `${MONTH_SHORT[month - 1]}/${String(year).slice(2)}`
      const fullLabel = `${MONTH_LONG[month - 1]} de ${year}`
      return toSlaSlot(monthKey, label, fullLabel, counts, levels)
    })
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getTeamPerformanceData(
  selectionId: string,
  sprints: UnifiedSprint[]
): Promise<TeamPerformanceResult> {
  const levels = requireActiveConfig().criticality
  // Bug data and rework data cover the same sprint range — fetch together.
  const [bugData, reworkData] = await Promise.all([
    getBugAnalysisData(selectionId, sprints, sprints[0]),
    getReworkData(selectionId, sprints)
  ])

  // These two walk the update history of every item. They are the slowest and
  // the most likely to fail, so a failure here costs its own chart — not the screen.
  const [bugStateResult, devFocusResult] = await Promise.allSettled([
    getBugStateTimeData(bugData.allBugs, sprints),
    getDevFocusData(selectionId, sprints)
  ])

  const partialFailures: string[] = []
  if (bugStateResult.status === 'rejected') partialFailures.push('Tempo por estado do bug')
  if (devFocusResult.status === 'rejected') partialFailures.push('Foco em desenvolvimento')

  return {
    criticalityLevels: levels.map(({ name, color }) => ({ name, color: color ?? null })),
    // A ordem é a do tempo por estado; se ele falhou, a da Análise de Bugs, que
    // vem do mesmo bugStateOrder (RN-DES-05).
    bugStateOrder:
      bugStateResult.status === 'fulfilled' ? bugStateResult.value.stateOrder : bugData.stateOrder,
    reworkUnavailable: reworkData.unavailable ?? null,
    slaSprintStats: computeSlaSprintStats(bugData.allBugs, sprints, levels),
    slaMonthStats: computeSlaMonthStats(bugData.allBugs, levels),
    reworkSprintSlots: reworkData.sprintSlots,
    reworkMonthSlots: reworkData.monthSlots,
    bugStateSprintSlots:
      bugStateResult.status === 'fulfilled' ? bugStateResult.value.sprintSlots : [],
    bugStateMonthSlots:
      bugStateResult.status === 'fulfilled' ? bugStateResult.value.monthSlots : [],
    devFocusSprintSlots:
      devFocusResult.status === 'fulfilled' ? devFocusResult.value.sprintSlots : [],
    devFocusMonthSlots:
      devFocusResult.status === 'fulfilled' ? devFocusResult.value.monthSlots : [],
    partialFailures
  }
}
