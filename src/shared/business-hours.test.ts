import { describe, expect, it } from 'vitest'
import { calcBusinessHours, isWeekday } from './business-hours'
import { createCalendar } from './calendar'

// Datas sem fuso são lidas no horário local, como o código faz.
const calendar = createCalendar({
  country: 'BR',
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' }
  ]
})

describe('calcBusinessHours', () => {
  it('conta manhã e tarde de um dia útil, sem o almoço', () => {
    expect(calcBusinessHours('2026-09-21T09:00:00', '2026-09-21T16:00:00', calendar)).toBe(6)
  })

  it('desconta o almoço quando o intervalo o cruza', () => {
    expect(calcBusinessHours('2026-09-21T11:30:00', '2026-09-21T13:30:00', calendar)).toBe(1)
  })

  it('limita o dia inteiro ao expediente de 8 horas', () => {
    expect(calcBusinessHours('2026-09-21T00:00:00', '2026-09-21T23:59:00', calendar)).toBe(8)
  })

  it('pula o fim de semana', () => {
    // sexta 16:00 → segunda 09:00
    expect(calcBusinessHours('2026-09-25T16:00:00', '2026-09-28T09:00:00', calendar)).toBe(2)
  })

  it('pula feriado de 2026 que cai em dia útil', () => {
    // sexta 04/09 16:00 → terça 08/09 09:00; segunda 07/09 é feriado
    expect(calcBusinessHours('2026-09-04T16:00:00', '2026-09-08T09:00:00', calendar)).toBe(2)
  })

  it('arredonda para uma casa decimal', () => {
    expect(calcBusinessHours('2026-09-21T09:00:00', '2026-09-21T09:04:00', calendar)).toBe(0.1)
  })

  it('devolve zero para intervalo vazio ou invertido', () => {
    expect(calcBusinessHours('2026-09-21T10:00:00', '2026-09-21T10:00:00', calendar)).toBe(0)
    expect(calcBusinessHours('2026-09-21T12:00:00', '2026-09-21T10:00:00', calendar)).toBe(0)
  })

  it('pula feriado de 2027, que a lista fixa não conhecia', () => {
    // segunda 19/04 16:00 → quinta 22/04 09:00; quarta 21/04 é Tiradentes
    expect(calcBusinessHours('2027-04-19T16:00:00', '2027-04-22T09:00:00', calendar)).toBe(10)
  })

  it('devolve zero fora do expediente', () => {
    expect(calcBusinessHours('2026-09-21T18:00:00', '2026-09-21T22:00:00', calendar)).toBe(0)
  })
})

describe('isWeekday', () => {
  it('separa dia de semana de fim de semana, feriado ou não', () => {
    expect(isWeekday(new Date(2026, 8, 7))).toBe(true)
    expect(isWeekday(new Date(2026, 8, 26))).toBe(false)
    expect(isWeekday(new Date(2026, 8, 27))).toBe(false)
  })
})
