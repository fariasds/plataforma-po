import type { Calendar } from './calendar'

/** Segunda a sexta, feriado ou não. */
export function isWeekday(d: Date): boolean {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6
}

function hoursInDay(calendar: Calendar, day: Date, rangeStart: Date, rangeEnd: Date): number {
  let ms = 0
  for (const interval of calendar.workingIntervals(day)) {
    const from = Math.max(rangeStart.getTime(), interval.start.getTime())
    const to = Math.min(rangeEnd.getTime(), interval.end.getTime())
    if (to > from) ms += to - from
  }
  return ms / 3_600_000
}

/**
 * Calcula horas úteis entre dois instantes ISO: só o que cai dentro das faixas de
 * expediente do calendário, fora de fim de semana e feriado. Ver `RN-GLB-07`.
 */
export function calcBusinessHours(startIso: string, endIso: string, calendar: Calendar): number {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (start >= end) return 0

  let total = 0
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (cursor <= endDay) {
    total += hoursInDay(calendar, cursor, start, end)
    cursor.setDate(cursor.getDate() + 1)
  }

  return Math.round(total * 10) / 10 // 1 casa decimal
}
