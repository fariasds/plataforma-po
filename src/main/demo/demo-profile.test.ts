import { describe, expect, it } from 'vitest'
import { DEMO_SCENARIO_ID, demoAzure, demoScenario, shiftDate, shiftWeeks } from './demo-profile'

// RN-GLB-16: na demonstração, as datas andam em semanas inteiras até a semana da
// data de referência ser a de hoje.

describe('RN-GLB-16: datas da demonstração', () => {
  it('conta semanas entre as segundas-feiras, qualquer que seja o dia', () => {
    // 09/11/2026 é segunda; 12/11, quinta da mesma semana.
    expect(shiftWeeks('2026-11-09T09:00:00', new Date(2026, 10, 12, 15))).toBe(0)
    expect(shiftWeeks('2026-11-09T09:00:00', new Date(2026, 10, 15, 23))).toBe(0)
    expect(shiftWeeks('2026-11-09T09:00:00', new Date(2026, 10, 16, 0, 5))).toBe(1)
    expect(shiftWeeks('2026-11-09T09:00:00', new Date(2027, 2, 3))).toBe(16)
    expect(shiftWeeks('2026-11-09T09:00:00', new Date(2026, 9, 30))).toBe(-2)
  })

  it('desloca a data e preserva hora, fuso e dia da semana', () => {
    expect(shiftDate('2026-11-09T09:00:00', 14)).toBe('2026-11-23T09:00:00')
    expect(shiftDate('2026-12-28T00:00:00Z', 7)).toBe('2027-01-04T00:00:00Z')
    expect(shiftDate('2026-11-09', -7)).toBe('2026-11-02')
    const weekday = (iso: string): number => new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()
    expect(weekday(shiftDate('2026-11-13T17:00:00', 7 * 23))).toBe(weekday('2026-11-13'))
  })

  it('não mexe no que não é data', () => {
    expect(shiftDate('9999-01-01T00:00:00Z', 7)).toBe('9999-01-01T00:00:00Z')
    expect(shiftDate('Contoso\\Loja\\Sprint 6', 7)).toBe('Contoso\\Loja\\Sprint 6')
    expect(shiftDate('Erro ao finalizar compra (2026-11-09)', 7)).toBe(
      'Erro ao finalizar compra (2026-11-09)'
    )
  })

  it('a sprint corrente do Cenário vira a da semana de hoje', async () => {
    const today = new Date(2027, 5, 16, 10) // uma quarta-feira qualquer
    const azure = demoAzure(DEMO_SCENARIO_ID, today)
    const scenario = demoScenario(DEMO_SCENARIO_ID)
    const project = scenario.azure.projects[0]
    const tree = await azure.fetchAzure<{ children?: { attributes?: { startDate: string } }[] }>(
      `/${project.name}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.1`
    )
    const starts = JSON.stringify(tree).match(/"startDate":"(\d{4}-\d{2}-\d{2})/g) ?? []
    // A segunda da semana de hoje é o início da segunda semana da sprint corrente.
    expect(starts.map((s) => s.slice(-10))).toContain('2027-06-07')
    expect(azure.errors).toEqual([])
  })
})
