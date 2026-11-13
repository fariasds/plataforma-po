import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { calcBusinessHours } from './business-hours'
import { createCalendar, easterSunday, type CalendarSettings } from './calendar'
import reference from './__fixtures__/business-hours-2025-2026.json'

const d = (iso: string): Date => {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

const EXPEDIENTE = [
  { start: '08:00', end: '12:00' },
  { start: '13:00', end: '17:00' }
]

describe('easterSunday', () => {
  it('acerta a Páscoa de anos conhecidos', () => {
    expect(easterSunday(2024)).toEqual(new Date(2024, 2, 31))
    expect(easterSunday(2025)).toEqual(new Date(2025, 3, 20))
    expect(easterSunday(2026)).toEqual(new Date(2026, 3, 5))
    expect(easterSunday(2027)).toEqual(new Date(2027, 2, 28))
    expect(easterSunday(2038)).toEqual(new Date(2038, 3, 25))
  })
})

describe('createCalendar — feriados do BR', () => {
  const br = createCalendar({ country: 'BR', workingHours: EXPEDIENTE })

  it('reconhece feriado nacional depois de 2026, sem manutenção', () => {
    expect(br.isHoliday(d('2027-04-21'))).toBe(true)
    expect(br.holidayName(d('2027-04-21'))).toBe('Tiradentes')
    expect(br.isHoliday(d('2031-12-25'))).toBe(true)
  })

  it('calcula os feriados móveis a partir da Páscoa', () => {
    // Páscoa de 2027: 28/03
    expect(br.holidayName(d('2027-02-08'))).toBe('Carnaval')
    expect(br.holidayName(d('2027-02-09'))).toBe('Carnaval')
    expect(br.holidayName(d('2027-03-26'))).toBe('Sexta-feira Santa')
    expect(br.holidayName(d('2027-05-27'))).toBe('Corpus Christi')
    expect(br.isHoliday(d('2027-02-10'))).toBe(false) // Quarta de Cinzas
  })

  it('dia comum não é feriado', () => {
    expect(br.isHoliday(d('2027-04-22'))).toBe(false)
    expect(br.holidayName(d('2027-04-22'))).toBeNull()
  })

  it('sem país, não há feriado nacional', () => {
    const none = createCalendar({ workingHours: EXPEDIENTE })
    expect(none.isHoliday(d('2027-04-21'))).toBe(false)
  })
})

describe('createCalendar — feriados extras', () => {
  const cal = createCalendar({
    extraHolidays: [
      { monthDay: '08-12', name: 'Feriado municipal' },
      { date: '2026-11-20', name: 'Emenda' }
    ],
    workingHours: EXPEDIENTE
  })

  it('o recorrente vale em qualquer ano', () => {
    expect(cal.holidayName(d('2026-08-12'))).toBe('Feriado municipal')
    expect(cal.holidayName(d('2031-08-12'))).toBe('Feriado municipal')
  })

  it('o de data única vale só naquele dia', () => {
    expect(cal.holidayName(d('2026-11-20'))).toBe('Emenda')
    expect(cal.isHoliday(d('2027-11-20'))).toBe(false)
  })
})

describe('createCalendar — expediente', () => {
  const cal = createCalendar({ country: 'BR', workingHours: EXPEDIENTE })

  it('devolve as faixas do dia útil', () => {
    const intervals = cal.workingIntervals(d('2026-09-21'))
    expect(intervals).toEqual([
      { start: new Date(2026, 8, 21, 8, 0), end: new Date(2026, 8, 21, 12, 0) },
      { start: new Date(2026, 8, 21, 13, 0), end: new Date(2026, 8, 21, 17, 0) }
    ])
  })

  it('fim de semana e feriado não têm expediente', () => {
    expect(cal.workingIntervals(d('2026-09-26'))).toEqual([])
    expect(cal.workingIntervals(d('2026-09-07'))).toEqual([])
  })

  it('respeita faixas com minutos', () => {
    const custom = createCalendar({ workingHours: [{ start: '09:30', end: '18:15' }] })
    expect(calcBusinessHours('2026-09-21T00:00:00', '2026-09-21T23:00:00', custom)).toBe(8.8)
  })
})

// Equivalência com a lista fixa anterior à T-14: a Configuração real, que mora
// em perfis-privados/ e não vai para o repositório público, precisa reproduzir
// as horas úteis e os feriados de 2025–2026 calculados pelo código antigo.
const privateConfigs = existsSync('perfis-privados')
  ? readdirSync('perfis-privados').filter((name) => name.endsWith('.json'))
  : []

describe.runIf(privateConfigs.length > 0)('equivalência com a lista fixa de 2025–2026', () => {
  for (const name of privateConfigs) {
    const config = JSON.parse(readFileSync(resolve('perfis-privados', name), 'utf8')) as {
      calendar: CalendarSettings
    }
    const calendar = createCalendar(config.calendar)

    it(`${name}: os 40 intervalos dão as mesmas horas úteis`, () => {
      const actual = reference.intervals.map((i) => ({
        ...i,
        hours: calcBusinessHours(i.start, i.end, calendar)
      }))
      expect(actual).toEqual(reference.intervals)
    })

    it(`${name}: os feriados de 2025–2026 são os mesmos`, () => {
      const holidays: string[] = []
      for (
        let day = new Date(2025, 0, 1);
        day.getFullYear() < 2027;
        day.setDate(day.getDate() + 1)
      ) {
        if (calendar.isHoliday(day)) {
          holidays.push(
            `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
          )
        }
      }
      expect(holidays).toEqual(reference.holidays)
    })
  }
})
