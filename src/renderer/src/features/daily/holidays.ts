import type { UnifiedSprint } from '@shared/azure'
import { createCalendar } from '@shared/calendar'
import type { Configuration } from '@shared/config/schema'
import { buildSprintCalendar } from '@shared/sprint-calendar'

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Nome do feriado de cada casa da régua (1..N), para a tela dizer **qual** dia a
 * sprint perdeu (RN-DLY-17). Refaz a régua com o mesmo Calendário que o main usa:
 * a Configuração é a mesma dos dois lados, então as casas coincidem.
 */
export function holidayNamesOf(config: Configuration, sprint: UnifiedSprint): Map<number, string> {
  const calendar = createCalendar(config.calendar)
  const end = parseLocalDate(sprint.finishDate)
  end.setHours(23, 59, 59, 999)
  const names = new Map<number, string>()
  buildSprintCalendar(parseLocalDate(sprint.startDate), end, calendar).forEach((day, i) => {
    const name = calendar.holidayName(day.date)
    if (name) names.set(i + 1, name)
  })
  return names
}
