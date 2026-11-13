import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint, WorkItemUpdate } from '@shared/azure'
import { createCalendar } from '@shared/calendar'
import { configurationSchema, type ConfigurationInput } from '@shared/config/schema'
import { SCRUM_PRESET } from '@shared/config/presets'
import type { BugItem } from '@shared/dashboards'

const azure = vi.hoisted(() => ({ fetchAzure: vi.fn(), postAzure: vi.fn() }))
const profile = vi.hoisted(() => ({ getActiveConfig: vi.fn() }))

vi.mock('./client', () => azure)
vi.mock('../../profile/config-loader', () => profile)

const { classifyCriticality, computeStateDurations, getBugStateTimeData } =
  await import('./bug-state-time')

const FIXTURES = join(__dirname, '../../../../tests/fixtures/azure')
const UPDATES = (
  JSON.parse(readFileSync(join(FIXTURES, 'bugs-custom.json'), 'utf8')) as {
    updates: Record<string, WorkItemUpdate[]>
  }
).updates

const CUSTOM_FLOW = ['Triagem', 'Em correção', 'Em validação', 'Encerrado']

const WORKING_HOURS = [
  { start: '08:00', end: '12:00' },
  { start: '13:00', end: '17:00' }
]

const config: ConfigurationInput = {
  version: 1,
  organization: 'contoso',
  processProfiles: {
    proprio: {
      ...SCRUM_PRESET,
      deliveredStates: ['Encerrado'],
      terminalStates: ['Encerrado', 'Descartado'],
      removedStates: ['Descartado'],
      inProgressState: 'Em correção',
      bugStateOrder: CUSTOM_FLOW
    }
  },
  products: [
    {
      id: 'loja',
      name: 'Loja Online',
      color: '#7B61FF',
      project: 'Contoso',
      processProfile: 'proprio'
    }
  ],
  customFields: { criticality: 'Contoso.Gravidade' },
  criticality: [
    { name: 'Crítica', matches: ['crítica', 'critica'] },
    { name: 'Leve', matches: ['leve'] }
  ],
  calendar: { country: 'BR', workingHours: WORKING_HOURS, productiveHoursPerDay: 6 },
  storyPoints: { '1': 2, '2': 4 },
  capacityDefaults: {
    frontDevs: 1,
    backDevs: 1,
    sprintDays: 10,
    frontBugPercent: 20,
    backBugPercent: 20
  }
}

const SPRINT = {
  key: '2026-08-31',
  label: '31/08 – 11/09',
  startDate: '2026-08-31T00:00:00',
  finishDate: '2026-09-11T00:00:00',
  iterations: { loja: { id: 'it-12', name: 'Sprint 12', path: 'Contoso\\Sprint 12' } }
} as unknown as UnifiedSprint

function closedBug(id: number, criticality: string): BugItem {
  return {
    id,
    productId: 'loja',
    title: `Bug ${id}`,
    state: 'Encerrado',
    criticality,
    createdDate: '2026-09-04T08:00:00',
    closedDate: '2026-09-08T12:00:00',
    sprintKey: SPRINT.key,
    sprintLabel: SPRINT.label,
    sprintName: 'Sprint 12',
    closedSprintKey: SPRINT.key,
    monthKey: '2026-09',
    monthLabel: 'Set/26',
    isRecurrent: false
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  profile.getActiveConfig.mockReturnValue(configurationSchema.parse(config))
  // Todo bug fechado repete o histórico do 201: o que muda entre eles é a criticidade.
  azure.fetchAzure.mockResolvedValue({ value: UPDATES['201'] })
})

describe('Tempo por estado do bug (RN-BUG-17)', () => {
  const flow = {
    initialState: CUSTOM_FLOW[0],
    terminalStates: new Set(['Encerrado', 'Descartado'])
  }

  it('mede em horas úteis do Calendário e não conta o feriado', () => {
    const calendar = createCalendar({ country: 'BR', workingHours: WORKING_HOURS })
    const durations = computeStateDurations(UPDATES['201'], '2026-09-04T08:00:00', flow, calendar)

    // Sexta 04/09 das 08h às 12h em Triagem; depois, de sexta 12h a terça 08h em
    // correção: só a tarde de sexta, porque segunda 07/09 é feriado nacional.
    expect(durations).toEqual({ Triagem: 4, 'Em correção': 4 })
  })

  it('sem o feriado, o mesmo intervalo soma o dia a mais', () => {
    const noHoliday = createCalendar({ workingHours: WORKING_HOURS })
    const durations = computeStateDurations(UPDATES['201'], '2026-09-04T08:00:00', flow, noHoliday)

    expect(durations['Em correção']).toBe(12)
  })

  it('o estado inicial é o primeiro do fluxo configurado, não um nome fixo', () => {
    const calendar = createCalendar({ workingHours: WORKING_HOURS })
    const durations = computeStateDurations(
      UPDATES['201'],
      '2026-09-04T08:00:00',
      { ...flow, initialState: 'Recebido' },
      calendar
    )

    expect(durations).toHaveProperty('Recebido', 4)
    expect(durations).not.toHaveProperty('Triagem')
  })

  it('para de contar no estado terminal do Perfil de processo', () => {
    const calendar = createCalendar({ workingHours: WORKING_HOURS })
    const durations = computeStateDurations(
      UPDATES['201'],
      '2026-09-04T08:00:00',
      { ...flow, terminalStates: new Set(['Em correção']) },
      calendar
    )

    expect(durations).toEqual({ Triagem: 4 })
  })

  it('agrupa por nível de criticidade da Configuração, pelos prefixos', async () => {
    const result = await getBugStateTimeData(
      [closedBug(201, 'Crítica - 8h'), closedBug(202, 'sem nível')],
      [SPRINT]
    )

    expect(result.stateOrder).toEqual(CUSTOM_FLOW)
    const [slot] = result.sprintSlots
    expect(slot.bugCount).toBe(2)
    expect(Object.keys(slot.byCategory)).toEqual(['Crítica', 'Leve'])
    expect(slot.byCategory['Crítica']).toEqual({
      states: { Triagem: 4, 'Em correção': 4 },
      bugCount: 1
    })
    expect(slot.byCategory['Leve'].bugCount).toBe(0)
  })
})

describe('Nível de criticidade (RN-BUG-05)', () => {
  const levels = configurationSchema.parse(config).criticality

  it('casa pelo prefixo, sem diferenciar maiúsculas', () => {
    expect(classifyCriticality('CRÍTICA - 8h', levels)).toBe('Crítica')
    expect(classifyCriticality('critica', levels)).toBe('Crítica')
    expect(classifyCriticality('Leve (72h)', levels)).toBe('Leve')
  })

  it('valor que não casa com nenhum nível fica sem nível', () => {
    expect(classifyCriticality('Não informado', levels)).toBeNull()
    expect(classifyCriticality('Crítica', [])).toBeNull()
  })
})
