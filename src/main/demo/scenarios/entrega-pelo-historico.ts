import { PEOPLE, azure, baseConfig } from '../builders'
import type { Scenario } from '../types'
import { EFFORT, LOJA_PRODUCT, LOJA_PROJECT, lojaItem, lojaProject, lojaSprint } from './comum'

const S2 = lojaSprint(2)
const S3 = lojaSprint(3)
const S4 = lojaSprint(4)

export const entregaPeloHistorico: Scenario = {
  id: 'entrega-pelo-historico',
  titulo: 'Entrega medida pelo histórico, não pela iteração',
  prova:
    'A entrega de um item é a primeira vez que ele entrou num estado de entrega, e conta na ' +
    'sprint cuja janela contém essa data. Prova os casos que confundem quem vem do Azure: item ' +
    'entregue e depois movido para a sprint seguinte (conta na de entrega), item com a ' +
    'iteração da sprint mas entregue na anterior (não conta), item reaberto e fechado de novo ' +
    'na sprint seguinte (conta na primeira entrega) e item entregue sem nunca ter sido ' +
    'planejado numa sprint (conta pela janela).',
  regras: ['RN-ENT-01', 'RN-ENT-03', 'RN-ENT-04'],
  telas: ['entregas', 'desempenho'],
  anchorDate: '2026-10-08T15:00:00',
  config: baseConfig({ products: [{ ...LOJA_PRODUCT, excludedAreaPaths: ['Contoso\\Loja\\QA'] }] }),
  selections: ['loja'],
  azure: azure(
    [lojaProject()],
    [
      // Entregue na sprint 3 e movido para a 4 depois: conta na 3.
      lojaItem({
        id: 3001,
        title: 'Lista de desejos',
        iteration: LOJA_PROJECT,
        created: '2026-09-10T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [EFFORT]: 3 },
        events: [
          ['2026-09-17T10:00:00', { iteration: S3 }],
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-25T16:00:00', { state: 'Done' }],
          ['2026-10-05T09:30:00', { iteration: S4 }]
        ]
      }),
      // Na iteração da sprint 3, mas entregue na 2: não conta na 3.
      lojaItem({
        id: 3002,
        title: 'Filtro por preço',
        iteration: LOJA_PROJECT,
        created: '2026-09-01T09:00:00',
        fields: { [EFFORT]: 2 },
        events: [
          ['2026-09-04T10:00:00', { iteration: S2 }],
          ['2026-09-08T09:00:00', { state: 'Committed' }],
          ['2026-09-16T11:00:00', { state: 'Done' }],
          ['2026-09-21T08:30:00', { iteration: S3 }]
        ]
      }),
      // Entregue na 3, reaberto e fechado de novo na 4: a entrega é a primeira (RN-ENT-03).
      lojaItem({
        id: 3003,
        title: 'Cálculo de frete por CEP',
        iteration: LOJA_PROJECT,
        created: '2026-09-10T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [EFFORT]: 5 },
        events: [
          ['2026-09-17T10:00:00', { iteration: S3 }],
          ['2026-09-22T09:00:00', { state: 'Committed' }],
          ['2026-09-30T15:00:00', { state: 'Done' }],
          ['2026-10-06T10:00:00', { state: 'Committed' }],
          ['2026-10-07T16:00:00', { state: 'Done' }]
        ]
      }),
      // Nunca esteve numa sprint: entregue pela janela.
      lojaItem({
        id: 3004,
        title: 'Corrigir ortografia no checkout',
        iteration: LOJA_PROJECT,
        created: '2026-09-28T09:00:00',
        events: [
          ['2026-09-28T10:00:00', { state: 'Committed' }],
          ['2026-09-29T11:00:00', { state: 'Done' }]
        ]
      }),
      // Entregue na sprint 4, planejado nela.
      lojaItem({
        id: 3005,
        type: 'Bug',
        title: 'Pedido duplicado ao clicar duas vezes',
        iteration: LOJA_PROJECT,
        created: '2026-10-01T09:00:00',
        events: [
          ['2026-10-02T10:00:00', { iteration: S4 }],
          ['2026-10-05T09:00:00', { state: 'Committed' }],
          ['2026-10-07T12:00:00', { state: 'Done' }]
        ]
      }),
      // Em andamento na sprint 4.
      lojaItem({
        id: 3006,
        title: 'Avaliação de produto',
        iteration: LOJA_PROJECT,
        created: '2026-09-29T09:00:00',
        assignedTo: PEOPLE.diego,
        fields: { [EFFORT]: 3 },
        events: [
          ['2026-10-02T10:00:00', { iteration: S4 }],
          ['2026-10-06T09:00:00', { state: 'Committed' }]
        ]
      }),
      // Entregue na janela, mas em área excluída: não conta.
      lojaItem({
        id: 3007,
        title: 'Roteiro de teste do checkout',
        area: 'Contoso\\Loja\\QA',
        iteration: LOJA_PROJECT,
        created: '2026-09-21T09:00:00',
        events: [
          ['2026-09-22T09:00:00', { iteration: S3, state: 'Committed' }],
          ['2026-09-24T09:00:00', { state: 'Done' }]
        ]
      })
    ]
  )
}
