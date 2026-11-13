import type { WorkItem } from './azure'

/**
 * Results the main process hands to the renderer, one shape per dashboard.
 * The renderer never sees raw Azure responses — only these.
 */

// --- Sprint Delivery ------------------------------------------------------

export interface DeliveredItem {
  workItem: WorkItem
  closedAt: string
  leadTimeHours: number
  devTimeInSprintHours: number
}

export interface SprintDeliveryResult {
  deliveredItems: DeliveredItem[]
  totalInSprint: number
  scopeInjectedCount: number
  typeDistribution: { name: string; value: number }[]
  typeDistributionInSprint: { name: string; value: number }[]
}

// --- Bug Analysis ---------------------------------------------------------

export interface BugItem {
  id: number
  /** Produto de onde o bug veio; dá o Perfil de processo que o mede. */
  productId: string
  title: string
  state: string
  criticality: string
  createdDate: string
  closedDate?: string
  dueDate?: string
  /** Sprint em que o bug foi CRIADO (base do histórico) */
  sprintKey: string
  sprintLabel: string
  sprintName: string
  monthKey: string
  monthLabel: string
  /** Sprint em que o bug foi FECHADO (pode ser diferente da de criação) */
  closedSprintKey?: string
  isRecurrent: boolean
}

export interface SprintBugStats {
  sprintKey: string
  sprintLabel: string
  sprintName: string
  startDate: string
  finishDate: string
  total: number
  recurrentCount: number
  recurrenceRate: number
}

export interface MonthBugStats {
  monthKey: string
  monthLabel: string
  total: number
  recurrentCount: number
  recurrenceRate: number
}

export interface BugAnalysisResult {
  /** Ordered oldest → newest (for the historical bar+line chart — sprint view) */
  sprintStats: SprintBugStats[]
  /** Ordered oldest → newest (for the historical bar+line chart — month view) */
  monthStats: MonthBugStats[]
  /** Bug count by criticality for the selected sprint */
  criticalityBreakdown: { name: string; value: number }[]
  /** Active bugs grouped by State (for the donut chart) */
  activeBugsByState: { name: string; value: number }[]
  activeBugsCount: number
  allBugs: BugItem[]
  /** Full details of all currently active bugs — used to enrich the sprint view list */
  activeBugItems: BugItem[]
  /**
   * Estados do bug na ordem do fluxo: o `bugStateOrder` dos Perfis de processo do
   * escopo, sem repetir. Dá a cor de cada estado pela posição (RN-BUG-13).
   */
  stateOrder: BugStateName[]
  /** `false` sem `customFields.criticality` configurado (RN-BUG-05). */
  criticalityConfigured: boolean
  /** `false` sem `recurrentBugTag` configurado (RN-BUG-06). */
  recurrenceConfigured: boolean
}

// --- Team Performance: rework --------------------------------------------

export interface ReworkBreakdownEntry {
  times: number
  count: number
}

export interface ReworkSlot {
  key: string
  label: string
  fullLabel: string
  total: number
  reworkCount: number
  reworkRate: number | null
  breakdown: ReworkBreakdownEntry[]
}

// --- Team Performance: dev focus -----------------------------------------

export interface DevFocusSlot {
  key: string
  label: string
  fullLabel: string
  devFocusPercent: number | null
  totalHours: number
  devHours: number
}

// --- Team Performance: time per bug state --------------------------------

/**
 * Estado de bug, como o Azure devolve. A ordem do fluxo vem do `bugStateOrder`
 * do Perfil de processo, junto com o resultado (`BugAnalysisResult.stateOrder`).
 */
export type BugStateName = string

/** Nome de um nível de `criticality[]` da Configuração. */
export type CriticalityKey = string

export interface CritSlotData {
  states: Partial<Record<BugStateName, number>>
  bugCount: number
}

export interface BugStateSlot {
  key: string
  label: string
  fullLabel: string
  /** Overall average (all criticalities) */
  states: Partial<Record<BugStateName, number>>
  bugCount: number
  /** Breakdown by criticality level name (`criticality[]` da Configuração) */
  byCategory: Record<CriticalityKey, CritSlotData>
}

// --- Team Performance: SLA ------------------------------------------------

/** Bugs com prazo de um nível de criticidade, num período. */
export interface SlaLevelStat {
  /** % dentro do prazo; `null` quando o nível não teve bug no período. */
  percent: number | null
  within: number
  total: number
}

export interface SlaSlot {
  key: string
  label: string
  fullLabel: string
  /** Pelo nome do nível, na ordem de `TeamPerformanceResult.criticalityLevels`. */
  levels: Record<string, SlaLevelStat>
}

/** Nível de criticidade da Configuração, do mais para o menos grave. */
export interface CriticalityLevelInfo {
  name: string
  /** Cor escolhida na Configuração; sem ela, a tela usa a cor da posição. */
  color: string | null
}

/** Everything the Team Performance screen needs, in one round trip. */
export interface TeamPerformanceResult {
  /** Vazio quando a Configuração não define criticidade: o SLA não é medido. */
  criticalityLevels: CriticalityLevelInfo[]
  /** Estados do bug na ordem do fluxo, do Perfil de processo do escopo. */
  bugStateOrder: string[]
  /**
   * Campo da Configuração que falta para medir o retrabalho. Com ele, as listas
   * de rework vêm vazias e a tela diz o que configurar — nunca zero.
   */
  reworkUnavailable: 'customFields.reworkCount' | null
  slaSprintStats: SlaSlot[]
  slaMonthStats: SlaSlot[]
  reworkSprintSlots: ReworkSlot[]
  reworkMonthSlots: ReworkSlot[]
  bugStateSprintSlots: BugStateSlot[]
  bugStateMonthSlots: BugStateSlot[]
  devFocusSprintSlots: DevFocusSlot[]
  devFocusMonthSlots: DevFocusSlot[]
  /**
   * Charts that failed without taking the screen down — the two heaviest
   * services fetch per-item history and are allowed to fail on their own.
   */
  partialFailures: string[]
}

// --- Daily ----------------------------------------------------------------

/** Em qual dos três blocos o item aparece. */
export type DailyStatus = 'not-started' | 'in-progress' | 'done'

/**
 * Situação do item frente à estimativa e à janela da sprint.
 * `over-estimate` tem precedência sobre `over-sprint`: constatação vale mais
 * que projeção.
 */
export type DailyRisk =
  /** Dentro da estimativa e termina antes do fim da sprint. */
  | 'on-track'
  /** Termina exatamente no último dia — sem margem. */
  | 'at-limit'
  /** A projeção passa do fim da sprint. */
  | 'over-sprint'
  /**
   * A projeção passa do fim da sprint, mas o item está no `testingState` do
   * Perfil de processo: o desenvolvimento acabou e só falta validar (RN-DLY-19).
   * Não existe em processo sem estado de teste.
   */
  | 'awaiting-test'
  /** Já consumiu mais dias do que o estimado. */
  | 'over-estimate'
  /** Item sem estimativa — não há o que comparar. */
  | 'unknown'

/** Pessoa responsável pelo item. */
export interface DailyAssignee {
  displayName: string
  uniqueName: string
  /** Foto já embutida como data URI, ou `null` quando não foi possível obtê-la. */
  avatar: string | null
}

/** Task filha de um item, como aparece no card do Azure DevOps. */
export interface DailyTask {
  id: number
  title: string
  state: string
  done: boolean
  assignee: DailyAssignee | null
}

export interface DailyItem {
  id: number
  title: string
  type: string
  state: string
  storyPoints: number | null
  /** ID do Produto de origem — identifica o item quando a seleção é um Grupo. */
  product: string
  assignee: DailyAssignee | null
  tasks: DailyTask[]
  /** Estimativa convertida em dias de trabalho (horas da tabela ÷ horas produtivas por dia). */
  estimateDays: number | null
  /** Dia da sprint (1..N) em que entrou no `inProgressState`. */
  startDay: number | null
  /** Dias úteis decorridos entre o início e o fim do desenvolvimento (ou agora). */
  consumedDays: number | null
  /** Dia da sprint em que o desenvolvimento terminou (RN-DLY-14). */
  doneDay: number | null
  /**
   * Dia da régua em que a estimativa diz que termina, já pulando feriados. Pode
   * passar do fim da sprint — é assim que o excedente é medido.
   */
  projectedEndDay: number | null
  /** Vezes que o item voltou para retrabalho (`customFields.reworkCount`); 0 sem o campo. */
  reworkTimes: number
  status: DailyStatus
  risk: DailyRisk
}

export interface DailyResult {
  /**
   * Casas da régua: os dias de semana da janela da sprint, feriado incluído.
   * Normalmente 10. Feriado ocupa casa, mas não entrega trabalho — a capacidade
   * real é `workingDays`.
   */
  sprintDays: number
  /** Casas da régua que caem em feriado (1..sprintDays). */
  holidayDays: number[]
  /** Dias que de fato produzem: `sprintDays` menos os feriados. */
  workingDays: number
  /**
   * Última casa da primeira semana — onde a régua desenha a divisão do fim de
   * semana. Feriado não a desloca, porque continua ocupando casa.
   */
  weekBreakDay: number
  /** Dia atual dentro da sprint (1..N). */
  currentDay: number
  /** Dias de trabalho que ainda restam, contando hoje e descontando feriados. */
  remainingDays: number
  items: DailyItem[]
  /** Quantos itens estão em andamento ao mesmo tempo. */
  inProgressCount: number
}

// --- Planning -------------------------------------------------------------

export interface PlanningItem {
  id: number
  title: string
  state: string
  /** ID do Produto de origem. */
  product: string
  frontend: number | null
  backend: number | null
  qa: number | null
  /** Story Points do Azure DevOps (Microsoft.VSTS.Scheduling.StoryPoints). */
  total: number | null
  /** Prioridade do Azure DevOps (Microsoft.VSTS.Common.Priority), de 1 a 4. */
  priority: number | null
}

export interface PlanningResult {
  items: PlanningItem[]
  totals: {
    frontend: number
    backend: number
    qa: number
    geral: number
  }
}

/** A single work item looked up by ID, before any percentage is applied. */
export interface PlanningLookupItem {
  id: number
  title: string
  state: string
  /** ID do Produto de origem. */
  product: string
  frontend: number | null
  backend: number | null
  qa: number | null
  priority: number | null
}

/** Item adicionado manualmente pelo PO (remanescente de sprint anterior). */
export interface ManualPlanningItem extends PlanningItem {
  /** Percentual aplicado ao frontend original (0 | 25 | 50 | 75 | 100). */
  frontendPercent: number
  /** Percentual aplicado ao backend original (0 | 25 | 50 | 75 | 100). */
  backendPercent: number
}
