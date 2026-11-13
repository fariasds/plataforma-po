import { PEOPLE, SCRUM_PROCESS, azure, baseConfig, task } from '../builders'
import type { Scenario } from '../types'
import {
  EFFORT,
  LOJA_AREA,
  LOJA_PRODUCT,
  LOJA_PROJECT,
  PRIORITY,
  lojaItem,
  lojaProject,
  lojaSprint
} from './comum'

const S4 = lojaSprint(4)

export const calendarioComFeriado: Scenario = {
  id: 'calendario-com-feriado',
  titulo: 'Feriados no meio da sprint e expediente em dois turnos',
  prova:
    'A sprint 4 (05/10 a 16/10) tem o feriado nacional de 12/10 e um feriado extra da ' +
    'Configuração em 15/10, e o expediente é 08:00–12:00 e 13:30–18:00. Toda duração sai em ' +
    'horas úteis desse calendário: o lead time que atravessa o feriado não conta o dia, a ' +
    'régua da Daily marca os dois feriados e só conta dias de trabalho restantes, e a projeção ' +
    'de término pula os feriados.',
  regras: ['RN-GLB-07', 'RN-DLY-01', 'RN-DLY-14', 'RN-ENT-01', 'RN-HOM-02'],
  telas: ['daily', 'entregas', 'desempenho', 'home'],
  anchorDate: '2026-10-14T16:00:00',
  config: baseConfig({
    products: [LOJA_PRODUCT],
    calendar: {
      country: 'BR',
      extraHolidays: [{ date: '2026-10-15', name: 'Feriado municipal' }],
      workingHours: [
        { start: '08:00', end: '12:00' },
        { start: '13:30', end: '18:00' }
      ],
      productiveHoursPerDay: 6.5
    }
  }),
  selections: ['loja'],
  azure: azure(
    [lojaProject()],
    [
      // Começa na sexta, atravessa o feriado de segunda e entrega na terça.
      lojaItem({
        id: 6001,
        title: 'Retirada na loja física',
        iteration: LOJA_PROJECT,
        created: '2026-09-28T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [EFFORT]: 3, [PRIORITY]: 1 },
        events: [
          ['2026-10-02T10:00:00', { iteration: S4 }],
          ['2026-10-09T13:30:00', { state: 'Committed' }],
          ['2026-10-13T12:00:00', { state: 'Done' }]
        ]
      }),
      // Em andamento desde antes do feriado: a projeção pula 12/10 e 15/10.
      lojaItem({
        id: 6002,
        title: 'Agendamento de entrega',
        iteration: LOJA_PROJECT,
        created: '2026-09-28T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [EFFORT]: 5, [PRIORITY]: 1 },
        events: [
          ['2026-10-02T10:00:00', { iteration: S4 }],
          ['2026-10-08T08:00:00', { state: 'Committed' }]
        ]
      }),
      // Não iniciado: projeta a partir de hoje e não cabe.
      lojaItem({
        id: 6003,
        title: 'Rastreamento em tempo real',
        iteration: LOJA_PROJECT,
        created: '2026-09-28T09:00:00',
        fields: { [EFFORT]: 8, [PRIORITY]: 2 },
        events: [['2026-10-02T10:00:00', { iteration: S4 }]]
      }),
      // Pequeno e não iniciado: ainda cabe.
      lojaItem({
        id: 6004,
        title: 'Aviso de horário de retirada',
        iteration: LOJA_PROJECT,
        created: '2026-09-28T09:00:00',
        fields: { [EFFORT]: 1, [PRIORITY]: 3 },
        events: [['2026-10-02T10:00:00', { iteration: S4 }]]
      }),
      task(SCRUM_PROCESS, {
        id: 6101,
        parent: 6002,
        project: LOJA_PROJECT,
        area: LOJA_AREA,
        iteration: S4,
        title: 'Calendário de janelas de entrega',
        created: '2026-10-05T09:00:00',
        assignedTo: PEOPLE.carla,
        events: [['2026-10-08T08:00:00', { state: 'In Progress' }]]
      }),
      task(SCRUM_PROCESS, {
        id: 6102,
        parent: 6001,
        project: LOJA_PROJECT,
        area: LOJA_AREA,
        iteration: S4,
        title: 'Integração com o estoque da loja',
        created: '2026-10-05T09:00:00',
        assignedTo: PEOPLE.bruno,
        events: [
          ['2026-10-09T13:30:00', { state: 'In Progress' }],
          ['2026-10-13T11:00:00', { state: 'Done' }]
        ]
      })
    ]
  )
}
