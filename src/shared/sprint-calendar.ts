import { isWeekday } from './business-hours'
import type { Calendar } from './calendar'

/**
 * A régua da sprint: uma casa por dia de semana da janela, feriado incluído.
 *
 * Feriado **ocupa casa e não entrega trabalho**. Manter a casa é o que permite
 * marcá-la na tela e o que faz a projeção empurrar o término — se o feriado
 * simplesmente sumisse da régua, a sprint pareceria ter um dia a menos e ninguém
 * veria o dia perdido. Ver `RN-DLY-17`.
 */
export interface SprintDay {
  date: Date
  holiday: boolean
}

export function buildSprintCalendar(
  sprintStart: Date,
  sprintEnd: Date,
  calendar: Calendar
): SprintDay[] {
  const days: SprintDay[] = []
  const cursor = new Date(sprintStart)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= sprintEnd) {
    if (isWeekday(cursor)) {
      days.push({ date: new Date(cursor), holiday: calendar.isHoliday(cursor) })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

/** Em que casa da régua (1..N) uma data cai. Fora da janela, encosta na borda. */
export function dayOfSprint(days: SprintDay[], at: Date): number {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate())

  for (let i = 0; i < days.length; i++) {
    if (days[i].date >= day) return i + 1
  }
  return days.length
}

/**
 * Onde a régua marca a virada de semana: a última casa que ainda cai na semana
 * de início. Feriado não desloca essa marca — a casa continua lá.
 */
export function weekBreakDay(days: SprintDay[]): number {
  const first = days[0].date
  // Domingo que encerra a semana de início.
  const endOfWeek = new Date(first)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))

  const count = days.filter((d) => d.date < endOfWeek).length
  return Math.min(Math.max(count, 1), days.length)
}

/**
 * Caminha a régua a partir de `startDay` até consumir `workDays` dias de
 * trabalho, **pulando feriados**. O resultado pode passar do fim da sprint — e é
 * justamente esse excedente que a tela reporta (`RN-DLY-08`).
 *
 * Depois do fim da sprint não há calendário conhecido, então os dias seguintes
 * são contados como úteis. Superestimar a capacidade futura é o erro menos
 * grave: no máximo o excedente reportado fica um pouco menor que o real.
 */
export function projectEndDay(days: SprintDay[], startDay: number, workDays: number): number {
  let remaining = Math.max(1, workDays)
  let position = Math.max(1, startDay)

  // O teto existe só para nunca haver laço infinito num dado inesperado.
  const ceiling = position + remaining + days.length + 1

  while (position < ceiling) {
    const holiday = position <= days.length && days[position - 1].holiday
    if (!holiday) {
      remaining--
      if (remaining === 0) return position
    }
    position++
  }

  return position
}
