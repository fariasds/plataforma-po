import type { BugAnalysisResult, BugItem, MonthBugStats, SprintBugStats } from '@shared/dashboards'
import { fetchAzure, postAzure } from './client'
import { requireActiveConfig, resolveScope, type ResolvedProduct } from './scope'
import type { Configuration } from '@shared/config/schema'
import type { WiqlResponse } from '@shared/azure'
import type { UnifiedSprint } from '@shared/azure'
import { sprintShortName } from '@shared/azure'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BugWorkItemFields {
  'System.Id': number
  'System.Title': string
  'System.State': string
  'System.WorkItemType': string
  'System.CreatedDate': string
  'System.IterationPath': string
  [key: string]: unknown
}

interface BugWorkItemsResponse {
  value: Array<{ id: number; fields: BugWorkItemFields }>
}

interface ProjectFieldsResponse {
  value: Array<{ referenceName: string; isDeleted?: boolean }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.CreatedDate',
  'System.IterationPath',
  'Microsoft.VSTS.Common.ClosedDate',
  'Microsoft.VSTS.Scheduling.DueDate'
]

/** Rótulo do bug sem criticidade preenchida (RN-BUG-05). */
export const CRITICALITY_MISSING = 'Não informado'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isWithinSprint(createdDate: string, sprint: UnifiedSprint): boolean {
  const date = parseLocalDate(createdDate)
  const start = parseLocalDate(sprint.startDate)
  const finish = parseLocalDate(sprint.finishDate)
  finish.setHours(23, 59, 59, 999)
  return date >= start && date <= finish
}

/** Literal de texto do WIQL. O valor vem da Configuração, que a IA do PO edita. */
function wiqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function wiqlList(values: string[]): string {
  return values.map(wiqlText).join(', ')
}

/**
 * Projeto, area paths incluídos (qualquer um deles) e excluídos (RN-BUG-01).
 * Sem area path incluído, vale o projeto inteiro.
 */
export function buildScopeClauses(product: ResolvedProduct): string {
  const clauses = [`AND [System.TeamProject] = ${wiqlText(product.project)}`]
  if (product.areaPaths.length > 0) {
    const any = product.areaPaths.map((area) => `[System.AreaPath] UNDER ${wiqlText(area)}`)
    clauses.push(`AND (${any.join(' OR ')})`)
  }
  for (const area of product.excludedAreaPaths) {
    clauses.push(`AND NOT [System.AreaPath] UNDER ${wiqlText(area)}`)
  }
  return clauses.join('\n              ')
}

/** `customFields.criticality` como lista: um campo, vários (lidos em ordem) ou nenhum. */
export function criticalityFieldRefs(config: Configuration): string[] {
  const field = config.customFields.criticality
  if (field === null) return []
  return typeof field === 'string' ? [field] : field
}

/**
 * Dos campos de criticidade da Configuração, os que existem no projeto, com o
 * nome como o Azure o escreve. O Azure recusa a requisição inteira (400) quando
 * um único campo pedido não existe — e a lista serve justamente a Produtos em
 * projetos com campos diferentes (RN-BUG-05).
 */
async function existingCriticalityRefs(project: string, refs: string[]): Promise<string[]> {
  if (refs.length === 0) return []
  const { value } = await fetchAzure<ProjectFieldsResponse>(
    `/${project}/_apis/wit/fields?api-version=7.1`
  )
  const known = new Map(
    value.filter((f) => !f.isDeleted).map((f) => [f.referenceName.toLowerCase(), f.referenceName])
  )
  const existing = refs.flatMap((ref) => known.get(ref.toLowerCase()) ?? [])
  if (existing.length < refs.length) {
    const missing = refs.filter((ref) => !known.has(ref.toLowerCase()))
    console.warn(
      `[bugs] campo de criticidade fora do projeto ${project}, ignorado: ${missing.join(', ')}`
    )
  }
  return existing
}

/** Vale o primeiro campo preenchido, na ordem da Configuração (RN-BUG-05). */
function extractCriticality(fields: BugWorkItemFields, refs: string[]): string {
  for (const ref of refs) {
    const val = fields[ref]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return CRITICALITY_MISSING
}

function isRecurrentTitle(title: string, tag: string | null): boolean {
  return tag !== null && title.toLowerCase().includes(tag.toLowerCase())
}

/** Ordens de estado dos Perfis de processo do escopo, na ordem do escopo e sem repetir. */
export function mergeStateOrders(orders: string[][]): string[] {
  return [...new Set(orders.flat())]
}

function resolveSprintName(sprint: UnifiedSprint): string {
  return sprintShortName(sprint) ?? sprint.label
}

/** Returns "YYYY-MM-01" for the first day of (current month − 9), giving 10 months total. */
function getMonthRangeStart(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 9, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getMonthKey(iso: string): string {
  return iso.split('T')[0].substring(0, 7) // "2025-03"
}

const MONTH_ABBR = [
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

function getMonthLabel(iso: string): string {
  const parts = iso.split('T')[0].split('-')
  const year = parts[0]
  const month = parseInt(parts[1], 10)
  return `${MONTH_ABBR[month - 1]}/${year.slice(2)}` // "Mar/25"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Azure DevOps limits workitems batch requests to 200 IDs. */
const WORKITEMS_CHUNK_SIZE = 200

async function fetchWorkItemsChunked(
  projectName: string,
  ids: number[],
  fields: string
): Promise<Array<{ id: number; fields: BugWorkItemFields }>> {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += WORKITEMS_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + WORKITEMS_CHUNK_SIZE))
  }
  const responses = await Promise.all(
    chunks.map((chunk) =>
      fetchAzure<BugWorkItemsResponse>(
        `/${projectName}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.1`
      )
    )
  )
  return responses.flatMap((r) => r.value)
}

// ─── Per-product fetcher ──────────────────────────────────────────────────────

interface ProductBugs {
  allBugs: BugItem[]
  activeBugItems: BugItem[]
  activeBugsCount: number
  activeBugsByState: { name: string; value: number }[]
  /** Campos de criticidade que existem no projeto deste Produto. */
  criticalityRefs: string[]
}

interface FetchContext {
  sprints: UnifiedSprint[]
  rangeStart: string
  rangeEnd: string
  criticalityRefs: string[]
  recurrentTag: string | null
}

async function fetchBugsForProduct(
  product: ResolvedProduct,
  ctx: FetchContext
): Promise<ProductBugs> {
  const { project, processProfile } = product
  const { sprints } = ctx
  const scopeClauses = buildScopeClauses(product)
  const removedClause =
    processProfile.removedStates.length > 0
      ? `AND [System.State] NOT IN (${wiqlList(processProfile.removedStates)})`
      : ''

  const [criticalityRefs, historicalWiql, activeWiql] = await Promise.all([
    existingCriticalityRefs(project, ctx.criticalityRefs),
    // Bugs criados na janela das sprints e dos meses, descartados de fora (RN-BUG-02)
    postAzure<WiqlResponse>(`/${project}/_apis/wit/wiql?api-version=7.1`, {
      query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] = ${wiqlText(processProfile.bugType)}
              ${removedClause}
              AND [System.CreatedDate] >= '${ctx.rangeStart}'
              AND [System.CreatedDate] <= '${ctx.rangeEnd}'
              ${scopeClauses}
              ORDER BY [System.CreatedDate] DESC`
    }),
    // Bugs ativos: fora dos estados terminais do Perfil de processo (RN-BUG-04)
    postAzure<WiqlResponse>(`/${project}/_apis/wit/wiql?api-version=7.1`, {
      query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] = ${wiqlText(processProfile.bugType)}
              AND [System.State] NOT IN (${wiqlList(processProfile.terminalStates)})
              ${scopeClauses}
              ORDER BY [System.Id] DESC`
    })
  ])
  const fields = [...BASE_FIELDS, ...criticalityRefs].join(',')

  function toBugItem(item: { id: number; fields: BugWorkItemFields }, active: boolean): BugItem {
    const { fields } = item
    const createdDate = fields['System.CreatedDate'] as string
    const title = (fields['System.Title'] as string) ?? ''
    const closedDate = fields['Microsoft.VSTS.Common.ClosedDate'] as string | undefined
    const dueDate = fields['Microsoft.VSTS.Scheduling.DueDate'] as string | undefined
    const matchedSprint = sprints.find((s) => isWithinSprint(createdDate, s))
    // Sprint em que o bug foi fechado (pode ser diferente da de criação)
    const closedSprint =
      !active && closedDate ? sprints.find((s) => isWithinSprint(closedDate, s)) : undefined
    const state = (fields['System.State'] as string) || (active ? 'Desconhecido' : '')
    const sprintName = matchedSprint
      ? resolveSprintName(matchedSprint)
      : active
        ? 'Anterior ao histórico'
        : ''
    return {
      id: item.id,
      productId: product.id,
      title,
      state,
      criticality: extractCriticality(fields, criticalityRefs),
      createdDate,
      closedDate: closedDate || undefined,
      dueDate: dueDate || undefined,
      sprintKey: matchedSprint?.key ?? (active ? '__active__' : '__no_sprint__'),
      sprintLabel: matchedSprint?.label ?? '',
      sprintName,
      ...(active ? {} : { closedSprintKey: closedSprint?.key }),
      monthKey: getMonthKey(createdDate),
      monthLabel: getMonthLabel(createdDate),
      isRecurrent: isRecurrentTitle(title, ctx.recurrentTag)
    }
  }

  const activeBugItems: BugItem[] = []
  if (activeWiql.workItems.length > 0) {
    const activeItems = await fetchWorkItemsChunked(
      project,
      activeWiql.workItems.map((w) => w.id),
      fields
    )
    for (const item of activeItems) activeBugItems.push(toBugItem(item, true))
  }

  const stateCounts: Record<string, number> = {}
  for (const bug of activeBugItems) stateCounts[bug.state] = (stateCounts[bug.state] ?? 0) + 1
  const activeBugsByState = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  const allBugs: BugItem[] = []
  if (historicalWiql.workItems.length > 0) {
    const items = await fetchWorkItemsChunked(
      project,
      historicalWiql.workItems.map((w) => w.id),
      fields
    )
    for (const item of items) allBugs.push(toBugItem(item, false))
  }

  return {
    allBugs,
    activeBugItems,
    activeBugsCount: activeWiql.workItems.length,
    activeBugsByState,
    criticalityRefs
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getBugAnalysisData(
  selectionId: string,
  sprints: UnifiedSprint[],
  selectedSprint: UnifiedSprint
): Promise<BugAnalysisResult> {
  const config = requireActiveConfig()
  const scope = resolveScope(selectionId, config)
  const monthRangeStart = getMonthRangeStart()

  const sorted = [...sprints].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  )
  const sprintRangeStart = sorted[0].startDate.split('T')[0]
  const ctx: FetchContext = {
    sprints,
    // A mais antiga das duas janelas cobre as duas visões (RN-BUG-02)
    rangeStart: sprintRangeStart < monthRangeStart ? sprintRangeStart : monthRangeStart,
    rangeEnd: sorted[sorted.length - 1].finishDate.split('T')[0],
    criticalityRefs: criticalityFieldRefs(config),
    recurrentTag: config.recurrentBugTag
  }

  const results = await Promise.all(scope.products.map((p) => fetchBugsForProduct(p, ctx)))

  const allBugs = results.flatMap((r) => r.allBugs)
  const activeBugItems = results.flatMap((r) => r.activeBugItems)
  const activeBugsCount = results.reduce((s, r) => s + r.activeBugsCount, 0)

  // Merge activeBugsByState across projects
  const stateTotals: Record<string, number> = {}
  for (const r of results) {
    for (const { name, value } of r.activeBugsByState) {
      stateTotals[name] = (stateTotals[name] ?? 0) + value
    }
  }
  const activeBugsByState = Object.entries(stateTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // Sprint stats ordered oldest → newest (for the chart X axis)
  const orderedSprints = [...sprints].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  )

  const sprintStats: SprintBugStats[] = orderedSprints.map((sprint) => {
    const sprintBugs = allBugs.filter((b) => b.sprintKey === sprint.key)
    const recurrentCount = sprintBugs.filter((b) => b.isRecurrent).length
    const total = sprintBugs.length
    return {
      sprintKey: sprint.key,
      sprintLabel: sprint.label,
      sprintName: resolveSprintName(sprint),
      startDate: sprint.startDate,
      finishDate: sprint.finishDate,
      total,
      recurrentCount,
      recurrenceRate: total > 0 ? Math.round((recurrentCount / total) * 100) : 0
    }
  })

  // Month stats: group allBugs by monthKey, ordered oldest → newest (only last 10 months)
  const monthCutoff = monthRangeStart.substring(0, 7) // "YYYY-MM"
  const monthTotals: Record<string, { label: string; total: number; recurrentCount: number }> = {}
  for (const bug of allBugs.filter((b) => b.monthKey >= monthCutoff)) {
    const entry = monthTotals[bug.monthKey] ?? {
      label: bug.monthLabel,
      total: 0,
      recurrentCount: 0
    }
    entry.total += 1
    if (bug.isRecurrent) entry.recurrentCount += 1
    monthTotals[bug.monthKey] = entry
  }
  const monthStats: MonthBugStats[] = Object.entries(monthTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, { label, total, recurrentCount }]) => ({
      monthKey,
      monthLabel: label,
      total,
      recurrentCount,
      recurrenceRate: total > 0 ? Math.round((recurrentCount / total) * 100) : 0
    }))

  // Criticality breakdown for the selected sprint
  const selectedBugs = allBugs.filter((b) => b.sprintKey === selectedSprint.key)
  const critCounts: Record<string, number> = {}
  for (const bug of selectedBugs) {
    const key = bug.criticality || CRITICALITY_MISSING
    critCounts[key] = (critCounts[key] ?? 0) + 1
  }
  const criticalityBreakdown = Object.entries(critCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  return {
    sprintStats,
    monthStats,
    criticalityBreakdown,
    activeBugsByState,
    activeBugsCount,
    allBugs,
    activeBugItems,
    stateOrder: mergeStateOrders(scope.products.map((p) => p.processProfile.bugStateOrder)),
    criticalityConfigured: results.some((r) => r.criticalityRefs.length > 0),
    recurrenceConfigured: ctx.recurrentTag !== null
  }
}
