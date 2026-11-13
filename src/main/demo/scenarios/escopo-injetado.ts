import { PEOPLE, azure, baseConfig } from '../builders'
import type { Scenario } from '../types'
import {
  EFFORT,
  LOJA_PRODUCT,
  LOJA_PROJECT,
  PRIORITY,
  lojaItem,
  lojaProject,
  lojaSprint
} from './comum'

const S3 = lojaSprint(3)
const S4 = lojaSprint(4)

export const escopoInjetado: Scenario = {
  id: 'escopo-injetado',
  titulo: 'Escopo que entra no meio da sprint',
  prova:
    'Injeção de escopo é o item cuja primeira atribuição à iteração da sprint aconteceu depois ' +
    'do início dela. Prova o item criado já dentro da sprint, o item puxado do backlog na ' +
    'segunda semana, o item trazido da sprint seguinte e o item puxado às 10h do primeiro dia, ' +
    'que também conta como injetado: a sprint começa à meia-noite. O planejado de antes do ' +
    'início não conta.',
  regras: ['RN-ENT-01', 'RN-ENT-08'],
  telas: ['entregas', 'daily'],
  anchorDate: '2026-09-30T11:00:00',
  config: baseConfig({ products: [LOJA_PRODUCT] }),
  selections: ['loja'],
  azure: azure(
    [lojaProject()],
    [
      // Planejado na sexta anterior: não é injeção.
      lojaItem({
        id: 4001,
        title: 'Rastreio de pedido',
        iteration: LOJA_PROJECT,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [EFFORT]: 5, [PRIORITY]: 1 },
        events: [
          ['2026-09-18T16:00:00', { iteration: S3, state: 'Approved' }],
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-28T17:00:00', { state: 'Done' }]
        ]
      }),
      lojaItem({
        id: 4002,
        title: 'Troca de endereço de entrega',
        iteration: LOJA_PROJECT,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [EFFORT]: 3, [PRIORITY]: 2 },
        events: [
          ['2026-09-18T16:00:00', { iteration: S3, state: 'Approved' }],
          ['2026-09-24T09:00:00', { state: 'Committed' }]
        ]
      }),
      // Puxado às 10h do primeiro dia: conta como injetado.
      lojaItem({
        id: 4003,
        title: 'Selo de compra segura',
        iteration: LOJA_PROJECT,
        created: '2026-09-15T09:00:00',
        fields: { [EFFORT]: 1, [PRIORITY]: 3 },
        events: [
          ['2026-09-21T10:00:00', { iteration: S3 }],
          ['2026-09-21T11:00:00', { state: 'Committed' }],
          ['2026-09-22T16:00:00', { state: 'Done' }]
        ]
      }),
      // Puxado do backlog na segunda semana.
      lojaItem({
        id: 4004,
        title: 'Banner da campanha de outubro',
        iteration: LOJA_PROJECT,
        created: '2026-09-15T09:00:00',
        assignedTo: PEOPLE.diego,
        fields: { [EFFORT]: 2, [PRIORITY]: 1 },
        events: [
          ['2026-09-28T09:00:00', { iteration: S3 }],
          ['2026-09-28T10:00:00', { state: 'Committed' }]
        ]
      }),
      // Trazido da sprint seguinte.
      lojaItem({
        id: 4005,
        title: 'Parcelamento sem juros',
        iteration: LOJA_PROJECT,
        created: '2026-09-10T09:00:00',
        fields: { [EFFORT]: 3, [PRIORITY]: 2 },
        events: [
          ['2026-09-17T10:00:00', { iteration: S4 }],
          ['2026-09-25T14:00:00', { iteration: S3 }]
        ]
      }),
      // Bug criado já dentro da sprint.
      lojaItem({
        id: 4006,
        type: 'Bug',
        title: 'Cupom aceito depois de vencido',
        iteration: S3,
        created: '2026-09-23T09:00:00',
        events: [
          ['2026-09-23T10:00:00', { state: 'Committed' }],
          ['2026-09-25T16:00:00', { state: 'Done' }]
        ]
      }),
      // Saiu da sprint no meio dela: não está mais no planejado.
      lojaItem({
        id: 4007,
        title: 'Programa de pontos',
        iteration: LOJA_PROJECT,
        created: '2026-09-08T09:00:00',
        fields: { [EFFORT]: 8 },
        events: [
          ['2026-09-18T16:00:00', { iteration: S3 }],
          ['2026-09-24T11:00:00', { iteration: S4 }]
        ]
      })
    ]
  )
}
