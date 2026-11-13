import { describe, expect, it } from 'vitest'
import { createCalendar } from './calendar'
import { dayPeriod, firstStepsState, sprintMoment, stepForPath } from './home'

const calendar = createCalendar({
  country: 'BR',
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' }
  ]
})

// Duas semanas sem feriado nacional: 10 casas, de segunda 21/09 a sexta 02/10.
const SPRINT = { startDate: '2026-09-21T00:00:00Z', finishDate: '2026-10-02T00:00:00Z' }
const at = (y: number, m: number, d: number, h = 10): Date => new Date(y, m - 1, d, h)

describe('sprintMoment (RN-HOM-02)', () => {
  it('sem sprint, sugere o Planning e não inventa dia', () => {
    expect(sprintMoment(undefined, calendar, at(2026, 9, 22))).toEqual({
      phase: 'planning',
      day: null,
      totalDays: null
    })
  })

  it('antes de começar é Planning', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 9, 18))).toEqual({
      phase: 'planning',
      day: null,
      totalDays: 10
    })
  })

  it('o primeiro dia ainda é Planning', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 9, 21)).phase).toBe('planning')
  })

  it('do segundo ao antepenúltimo dia é Daily', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 9, 22))).toMatchObject({
      phase: 'daily',
      day: 2
    })
    expect(sprintMoment(SPRINT, calendar, at(2026, 9, 30))).toMatchObject({
      phase: 'daily',
      day: 8
    })
  })

  it('os dois últimos dias já são Review', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 10, 1))).toMatchObject({
      phase: 'review',
      day: 9
    })
    expect(sprintMoment(SPRINT, calendar, at(2026, 10, 2, 17))).toMatchObject({
      phase: 'review',
      day: 10
    })
  })

  it('no fim de semana, conta a próxima casa, como a Daily', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 9, 26))).toMatchObject({
      phase: 'daily',
      day: 6
    })
  })

  it('depois do fim, sem a próxima ter começado, é Review sem dia', () => {
    expect(sprintMoment(SPRINT, calendar, at(2026, 10, 3))).toEqual({
      phase: 'review',
      day: null,
      totalDays: 10
    })
  })

  it('feriado ocupa casa: a contagem bate com a da Daily', () => {
    // 12/10 é feriado nacional numa segunda; a sprint continua com 10 casas.
    const sprint = { startDate: '2026-10-05T00:00:00Z', finishDate: '2026-10-16T00:00:00Z' }
    expect(sprintMoment(sprint, calendar, at(2026, 10, 13))).toEqual({
      phase: 'daily',
      day: 7,
      totalDays: 10
    })
  })

  it('sprint curta de dois dias: um de Planning e um de Review', () => {
    const sprint = { startDate: '2026-09-21T00:00:00Z', finishDate: '2026-09-22T00:00:00Z' }
    expect(sprintMoment(sprint, calendar, at(2026, 9, 21)).phase).toBe('planning')
    expect(sprintMoment(sprint, calendar, at(2026, 9, 22)).phase).toBe('review')
  })
})

describe('firstStepsState (RN-HOM-03)', () => {
  it('no primeiro acesso, só a conexão está feita e a lista aparece', () => {
    const state = firstStepsState({ visited: [] })
    expect(state.doneCount).toBe(1)
    expect(state.done).toEqual({ connect: true, planning: false, daily: false, review: false })
    expect(state.view).toBe('first-access')
  })

  it('abrir a tela conclui o passo', () => {
    const state = firstStepsState({ visited: ['planning', 'review'] })
    expect(state.doneCount).toBe(3)
    expect(state.view).toBe('first-access')
  })

  it('com os quatro feitos, a Home passa a ser a recorrente', () => {
    expect(firstStepsState({ visited: ['planning', 'daily', 'review'] }).view).toBe('recurring')
  })

  it('esconder a lista vale mesmo com passo pendente', () => {
    expect(firstStepsState({ visited: [], showList: false }).view).toBe('recurring')
  })

  it('pedir para rever mostra a lista mesmo com tudo feito', () => {
    expect(firstStepsState({ visited: ['planning', 'daily', 'review'], showList: true }).view).toBe(
      'first-access'
    )
  })
})

describe('stepForPath', () => {
  it('liga cada tela ao seu passo', () => {
    expect(stepForPath('/planning')).toBe('planning')
    expect(stepForPath('/daily')).toBe('daily')
    expect(stepForPath('/dashboard/sprint-delivery')).toBe('review')
    expect(stepForPath('/dashboard/bug-analysis')).toBe('review')
    expect(stepForPath('/home')).toBeNull()
    expect(stepForPath('/configuracao')).toBeNull()
  })
})

describe('dayPeriod', () => {
  it('manhã, tarde e noite', () => {
    expect(dayPeriod(at(2026, 9, 21, 8))).toBe('morning')
    expect(dayPeriod(at(2026, 9, 21, 12))).toBe('afternoon')
    expect(dayPeriod(at(2026, 9, 21, 19))).toBe('evening')
    expect(dayPeriod(at(2026, 9, 21, 2))).toBe('evening')
  })
})
