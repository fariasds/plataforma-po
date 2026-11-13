import { PEOPLE, azure, baseConfig, type HistoryEvent } from '../builders'
import type { FakeWorkItem, Scenario } from '../types'
import {
  DUE_DATE,
  EFFORT,
  LOJA_PRODUCT,
  LOJA_PROJECT,
  LOJA_SPRINTS,
  lojaItem,
  lojaProject
} from './comum'

const RETRABALHO = 'Contoso.Retrabalho'
const CRITICIDADE = 'Contoso.Criticidade'

/** Dia `offset` (0 = segunda) da sprint, às `hour` horas, em horário local. */
function day(sprint: number, offset: number, hour: number): string {
  const start = new Date(`${LOJA_SPRINTS[sprint - 1].startDate.slice(0, 10)}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() + offset)
  return `${start.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00`
}

const ANCHOR = '2026-11-10T10:00:00'

/** O histórico para no "hoje" do Cenário: o que viria depois ainda não aconteceu. */
function past(events: HistoryEvent[]): HistoryEvent[] {
  return events.filter(([date]) => date <= ANCHOR)
}

/**
 * Seis sprints com o mesmo desenho e números que variam: o time melhora o
 * retrabalho e piora o SLA ao longo do tempo. A sprint 6 é a corrente.
 */
function sprintItems(sprint: number): FakeWorkItem[] {
  const base = 8000 + sprint * 10
  const path = LOJA_SPRINTS[sprint - 1].path
  const rework = [3 - Math.min(sprint, 3), sprint % 2, 0]
  const people = [PEOPLE.bruno, PEOPLE.carla, PEOPLE.diego]

  const pbis = [0, 1, 2].map((i) =>
    lojaItem({
      id: base + i,
      title: `Melhoria ${sprint}.${i + 1}`,
      iteration: LOJA_PROJECT,
      created: day(sprint, -7, 9),
      assignedTo: people[i],
      fields: { [EFFORT]: i + 2, [RETRABALHO]: rework[i] || undefined },
      events: past([
        [day(sprint, -3, 15), { iteration: path, state: 'Approved' }],
        [day(sprint, i, 9), { state: 'Committed' }],
        [day(sprint, [3, 7, 8][i], 16), { state: 'Done' }]
      ])
    })
  )

  // Um bug por sprint fechado no prazo e outro cada vez mais atrasado.
  const late = Math.max(0, sprint - 2)
  const bugs = [0, 1].map((i) =>
    lojaItem({
      id: base + 5 + i,
      type: 'Bug',
      title: `Defeito ${sprint}.${i + 1}`,
      iteration: path,
      created: day(sprint, 1, 9),
      fields: {
        [CRITICIDADE]: i === 0 ? 'Alta - SLA 16h' : 'Média - SLA 40h',
        [DUE_DATE]: day(sprint, 2 + i * 2, 17)
      },
      events: past([
        [day(sprint, 1, 10), { state: 'Committed' }],
        [day(sprint, 2 + i * 2 + (i === 1 ? late : 0), 15), { state: 'Done' }]
      ])
    })
  )

  return [...pbis, ...bugs]
}

export const desempenhoCincoSprints: Scenario = {
  id: 'desempenho-cinco-sprints',
  titulo: 'Histórico de seis sprints para as tendências',
  prova:
    'Seis sprints com o mesmo desenho e números que variam: o retrabalho cai, o atraso do bug ' +
    'de criticidade média cresce e a sprint corrente ainda está aberta. É histórico suficiente ' +
    'para as tendências de cinco períodos do Desempenho (SLA, retrabalho, tempo por estado e ' +
    'foco em desenvolvimento), por sprint e por mês, e para a série de bugs por sprint.',
  regras: ['RN-DES-03', 'RN-DES-05', 'RN-DES-06', 'RN-BUG-02', 'RN-BUG-17'],
  telas: ['desempenho', 'bugs', 'entregas'],
  anchorDate: ANCHOR,
  config: baseConfig({
    products: [LOJA_PRODUCT],
    customFields: { reworkCount: RETRABALHO, criticality: CRITICIDADE },
    criticality: [
      { name: 'Alta', matches: ['alta'], color: '#d92d20' },
      { name: 'Média', matches: ['média'], color: '#f79009' }
    ]
  }),
  selections: ['loja'],
  azure: azure(
    [
      lojaProject({
        iterations: LOJA_SPRINTS.slice(0, 6),
        customFields: [
          { name: 'Retrabalho', referenceName: RETRABALHO, type: 'integer' },
          { name: 'Criticidade', referenceName: CRITICIDADE, type: 'string' }
        ]
      })
    ],
    [1, 2, 3, 4, 5, 6].flatMap(sprintItems)
  )
}
