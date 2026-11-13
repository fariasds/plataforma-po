import { fetchAzure, postAzure } from './client'
import { activeScope, requireActiveConfig, type ResolvedProduct } from './scope'
import { calcBusinessHours } from '@shared/business-hours'
import { createCalendar, type Calendar } from '@shared/calendar'
import type {
  WiqlResponse,
  WorkItemsResponse,
  WorkItemUpdate,
  WorkItemUpdatesResponse,
  UnifiedSprint
} from '@shared/azure'
import { sprintIteration } from '@shared/azure'
import type { DeliveredItem, SprintDeliveryResult } from '@shared/dashboards'

/** Literal de texto no WIQL: aspa simples dobra. Os valores vêm de um arquivo editável. */
export function wiqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Pronto para cláusula `IN` do WIQL. */
export function wiqlList(values: readonly string[]): string {
  return values.map(wiqlQuote).join(', ')
}

/**
 * Cláusulas que prendem a consulta ao Produto: o projeto, os area paths incluídos
 * (vazio = projeto inteiro) e os excluídos, sempre com os filhos (RN-GLB-01).
 */
export function productAreaClauses(product: ResolvedProduct): string {
  const clauses = [`AND [System.TeamProject] = ${wiqlQuote(product.project)}`]
  if (product.areaPaths.length > 0) {
    const included = product.areaPaths
      .map((area) => `[System.AreaPath] UNDER ${wiqlQuote(area)}`)
      .join(' OR ')
    clauses.push(`AND (${included})`)
  }
  for (const area of product.excludedAreaPaths) {
    clauses.push(`AND NOT [System.AreaPath] UNDER ${wiqlQuote(area)}`)
  }
  return clauses.join('\n              ')
}

function toDateKey(iso: string): string {
  return iso.split('T')[0]
}

const FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
  'System.IterationPath',
  'System.CreatedDate'
].join(',')

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getWorkItemUpdates(projectName: string, itemId: number): Promise<WorkItemUpdate[]> {
  const data = await fetchAzure<WorkItemUpdatesResponse>(
    `/${projectName}/_apis/wit/workitems/${itemId}/updates?api-version=7.1`
  )
  return data.value
}

// No Azure DevOps, revision[N].revisedDate = data em que a revision[N+1] foi criada.
// A última revisão (estado atual) sempre tem revisedDate = "9999-01-01T00:00:00Z".
// Portanto: data real de aplicação da revision[i] = revisedDate da revision[i-1].
// Para i=0 usamos revisedDate do próprio item (aproximação aceitável).
function getAppliedAt(sorted: WorkItemUpdate[], index: number): string {
  return index > 0 ? sorted[index - 1].revisedDate : sorted[0].revisedDate
}

// Retorna a data da primeira transição para targetStates ocorrida a partir de afterTimestamp.
function findFirstStateChange(
  updates: WorkItemUpdate[],
  targetStates: string[],
  afterTimestamp: number
): string | null {
  const sorted = [...updates].sort((a, b) => a.id - b.id)

  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i]
    if (!u.fields?.['System.State']) continue
    if (!targetStates.includes(u.fields['System.State'].newValue)) continue

    const appliedAt = getAppliedAt(sorted, i)
    if (new Date(appliedAt).getTime() < afterTimestamp) continue

    return appliedAt
  }
  return null
}

function findFirstIterationAssignment(
  updates: WorkItemUpdate[],
  iterationPath: string
): string | null {
  const sorted = [...updates].sort((a, b) => a.id - b.id)

  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i]
    if (u.fields?.['System.IterationPath']?.newValue === iterationPath) {
      return getAppliedAt(sorted, i)
    }
  }
  return null
}

// Lê a parte de data da string ISO ignorando timezone (evita bug UTC→BRT)
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isWithinWindow(dateStr: string, startDate: string, finishDate: string): boolean {
  const date = new Date(dateStr).getTime()

  // Segunda-feira 00:00:00 local
  const start = parseLocalDate(startDate)
  start.setHours(0, 0, 0, 0)

  // Sexta-feira 23:59:59 local — fim de semana não conta para esta sprint
  const finish = parseLocalDate(finishDate)
  finish.setHours(23, 59, 59, 999)

  return date >= start.getTime() && date <= finish.getTime()
}

// Retorna todos os períodos em que o item esteve no estado de desenvolvimento.
function getInProgressPeriods(
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

  if (inProgressStart) {
    periods.push({ start: inProgressStart, end: new Date() })
  }

  return periods
}

// Calcula horas úteis que o item passou em desenvolvimento dentro da janela da sprint.
// Fallback: se nunca houve desenvolvimento, usa [fallbackStart, fallbackEnd] como período.
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

  let totalHours = 0
  for (const { start, end } of activePeriods) {
    const clippedStart = start < sprintStart ? sprintStart : start
    const clippedEnd = end > sprintEnd ? sprintEnd : end
    if (clippedStart < clippedEnd) {
      totalHours += calcBusinessHours(
        clippedStart.toISOString(),
        clippedEnd.toISOString(),
        calendar
      )
    }
  }

  return Math.round(totalHours * 10) / 10
}

// ─── Por Produto ─────────────────────────────────────────────────────────────

/**
 * Entregas de um Produto na janela da sprint. Produto de sprints sem iteração
 * nesta Sprint unificada devolve `null`: não participa. Produto de fluxo contínuo
 * é medido só pela janela de datas, sem planejado nem injeção (RN-ENT-04, RN-ENT-08).
 */
async function fetchDeliveryForProduct(
  product: ResolvedProduct,
  sprint: UnifiedSprint,
  calendar: Calendar
): Promise<SprintDeliveryResult | null> {
  let iterationPath: string | null = null
  if (product.cadence === 'sprints') {
    const iteration = sprintIteration(sprint, product.id)
    if (!iteration) return null
    iterationPath = iteration.path
  }

  const { startDate: sprintStartDate, finishDate: sprintFinishDate } = sprint
  const profile = product.processProfile
  const projectName = product.project
  const typeFilter = wiqlList(profile.workItemTypes)
  const stateFilter = wiqlList(profile.deliveredStates)
  const areaClauses = productAreaClauses(product)

  // IterationPath é PLANEJAMENTO — não usamos para medir entrega.
  // Pré-filtramos por StateChangeDate dentro da janela para limitar o volume de
  // candidatos antes de verificar o histórico.
  const startStr = toDateKey(sprintStartDate)
  const finishStr = toDateKey(sprintFinishDate)

  // Com iteração, o OR captura também o item planejado nesta sprint que mudou de
  // estado de novo depois (ex.: de um estado de entrega para outro na sprint
  // seguinte), cujo StateChangeDate atual cai fora da janela (RN-ENT-03).
  const windowClause = `(
                  [Microsoft.VSTS.Common.StateChangeDate] >= '${startStr}'
                  AND [Microsoft.VSTS.Common.StateChangeDate] <= '${finishStr}'
                )`
  const candidateClause = iterationPath
    ? `(
                ${windowClause}
                OR [System.IterationPath] = ${wiqlQuote(iterationPath)}
              )`
    : windowClause

  const deliveryWiql = await postAzure<WiqlResponse>(
    `/${projectName}/_apis/wit/wiql?api-version=7.1`,
    {
      query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] IN (${typeFilter})
              AND [System.State] IN (${stateFilter})
              AND ${candidateClause}
              ${areaClauses}
              ORDER BY [Microsoft.VSTS.Common.StateChangeDate] DESC`
    }
  )

  const sprintStartTimestamp = parseLocalDate(sprintStartDate).setHours(0, 0, 0, 0)

  // ── Itens entregues ──────────────────────────────────────────────────────
  let deliveredItems: DeliveredItem[] = []

  if (deliveryWiql.workItems.length) {
    const ids = deliveryWiql.workItems.map((w) => w.id).join(',')
    const { value: candidates } = await fetchAzure<WorkItemsResponse>(
      `/${projectName}/_apis/wit/workitems?ids=${ids}&fields=${FIELDS}&api-version=7.1`
    )

    const withUpdates = await Promise.all(
      candidates.map(async (item) => ({
        item,
        updates: await getWorkItemUpdates(projectName, item.id)
      }))
    )

    deliveredItems = withUpdates.flatMap(({ item, updates }) => {
      // Primeira entrega ABSOLUTA (timestamp=0 = sem restrição de início).
      // Se o item já foi entregue numa sprint anterior, closedAt cai fora da janela → excluído.
      const closedAt = findFirstStateChange(updates, profile.deliveredStates, 0)
      if (!closedAt || !isWithinWindow(closedAt, sprintStartDate, sprintFinishDate)) return []

      // Lead time total: desenvolvimento → fim do desenvolvimento (ou entrega, como fallback)
      const inProgressAt = findFirstStateChange(updates, [profile.inProgressState], 0)
      const devDoneAt =
        inProgressAt && profile.devDoneState
          ? findFirstStateChange(updates, [profile.devDoneState], new Date(inProgressAt).getTime())
          : null
      const ltStart = inProgressAt ?? item.fields['System.CreatedDate']
      const ltEnd = devDoneAt ?? closedAt
      const leadTimeHours = calcBusinessHours(ltStart, ltEnd, calendar)

      const devTimeInSprintHours = calcInSprintDevHours(
        getInProgressPeriods(updates, profile.inProgressState),
        new Date(item.fields['System.CreatedDate']),
        new Date(closedAt),
        sprintStartDate,
        sprintFinishDate,
        calendar
      )

      return [{ workItem: item, closedAt, leadTimeHours, devTimeInSprintHours }]
    })
  }

  // ── Planejado e injeção de escopo (baseados em IterationPath — é planejamento) ──
  let totalInSprint = 0
  let scopeInjectedCount = 0

  if (iterationPath) {
    const scopeWiql = await postAzure<WiqlResponse>(
      `/${projectName}/_apis/wit/wiql?api-version=7.1`,
      {
        query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.IterationPath] = ${wiqlQuote(iterationPath)}
              AND [System.WorkItemType] IN (${typeFilter})
              ${areaClauses}
              ORDER BY [System.Id] ASC`
      }
    )
    totalInSprint = scopeWiql.workItems.length

    if (scopeWiql.workItems.length) {
      const scopeIds = scopeWiql.workItems.map((w) => w.id).join(',')
      const { value: scopeItems } = await fetchAzure<WorkItemsResponse>(
        `/${projectName}/_apis/wit/workitems?ids=${scopeIds}&fields=${FIELDS}&api-version=7.1`
      )

      const scopeWithUpdates = await Promise.all(
        scopeItems.map(async (item) => ({
          item,
          updates: await getWorkItemUpdates(projectName, item.id)
        }))
      )

      scopeInjectedCount = scopeWithUpdates.filter(({ item, updates }) => {
        const assignedDate = findFirstIterationAssignment(
          updates,
          item.fields['System.IterationPath']
        )
        return assignedDate ? new Date(assignedDate).getTime() > sprintStartTimestamp : false
      }).length
    }
  }

  // Distribuição por tipo — soma horas de lead time total e sprint
  const typeHours: Record<string, number> = {}
  const typeHoursInSprint: Record<string, number> = {}
  for (const { workItem, leadTimeHours, devTimeInSprintHours } of deliveredItems) {
    const type = workItem.fields['System.WorkItemType']
    typeHours[type] = Math.round(((typeHours[type] ?? 0) + leadTimeHours) * 10) / 10
    typeHoursInSprint[type] =
      Math.round(((typeHoursInSprint[type] ?? 0) + devTimeInSprintHours) * 10) / 10
  }

  return {
    deliveredItems,
    totalInSprint,
    scopeInjectedCount,
    typeDistribution: toEntries(typeHours),
    typeDistributionInSprint: toEntries(typeHoursInSprint)
  }
}

function toEntries(record: Record<string, number>): { name: string; value: number }[] {
  return Object.entries(record).map(([name, value]) => ({ name, value }))
}

/** Soma dos Produtos, na ordem do escopo (RN-ENT-13). Um Produto só é a própria soma. */
function mergeResults(results: SprintDeliveryResult[]): SprintDeliveryResult {
  const typeHours: Record<string, number> = {}
  const typeHoursInSprint: Record<string, number> = {}
  for (const r of results) {
    for (const { name, value } of r.typeDistribution) {
      typeHours[name] = (typeHours[name] ?? 0) + value
    }
    for (const { name, value } of r.typeDistributionInSprint) {
      typeHoursInSprint[name] = (typeHoursInSprint[name] ?? 0) + value
    }
  }

  return {
    deliveredItems: results.flatMap((r) => r.deliveredItems),
    totalInSprint: results.reduce((s, r) => s + r.totalInSprint, 0),
    scopeInjectedCount: results.reduce((s, r) => s + r.scopeInjectedCount, 0),
    typeDistribution: toEntries(typeHours),
    typeDistributionInSprint: toEntries(typeHoursInSprint)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getSprintDeliveryData(
  selectionId: string,
  sprint: UnifiedSprint
): Promise<SprintDeliveryResult> {
  const config = requireActiveConfig()
  const calendar = createCalendar(config.calendar)
  const { products } = activeScope(selectionId)

  const results = await Promise.all(
    products.map((product) => fetchDeliveryForProduct(product, sprint, calendar))
  )
  return mergeResults(results.filter((r): r is SprintDeliveryResult => r !== null))
}
