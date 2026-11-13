import type { Calendar } from './calendar'
import { buildSprintCalendar, dayOfSprint } from './sprint-calendar'

/**
 * Lógica da Home sem tela: em que momento da sprint o PO está e qual dos dois
 * estados da Home ele vê. Pura de propósito — a regressão roda a mesma função em
 * cada Cenário, e o renderer só desenha o resultado.
 */

/** Os três momentos do ciclo, na ordem em que acontecem. */
export type SprintPhase = 'planning' | 'daily' | 'review'

export interface SprintMoment {
  phase: SprintPhase
  /**
   * Casa da régua (1..N), a mesma que a Daily mostra (`RN-DLY-17`). `null` fora
   * da janela da sprint: antes de começar ou depois de terminar não há "dia N".
   */
  day: number | null
  /** Casas da régua, feriado incluído. `null` sem sprint. */
  totalDays: number | null
}

/** Quantas casas, no fim da sprint, já são momento de Review (`RN-HOM-02`). */
const REVIEW_TAIL_DAYS = 2

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Em que momento da sprint corrente o PO está (`RN-HOM-02`). A sprint é a que a
 * Daily usa: a corrente ou, entre duas sprints, a que acabou de terminar.
 */
export function sprintMoment(
  sprint: { startDate: string; finishDate: string } | undefined,
  calendar: Calendar,
  now: Date
): SprintMoment {
  if (!sprint) return { phase: 'planning', day: null, totalDays: null }

  const start = parseLocalDate(sprint.startDate)
  const end = parseLocalDate(sprint.finishDate)
  end.setHours(23, 59, 59, 999)
  const days = buildSprintCalendar(start, end, calendar)
  const totalDays = days.length

  if (now < start) return { phase: 'planning', day: null, totalDays }
  // Terminou e a próxima ainda não começou: é hora de olhar o que foi entregue.
  if (now > end || totalDays === 0) return { phase: 'review', day: null, totalDays }

  const day = dayOfSprint(days, now)
  if (day === 1) return { phase: 'planning', day, totalDays }
  if (day > totalDays - REVIEW_TAIL_DAYS) return { phase: 'review', day, totalDays }
  return { phase: 'daily', day, totalDays }
}

// ─── Primeiros passos ────────────────────────────────────────────────────────

/** Os quatro passos do primeiro acesso, na ordem da lista (`RN-HOM-03`). */
export const FIRST_STEPS = ['connect', 'planning', 'daily', 'review'] as const
export type FirstStep = (typeof FIRST_STEPS)[number]

/** O que a Home guarda nesta máquina, por Perfil. */
export interface FirstStepsMemory {
  /** Telas que o PO já abriu, entre as dos passos. */
  visited: FirstStep[]
  /**
   * Escolha explícita do PO: `false` escondeu a lista, `true` pediu para revê-la.
   * Sem escolha, a lista aparece até os quatro passos estarem feitos.
   */
  showList?: boolean
}

export interface FirstStepsState {
  done: Record<FirstStep, boolean>
  doneCount: number
  /** `first-access` é o quadro B (lista de passos); `recurring`, o quadro A. */
  view: 'first-access' | 'recurring'
}

export function firstStepsState(memory: FirstStepsMemory): FirstStepsState {
  // Quem chega à Home já passou pelo assistente: o primeiro passo está feito.
  const done = Object.fromEntries(
    FIRST_STEPS.map((step) => [step, step === 'connect' || memory.visited.includes(step)])
  ) as Record<FirstStep, boolean>
  const doneCount = FIRST_STEPS.filter((step) => done[step]).length
  const showList = memory.showList ?? doneCount < FIRST_STEPS.length
  return { done, doneCount, view: showList ? 'first-access' : 'recurring' }
}

/** Qual passo uma rota conclui. Toda tela da Review conta para o passo dela. */
export function stepForPath(pathname: string): FirstStep | null {
  if (pathname.startsWith('/planning')) return 'planning'
  if (pathname.startsWith('/daily')) return 'daily'
  if (pathname.startsWith('/dashboard')) return 'review'
  return null
}

// ─── Saudação ────────────────────────────────────────────────────────────────

export type DayPeriod = 'morning' | 'afternoon' | 'evening'

export function dayPeriod(now: Date): DayPeriod {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}
