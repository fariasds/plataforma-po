import type { UnifiedSprint, WiqlResponse } from '@shared/azure'
import { sprintIteration } from '@shared/azure'
import type { WorkItemUpdate, WorkItemUpdatesResponse } from '@shared/azure'
import type {
  DailyAssignee,
  DailyItem,
  DailyResult,
  DailyRisk,
  DailyStatus,
  DailyTask
} from '@shared/dashboards'
import { calcBusinessHours } from '@shared/business-hours'
import { createCalendar, type Calendar } from '@shared/calendar'
import type { Configuration } from '@shared/config/schema'
import {
  buildSprintCalendar,
  dayOfSprint,
  projectEndDay,
  weekBreakDay,
  type SprintDay
} from '@shared/sprint-calendar'
import { spToHours, type StoryPointsTable } from '@shared/story-points'
import { fetchAzure, fetchAzureAvatar, postAzure } from './client'
import { requireActiveConfig, resolveScope, type ResolvedProduct } from './scope'

/**
 * Estado da sprint item a item, para a daily.
 *
 * Duas réguas diferentes convivem aqui, e a conversão para **dias** é o que as
 * torna comparáveis (RN-DLY-01):
 * - A **estimativa** vem da tabela SP→horas, dividida pelas horas de trabalho
 *   efetivo por dia (`calendar.productiveHoursPerDay`).
 * - O **consumo** vem de horas úteis de calendário, divididas pela soma do
 *   expediente (`calendar.workingHours`).
 *
 * Comparar as horas diretamente acusaria atraso em tudo, na proporção entre as duas.
 */

/** Réguas do dia e calendário, lidos da Configuração a cada carga. */
interface DayRulers {
  calendar: Calendar
  /** Horas de trabalho efetivo num dia — régua da estimativa. */
  productiveHoursPerDay: number
  /** Horas úteis de calendário num dia — régua do consumo. */
  businessHoursPerDay: number
  /** Tabela de conversão de Story Points em horas, da Configuração. */
  storyPoints: StoryPointsTable
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function dayRulers(config: Configuration): DayRulers {
  const workingMinutes = config.calendar.workingHours.reduce(
    (sum, range) => sum + minutesOf(range.end) - minutesOf(range.start),
    0
  )
  return {
    calendar: createCalendar(config.calendar),
    productiveHoursPerDay: config.calendar.productiveHoursPerDay,
    businessHoursPerDay: workingMinutes / 60,
    storyPoints: config.storyPoints
  }
}

/** Quantos itens buscam histórico em paralelo. */
const CONCURRENT = 20

/** Espera antes da segunda tentativa de histórico — dá folga a limite de taxa. */
const RETRY_DELAY_MS = 400

const TASK_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.Parent',
  'System.AssignedTo'
].join(',')

/** Literal de texto no WIQL: aspa simples dobrada, como a linguagem exige. */
function wiqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function wiqlList(values: readonly string[]): string {
  return values.map(wiqlString).join(', ')
}

/** Área do Produto (RN-GLB-03): sem `areaPaths`, vale o projeto inteiro. */
function buildAreaClauses(product: ResolvedProduct): string {
  const clauses: string[] = []
  if (product.areaPaths.length > 0) {
    const included = product.areaPaths
      .map((area) => `[System.AreaPath] UNDER ${wiqlString(area)}`)
      .join(' OR ')
    clauses.push(`AND (${included})`)
  }
  for (const area of product.excludedAreaPaths) {
    clauses.push(`AND NOT [System.AreaPath] UNDER ${wiqlString(area)}`)
  }
  return clauses.join('\n              ')
}

/**
 * Estados que encerram o desenvolvimento (RN-DLY-14): o `devDoneState` é o caminho
 * normal, mas o item pode ir direto para um estado de entrega — e nesse caso o
 * desenvolvimento também terminou. Vale a **primeira** ocorrência de qualquer um.
 */
function devDoneStates(product: ResolvedProduct): string[] {
  const { devDoneState, deliveredStates } = product.processProfile
  return devDoneState ? [devDoneState, ...deliveredStates] : [...deliveredStates]
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// ─── Histórico ───────────────────────────────────────────────────────────────

/**
 * No Azure, `revision[N].revisedDate` é quando a revisão seguinte foi criada.
 * A data real de aplicação da revisão `i` é o `revisedDate` da anterior.
 */
function getAppliedAt(sorted: WorkItemUpdate[], index: number): string {
  return index > 0 ? sorted[index - 1].revisedDate : sorted[0].revisedDate
}

/**
 * Primeira vez, em toda a vida do item, em que ele entrou em **qualquer** dos
 * estados dados.
 */
function findFirstEntry(updates: WorkItemUpdate[], states: string[]): string | null {
  const wanted = new Set(states)
  const sorted = [...updates].sort((a, b) => a.id - b.id)
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i].fields?.['System.State']?.newValue
    if (next && wanted.has(next)) {
      return getAppliedAt(sorted, i)
    }
  }
  return null
}

async function fetchUpdates(projectName: string, id: number): Promise<WorkItemUpdate[]> {
  const data = await fetchAzure<WorkItemUpdatesResponse>(
    `/${projectName}/_apis/wit/workitems/${id}/updates?api-version=7.1`
  )
  return data.value
}

// ─── Responsável ─────────────────────────────────────────────────────────────

interface RawIdentity {
  displayName?: string
  uniqueName?: string
  imageUrl?: string
  _links?: { avatar?: { href?: string } }
}

function readAssignee(raw: unknown): { identity: DailyAssignee; avatarUrl: string | null } | null {
  if (!raw || typeof raw !== 'object') return null
  const identity = raw as RawIdentity
  if (!identity.displayName) return null

  return {
    identity: {
      displayName: identity.displayName,
      uniqueName: identity.uniqueName ?? '',
      avatar: null
    },
    avatarUrl: identity._links?.avatar?.href ?? identity.imageUrl ?? null
  }
}

// ─── Tasks filhas ────────────────────────────────────────────────────────────

/**
 * Busca as tasks da iteração numa consulta só e agrupa por item pai. Bem mais
 * barato do que expandir as relações de cada item individualmente.
 */
type PendingTask = DailyTask & { avatarUrl: string | null }

async function fetchTasksByParent(
  product: ResolvedProduct,
  iterationPath: string
): Promise<Map<number, PendingTask[]>> {
  const byParent = new Map<number, PendingTask[]>()
  const { taskType, terminalStates } = product.processProfile
  // Task encerrada por qualquer caminho — entregue, fechada ou removida — já não
  // é trabalho pendente do item (RN-DLY-12).
  const doneStates = new Set(terminalStates)

  const wiql = await postAzure<WiqlResponse>(`/${product.project}/_apis/wit/wiql?api-version=7.1`, {
    query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] = ${wiqlString(taskType)}
              AND [System.IterationPath] = ${wiqlString(iterationPath)}
              ORDER BY [System.Id] ASC`
  })

  if (!wiql.workItems.length) return byParent

  const ids = wiql.workItems.map((w) => w.id)
  const { value } = await fetchAzure<{
    value: Array<{ id: number; fields: Record<string, unknown> }>
  }>(
    `/${product.project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=${TASK_FIELDS}&api-version=7.1`
  )

  for (const task of value) {
    const parent = toNullableNumber(task.fields['System.Parent'])
    if (parent === null) continue

    const state = String(task.fields['System.State'] ?? '')
    const assigned = readAssignee(task.fields['System.AssignedTo'])
    const list = byParent.get(parent) ?? []
    list.push({
      id: task.id,
      title: String(task.fields['System.Title'] ?? ''),
      state,
      done: doneStates.has(state),
      assignee: assigned?.identity ?? null,
      avatarUrl: assigned?.avatarUrl ?? null
    })
    byParent.set(parent, list)
  }

  return byParent
}

// ─── Posição na sprint ───────────────────────────────────────────────────────

// A régua da sprint é lógica pura e mora em `@shared/sprint-calendar`.

// ─── Classificação de risco ──────────────────────────────────────────────────

function classify(
  status: DailyStatus,
  estimateDays: number | null,
  consumedDays: number | null,
  projectedEndDay: number | null,
  sprintDays: number,
  awaitingTest: boolean
): DailyRisk {
  if (estimateDays === null) return 'unknown'

  // Constatação vale mais que projeção: se já passou do estimado, é isso que importa.
  if (consumedDays !== null && consumedDays > estimateDays) return 'over-estimate'

  if (status === 'done') return 'on-track'

  if (projectedEndDay === null) return 'unknown'
  // O desenvolvimento acabou e só falta validar: a projeção estoura no papel, mas
  // a realidade quase sempre desmente o alarme (RN-DLY-19).
  if (projectedEndDay > sprintDays) return awaitingTest ? 'awaiting-test' : 'over-sprint'
  if (projectedEndDay === sprintDays) return 'at-limit'
  return 'on-track'
}

// ─── Montagem por produto ────────────────────────────────────────────────────

/** O que não muda entre os Produtos de uma mesma carga. */
interface SprintContext {
  days: SprintDay[]
  currentDay: number
  now: Date
  rulers: DayRulers
  /** Campo do contador de retrabalho, ou `null` quando a Configuração não o tem. */
  reworkField: string | null
}

async function fetchDailyForProduct(
  product: ResolvedProduct,
  iterationPath: string,
  { days, currentDay, now, rulers, reworkField }: SprintContext
): Promise<DailyItem[]> {
  const sprintDays = days.length
  const projectName = product.project
  const profile = product.processProfile
  const removedClause =
    profile.removedStates.length > 0
      ? `AND [System.State] NOT IN (${wiqlList(profile.removedStates)})`
      : ''

  const wiql = await postAzure<WiqlResponse>(`/${projectName}/_apis/wit/wiql?api-version=7.1`, {
    query: `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] IN (${wiqlList(profile.plannableTypes)})
              AND [System.IterationPath] = ${wiqlString(iterationPath)}
              ${removedClause}
              ${buildAreaClauses(product)}
              ORDER BY [System.Id] ASC`
  })

  if (!wiql.workItems.length) return []

  const tasksByParent = await fetchTasksByParent(product, iterationPath)
  const ids = wiql.workItems.map((w) => w.id)
  const fields = [
    'System.Id',
    'System.Title',
    'System.State',
    'System.WorkItemType',
    profile.estimateField,
    'System.AssignedTo',
    ...(reworkField ? [reworkField] : [])
  ].join(',')
  const { value: rawItems } = await fetchAzure<{
    value: Array<{ id: number; fields: Record<string, unknown> }>
  }>(`/${projectName}/_apis/wit/workitems?ids=${ids.join(',')}&fields=${fields}&api-version=7.1`)

  // O histórico é a parte cara: uma chamada por item, em blocos.
  //
  // Falhar aqui não é neutro: sem histórico o item não tem entrada no estado de
  // desenvolvimento e é classificado como **não iniciado**, indo parar no bloco
  // errado da tela. O item some de "Em andamento" sem que nada acuse o erro —
  // por isso a falha é reportada, e não engolida.
  const updatesById = new Map<number, WorkItemUpdate[]>()
  const failed: number[] = []

  for (let i = 0; i < ids.length; i += CONCURRENT) {
    const chunk = ids.slice(i, i + CONCURRENT)
    const settled = await Promise.all(
      chunk.map(async (id) => {
        try {
          return { id, updates: await fetchUpdates(projectName, id) }
        } catch (error) {
          // Uma segunda tentativa cobre o transitório — 429 de limite de taxa e
          // queda momentânea de rede, que é o que se vê com 20 chamadas em paralelo.
          try {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
            return { id, updates: await fetchUpdates(projectName, id) }
          } catch (retryError) {
            console.error(
              `[daily] histórico do item ${id} (${projectName}) falhou duas vezes — ` +
                `ele será classificado como não iniciado:`,
              retryError instanceof Error ? retryError.message : retryError,
              `(primeira falha: ${error instanceof Error ? error.message : error})`
            )
            failed.push(id)
            return { id, updates: [] as WorkItemUpdate[] }
          }
        }
      })
    )
    for (const { id, updates } of settled) updatesById.set(id, updates)
  }

  if (failed.length > 0) {
    console.error(
      `[daily] ${product.id}: ${failed.length} de ${ids.length} itens sem histórico ` +
        `(${failed.join(', ')}). O bloco desses itens está errado nesta carga.`
    )
  }

  // Uma busca de foto por pessoa, não por item — o cache do cliente cobre as
  // chamadas seguintes, inclusive entre produtos.
  const avatarByUrl = new Map<string, string | null>()
  const avatarUrls = new Set(
    [
      ...rawItems.map((item) => readAssignee(item.fields['System.AssignedTo'])?.avatarUrl),
      ...[...tasksByParent.values()].flat().map((task) => task.avatarUrl)
    ].filter((url): url is string => Boolean(url))
  )
  if (avatarUrls.size === 0 && rawItems.some((i) => i.fields['System.AssignedTo'])) {
    console.error('[avatar] o Azure não devolveu URL de foto no campo System.AssignedTo')
  }
  await Promise.all(
    [...avatarUrls].map(async (url) => avatarByUrl.set(url, await fetchAzureAvatar(url)))
  )

  const doneStates = devDoneStates(product)

  return rawItems.map((item) => {
    const updates = updatesById.get(item.id) ?? []
    const assigned = readAssignee(item.fields['System.AssignedTo'])
    const state = String(item.fields['System.State'] ?? '')
    const startedAt = findFirstEntry(updates, [profile.inProgressState])
    const testedAt = startedAt ? findFirstEntry(updates, doneStates) : null

    const storyPoints = toNullableNumber(item.fields[profile.estimateField])
    const estimateDays = storyPoints
      ? round1(spToHours(storyPoints, rulers.storyPoints) / rulers.productiveHoursPerDay)
      : null

    const status: DailyStatus = !startedAt ? 'not-started' : testedAt ? 'done' : 'in-progress'

    const startDay = startedAt ? dayOfSprint(days, new Date(startedAt)) : null
    const doneDay = testedAt ? dayOfSprint(days, new Date(testedAt)) : null

    // Arredonda para cima: dia começado é dia gasto — a tela fala em dias inteiros.
    const consumedDays = startedAt
      ? Math.max(
          1,
          Math.ceil(
            calcBusinessHours(startedAt, testedAt ?? now.toISOString(), rulers.calendar) /
              rulers.businessHoursPerDay
          )
        )
      : null

    // Iniciados projetam a partir do dia em que começaram; os não iniciados,
    // a partir de hoje — é o que revela o item que já não cabe. O caminho pula
    // feriados, então uma sprint com feriado empurra o término.
    const projectedEndDay =
      estimateDays === null
        ? null
        : projectEndDay(
            days,
            status === 'not-started' ? currentDay : (startDay ?? currentDay),
            Math.ceil(estimateDays)
          )

    // Processo sem estado de teste não tem o abrandamento: nada casa com `null`.
    const awaitingTest = profile.testingState !== null && state === profile.testingState

    return {
      id: item.id,
      title: String(item.fields['System.Title'] ?? ''),
      type: String(item.fields['System.WorkItemType'] ?? ''),
      state,
      storyPoints,
      assignee: assigned && {
        ...assigned.identity,
        avatar: assigned.avatarUrl ? (avatarByUrl.get(assigned.avatarUrl) ?? null) : null
      },
      product: product.id,
      tasks: (tasksByParent.get(item.id) ?? []).map(({ avatarUrl, ...task }) => ({
        ...task,
        assignee: task.assignee && {
          ...task.assignee,
          avatar: avatarUrl ? (avatarByUrl.get(avatarUrl) ?? null) : null
        }
      })),
      estimateDays,
      startDay,
      consumedDays,
      doneDay,
      projectedEndDay,
      // O Azure **omite o campo** em item que nunca voltou para retrabalho:
      // ausência é zero, não é erro. Sem o campo na Configuração também é zero —
      // e a tela, que não mostra zero, simplesmente não exibe retrabalho.
      reworkTimes: reworkField ? (toNullableNumber(item.fields[reworkField]) ?? 0) : 0,
      status,
      risk: classify(status, estimateDays, consumedDays, projectedEndDay, sprintDays, awaitingTest)
    }
  })
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** `now` existe para o teste fixar o relógio; o app sempre usa o momento da carga. */
export async function getDailyData(
  selectionId: string,
  sprint: UnifiedSprint,
  now: Date = new Date()
): Promise<DailyResult> {
  const config = requireActiveConfig()
  const rulers = dayRulers(config)
  const sprintStart = parseLocalDate(sprint.startDate)
  const sprintEnd = parseLocalDate(sprint.finishDate)
  sprintEnd.setHours(23, 59, 59, 999)

  const days = buildSprintCalendar(sprintStart, sprintEnd, rulers.calendar)
  // Sprint sem nenhum dia de semana não existe na prática, mas o resto do
  // cálculo indexa a régua e não pode receber lista vazia.
  if (days.length === 0) days.push({ date: sprintStart, holiday: false })

  const sprintDays = days.length
  const holidayDays = days.flatMap((d, i) => (d.holiday ? [i + 1] : []))
  const workingDays = sprintDays - holidayDays.length

  const currentDay = dayOfSprint(days, now < sprintStart ? sprintStart : now)
  // Restam dias de trabalho, não casas da régua: feriado à frente não conta.
  const remainingDays = days.filter((d, i) => i + 1 >= currentDay && !d.holiday).length

  const context: SprintContext = {
    days,
    currentDay,
    now,
    rulers,
    reworkField: config.customFields.reworkCount
  }
  const { products } = resolveScope(selectionId, config)

  const results = await Promise.all(
    products.map((product) => {
      const path = sprintIteration(sprint, product.id)?.path
      return path ? fetchDailyForProduct(product, path, context) : Promise.resolve([])
    })
  )

  // Maior complexidade no topo, em todos os blocos: o item grande é o que mais
  // ameaça a sprint, e precisa ser o primeiro a ser olhado. Sem story points vai
  // para o fim, e o ID desempata para a ordem não oscilar entre atualizações.
  const items = results.flat().sort((a, b) => {
    const sizeA = a.storyPoints ?? -1
    const sizeB = b.storyPoints ?? -1
    if (sizeA !== sizeB) return sizeB - sizeA
    return a.id - b.id
  })

  return {
    sprintDays,
    holidayDays,
    workingDays,
    weekBreakDay: weekBreakDay(days),
    currentDay,
    remainingDays,
    items,
    inProgressCount: items.filter((i) => i.status === 'in-progress').length
  }
}
