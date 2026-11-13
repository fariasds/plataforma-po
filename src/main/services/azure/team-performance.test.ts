import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import type { BugItem } from '@shared/dashboards'
import { getBugAnalysisData } from './bug-analysis'
import { getBugStateTimeData } from './bug-state-time'
import { getDevFocusData } from './dev-focus'
import { getReworkData } from './rework'
import { getTeamPerformanceData } from './team-performance'

// A tela compõe quatro serviços. Aqui se testa o que é dela — o SLA por nível de
// criticidade (RN-DES-03), a ordem dos estados e a falha parcial (RN-DES-02) —
// com os serviços vizinhos no lugar de respostas fictícias.

vi.mock('./bug-analysis', () => ({ getBugAnalysisData: vi.fn() }))
// O classificador de criticidade é o real: o SLA e o tempo por estado precisam
// cair nos mesmos níveis.
vi.mock('./bug-state-time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bug-state-time')>()),
  getBugStateTimeData: vi.fn()
}))
vi.mock('./dev-focus', () => ({ getDevFocusData: vi.fn() }))
vi.mock('./rework', () => ({ getReworkData: vi.fn() }))

let activeConfig: Configuration | null = null
vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => activeConfig }))

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve('tests/fixtures/azure', name), 'utf8')) as T

function loadConfig(): Configuration {
  const result = validateConfiguration(read('perf-configuracao.json'))
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
}

const { bugs } = read<{ bugs: BugItem[] }>('perf-sla-bugs.json')

// Da mais nova para a mais antiga, como buildUnifiedSprints entrega.
const SPRINTS: UnifiedSprint[] = [
  {
    key: '2026-04-13',
    label: 'Sprint 8 (13/04 a 24/04)',
    startDate: '2026-04-13T00:00:00Z',
    finishDate: '2026-04-24T00:00:00Z',
    iterations: { loja: { id: 'it-8', name: 'Sprint 8', path: 'Contoso\\Loja\\Sprint 8' } }
  },
  {
    key: '2026-03-30',
    label: 'Sprint 7 (30/03 a 10/04)',
    startDate: '2026-03-30T00:00:00Z',
    finishDate: '2026-04-10T00:00:00Z',
    iterations: { loja: { id: 'it-7', name: 'Sprint 7', path: 'Contoso\\Loja\\Sprint 7' } }
  }
]

const empty = { sprintSlots: [], monthSlots: [] }
const LOJA_ORDER = ['New', 'Approved', 'Committed', 'Done']
const ANALYSIS_ORDER = ['New', 'Approved', 'Committed', 'Done', 'Aberto', 'Fazendo']

beforeEach(() => {
  activeConfig = loadConfig()
  vi.mocked(getBugAnalysisData).mockResolvedValue({
    allBugs: bugs,
    stateOrder: ANALYSIS_ORDER
  } as never)
  vi.mocked(getReworkData).mockResolvedValue(empty)
  vi.mocked(getBugStateTimeData).mockResolvedValue({ ...empty, stateOrder: LOJA_ORDER })
  vi.mocked(getDevFocusData).mockResolvedValue(empty)
})

describe('RN-DES-03 · SLA por nível de criticidade', () => {
  it('por sprint: conta o bug na sprint de fechamento, um percentual por nível', async () => {
    const result = await getTeamPerformanceData('loja', SPRINTS)

    expect(result.slaSprintStats).toEqual([
      {
        key: '2026-03-30',
        label: 'Sprint 7',
        fullLabel: 'Sprint 7 (30/03 a 10/04)',
        levels: {
          Crítica: { percent: 100, within: 1, total: 1 },
          Normal: { percent: null, within: 0, total: 0 },
          Menor: { percent: null, within: 0, total: 0 }
        }
      },
      {
        key: '2026-04-13',
        label: 'Sprint 8',
        fullLabel: 'Sprint 8 (13/04 a 24/04)',
        levels: {
          // O bug 502 nasceu na Sprint 7 e fechou na 8, fora do prazo.
          Crítica: { percent: 0, within: 0, total: 1 },
          // O 503 não tem sprint de fechamento: cai na de criação.
          Normal: { percent: 50, within: 1, total: 2 },
          // O 506 não tem prazo e fica fora; nível sem bug é nulo, não zero.
          Menor: { percent: null, within: 0, total: 0 }
        }
      }
    ])
  })

  it('por mês: agrupa pelo mês de fechamento, do mais antigo ao mais novo', async () => {
    const result = await getTeamPerformanceData('loja', SPRINTS)

    expect(result.slaMonthStats.map((s) => [s.label, s.fullLabel])).toEqual([
      ['Mar/26', 'Março de 2026'],
      ['Abr/26', 'Abril de 2026']
    ])
    expect(result.slaMonthStats[1].levels.Crítica).toEqual({ percent: 0, within: 0, total: 1 })
    expect(result.slaMonthStats[1].levels.Normal).toEqual({ percent: 50, within: 1, total: 2 })
  })

  it('devolve os níveis na ordem da Configuração, com a cor quando houver', async () => {
    const result = await getTeamPerformanceData('loja', SPRINTS)
    expect(result.criticalityLevels).toEqual([
      { name: 'Crítica', color: '#AA0000' },
      { name: 'Normal', color: null },
      { name: 'Menor', color: null }
    ])
  })

  it('sem níveis na Configuração, o SLA não é medido', async () => {
    activeConfig = { ...activeConfig!, criticality: [] }
    const result = await getTeamPerformanceData('loja', SPRINTS)

    expect(result.criticalityLevels).toEqual([])
    expect(result.slaSprintStats).toEqual([])
    expect(result.slaMonthStats).toEqual([])
  })
})

describe('RN-DES-05 · ordem dos estados do bug', () => {
  it('repassa a ordem que o tempo por estado devolve', async () => {
    const result = await getTeamPerformanceData('loja', SPRINTS)
    expect(result.bugStateOrder).toEqual(LOJA_ORDER)
  })

  it('se o tempo por estado falhar, usa a ordem da Análise de Bugs', async () => {
    vi.mocked(getBugStateTimeData).mockRejectedValue(new Error('timeout'))
    const result = await getTeamPerformanceData('loja', SPRINTS)
    expect(result.bugStateOrder).toEqual(ANALYSIS_ORDER)
    expect(result.partialFailures).toEqual(['Tempo por estado do bug'])
  })
})

describe('RN-DES-04 · rework sem campo configurado', () => {
  it('leva o campo que falta até a tela, sem inventar zero', async () => {
    vi.mocked(getReworkData).mockResolvedValue({
      ...empty,
      unavailable: 'customFields.reworkCount'
    })
    const result = await getTeamPerformanceData('loja', SPRINTS)
    expect(result.reworkUnavailable).toBe('customFields.reworkCount')
    expect(result.reworkSprintSlots).toEqual([])
  })

  it('com o campo configurado, não há aviso', async () => {
    const result = await getTeamPerformanceData('loja', SPRINTS)
    expect(result.reworkUnavailable).toBeNull()
  })
})

describe('RN-DES-02 · falha parcial não derruba a tela', () => {
  it('foco em desenvolvimento falhando: os demais gráficos seguem', async () => {
    vi.mocked(getDevFocusData).mockRejectedValue(new Error('timeout'))
    const result = await getTeamPerformanceData('loja', SPRINTS)

    expect(result.partialFailures).toEqual(['Foco em desenvolvimento'])
    expect(result.devFocusSprintSlots).toEqual([])
    expect(result.slaSprintStats).toHaveLength(2)
  })

  it('repassa a seleção a cada serviço', async () => {
    await getTeamPerformanceData('digital', SPRINTS)
    expect(getDevFocusData).toHaveBeenCalledWith('digital', SPRINTS)
    expect(getReworkData).toHaveBeenCalledWith('digital', SPRINTS)
    expect(getBugAnalysisData).toHaveBeenCalledWith('digital', SPRINTS, SPRINTS[0])
  })
})
