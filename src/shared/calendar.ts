/**
 * Calendário de trabalho: que dia é feriado e em que faixas do dia se trabalha.
 * Montado a partir do `calendar` da Configuração. Ver `RN-GLB-07`.
 *
 * Tudo em horário local, como as datas do Azure são lidas no resto do app.
 */

export type ExtraHoliday = { date: string; name: string } | { monthDay: string; name: string }

export interface WorkingRange {
  /** "HH:MM" */
  start: string
  /** "HH:MM" */
  end: string
}

export interface CalendarSettings {
  /** País com feriados nacionais calculados aqui. Sem ele, só valem os extras. */
  country?: 'BR'
  extraHolidays?: readonly ExtraHoliday[]
  workingHours: readonly WorkingRange[]
}

export interface WorkingInterval {
  start: Date
  end: Date
}

export interface Calendar {
  isHoliday(date: Date): boolean
  /** Nome do feriado, ou `null` se o dia não é feriado. */
  holidayName(date: Date): string | null
  /** Faixas de expediente do dia. Vazio em fim de semana e feriado. */
  workingIntervals(date: Date): WorkingInterval[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function monthDayKey(d: Date): string {
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${monthDayKey(d)}`
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const BR_FIXED: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia Nacional de Zumbi e da Consciência Negra',
  '12-25': 'Natal'
}

// Carnaval e Corpus Christi são ponto facultativo federal, não feriado de lei.
// Entram mesmo assim porque quase todo expediente no país para nesses dias, e
// datas móveis não cabem em `extraHolidays` (só aceita data única ou dia fixo).
const BR_MOVABLE: ReadonlyArray<[offsetFromEaster: number, name: string]> = [
  [-48, 'Carnaval'],
  [-47, 'Carnaval'],
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi']
]

function brazilianHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>()
  for (const [monthDay, name] of Object.entries(BR_FIXED)) {
    holidays.set(`${year}-${monthDay}`, name)
  }
  const easter = easterSunday(year)
  for (const [offset, name] of BR_MOVABLE) {
    const d = new Date(easter)
    d.setDate(d.getDate() + offset)
    holidays.set(dateKey(d), name)
  }
  return holidays
}

function parseTime(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number)
  return [h, m]
}

export function createCalendar(settings: CalendarSettings): Calendar {
  const singleDates = new Map<string, string>()
  const recurring = new Map<string, string>()
  for (const holiday of settings.extraHolidays ?? []) {
    if ('date' in holiday) singleDates.set(holiday.date, holiday.name)
    else recurring.set(holiday.monthDay, holiday.name)
  }

  // Os nacionais dependem do ano; calcula uma vez por ano consultado.
  const nationalByYear = new Map<number, Map<string, string>>()
  const national = (year: number): Map<string, string> | undefined => {
    if (settings.country !== 'BR') return undefined
    let holidays = nationalByYear.get(year)
    if (!holidays) {
      holidays = brazilianHolidays(year)
      nationalByYear.set(year, holidays)
    }
    return holidays
  }

  const ranges = settings.workingHours.map((r) => ({
    start: parseTime(r.start),
    end: parseTime(r.end)
  }))

  function holidayName(date: Date): string | null {
    const key = dateKey(date)
    return (
      national(date.getFullYear())?.get(key) ??
      singleDates.get(key) ??
      recurring.get(monthDayKey(date)) ??
      null
    )
  }

  return {
    holidayName,
    isHoliday: (date) => holidayName(date) !== null,
    workingIntervals(date) {
      const dow = date.getDay()
      if (dow === 0 || dow === 6 || holidayName(date) !== null) return []
      const at = ([h, m]: [number, number]): Date =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
      return ranges.map((r) => ({ start: at(r.start), end: at(r.end) }))
    }
  }
}
