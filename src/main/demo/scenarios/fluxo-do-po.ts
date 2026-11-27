import {
  SCRUM_PROCESS,
  azure,
  baseConfig,
  project,
  workItem,
  type HistoryEvent,
  type ItemSpec
} from '../builders'
import type { FakeProcess, FakeWorkItem, FakeWorkItemType, Scenario } from '../types'
import {
  DESCRIPTION,
  LOJA_AREA,
  LOJA_PRODUCT,
  LOJA_PROJECT,
  LOJA_SPRINTS,
  PBI,
  lojaSprint
} from './comum'
import { FAKE_TOKEN } from './planning-com-remanescentes'

/**
 * O retrato do fluxo do PO (RN-FLX-01): Features abertas e fechadas há pouco, os
 * filhos delas, feedbacks ligados por vínculo pai (Loja) e por "Related" (App) e
 * bugs abertos e fechados. Hoje é 26/11/2026; a janela de fechados começa em
 * 30/05/2026.
 */

const BUSINESS_VALUE = 'Microsoft.VSTS.Common.BusinessValue'
const APP_AREA = 'Contoso\\App'
const FEEDBACK_AREA = 'Contoso\\Feedback'

function flowType(
  name: string,
  states: [string, FakeWorkItemType['states'][number]['category']][]
): FakeWorkItemType {
  return {
    name,
    referenceName: `Contoso.${name}`,
    states: states.map(([stateName, category]) => ({ name: stateName, category })),
    fields: ['System.Id', 'System.Title', 'System.State', 'System.AreaPath', 'System.Description']
  }
}

/** Scrum com os tipos de Feature e de feedback que o fluxo do PO lê. */
const FLOW_PROCESS: FakeProcess = {
  ...SCRUM_PROCESS,
  types: [
    ...SCRUM_PROCESS.types,
    flowType('Feature', [
      ['New', 'Proposed'],
      ['In Progress', 'InProgress'],
      ['Done', 'Completed'],
      ['Removed', 'Removed']
    ]),
    flowType('Feedback', [
      ['New', 'Proposed'],
      ['Approved', 'InProgress'],
      ['Closed', 'Completed']
    ])
  ]
}

function item(
  spec: Omit<ItemSpec, 'project' | 'iteration'> & { iteration?: string; parent?: number },
  related?: number[]
): FakeWorkItem {
  const { parent, ...rest } = spec
  const built = workItem(FLOW_PROCESS, {
    project: LOJA_PROJECT,
    iteration: spec.iteration ?? 'Contoso',
    ...rest,
    fields: { ...(parent !== undefined ? { 'System.Parent': parent } : {}), ...rest.fields }
  })
  return related ? { ...built, related } : built
}

function feature(
  id: number,
  title: string,
  created: string,
  events: HistoryEvent[],
  extra: { area?: string; businessValue?: number; parent?: number } = {}
): FakeWorkItem {
  return item({
    id,
    type: 'Feature',
    title,
    area: extra.area ?? LOJA_AREA,
    created,
    events,
    parent: extra.parent,
    fields: extra.businessValue !== undefined ? { [BUSINESS_VALUE]: extra.businessValue } : {}
  })
}

const WORK_ITEMS: FakeWorkItem[] = [
  // Feedbacks da Loja: vivem numa área própria e são pais da Feature.
  item({
    id: 5214,
    type: 'Feedback',
    title: 'Clientes desistem do checkout por falta de Pix',
    area: FEEDBACK_AREA,
    created: '2026-09-15T09:00:00',
    events: [['2026-09-20T10:00:00', { state: 'Approved' }]],
    fields: {
      [DESCRIPTION]:
        '<p>Três clientes grandes pediram Pix.</p><ul><li>Abandono no pagamento</li></ul>' +
        `<p>Chave colada sem querer: ${FAKE_TOKEN}</p><img src="https://evil.example/x.png">`
    }
  }),
  item({
    id: 5198,
    type: 'Feedback',
    title: 'Cupom não vale para produto em promoção',
    area: FEEDBACK_AREA,
    created: '2026-10-02T09:00:00',
    events: [['2026-10-03T09:00:00', { state: 'Approved' }]],
    fields: { [DESCRIPTION]: '<div>O cupom some quando o item está em promoção.</div>' }
  }),
  // Ainda não aprovado: fica fora.
  item({
    id: 5150,
    type: 'Feedback',
    title: 'Modo escuro no site',
    area: FEEDBACK_AREA,
    created: '2026-10-10T09:00:00'
  }),

  // Features da Loja.
  feature(4102, 'Pagamento por Pix no checkout', '2026-10-01T09:00:00', [], {
    businessValue: 29,
    parent: 5214
  }),
  feature(
    4088,
    'Cupom de desconto por categoria',
    '2026-09-01T09:00:00',
    [['2026-10-05T09:00:00', { state: 'In Progress' }]],
    { businessValue: 22 }
  ),
  // Fechada há pouco: entra.
  feature(4060, 'Troca sem nota fiscal', '2026-07-01T09:00:00', [
    ['2026-07-10T09:00:00', { state: 'In Progress' }],
    ['2026-09-10T09:00:00', { state: 'Done' }]
  ]),
  // Fechada antes da janela: fica fora.
  feature(3900, 'Programa de pontos', '2026-01-10T09:00:00', [
    ['2026-03-02T09:00:00', { state: 'Done' }]
  ]),
  // Removida: fica fora.
  feature(4070, 'Frete grátis acima de R$ 200', '2026-10-01T09:00:00', [
    ['2026-10-20T09:00:00', { state: 'Removed' }]
  ]),

  // Filhos das Features da Loja. O 4232 mora em outra área e entra assim mesmo.
  item({
    id: 4211,
    type: PBI,
    title: 'Gerar QR Code Pix no checkout',
    area: LOJA_AREA,
    created: '2026-10-20T09:00:00',
    parent: 4102
  }),
  item({
    id: 4212,
    type: PBI,
    title: 'Confirmar o pagamento Pix e liberar o pedido',
    area: LOJA_AREA,
    created: '2026-10-20T09:00:00',
    parent: 4102
  }),
  item({
    id: 4230,
    type: PBI,
    title: 'Aplicar o cupom por categoria do produto',
    area: LOJA_AREA,
    created: '2026-09-02T09:00:00',
    iteration: lojaSprint(5),
    parent: 4088,
    events: [
      ['2026-10-20T09:00:00', { state: 'Committed' }],
      ['2026-10-28T09:00:00', { state: 'Done' }]
    ]
  }),
  item({
    id: 4232,
    type: PBI,
    title: 'Mostrar o cupom no app',
    area: APP_AREA,
    created: '2026-09-02T09:00:00',
    parent: 4088
  }),

  // Bugs da Loja.
  item({
    id: 5301,
    type: 'Bug',
    title: 'Cupom aplicado duas vezes no carrinho',
    area: LOJA_AREA,
    created: '2026-11-03T09:00:00',
    events: [['2026-11-04T09:00:00', { state: 'Committed' }]],
    fields: {
      [DESCRIPTION]: '<p>Com dois itens da mesma categoria, o desconto entra duas vezes.</p>'
    }
  }),
  item({
    id: 5302,
    type: 'Bug',
    title: 'Cupom expirado ainda aceito',
    area: LOJA_AREA,
    created: '2026-11-10T09:00:00',
    parent: 4230,
    fields: { [DESCRIPTION]: '<p>Cupom vencido ontem foi aceito hoje.</p>' }
  }),
  // Fechado na janela: entra, sem descrição.
  item({
    id: 5309,
    type: 'Bug',
    title: 'Pix recusado acima do limite',
    area: LOJA_AREA,
    created: '2026-11-01T09:00:00',
    events: [['2026-11-20T09:00:00', { state: 'Done' }]],
    fields: { [DESCRIPTION]: '<p>Esta descrição não vai para o retrato.</p>' }
  }),
  // Fechado antes da janela: fica fora.
  item({
    id: 5100,
    type: 'Bug',
    title: 'Banner antigo na home',
    area: LOJA_AREA,
    created: '2026-03-01T09:00:00',
    events: [['2026-04-01T09:00:00', { state: 'Done' }]]
  }),

  // App: a Feature e o feedback ligados por "Related".
  feature(4140, 'Login por biometria', '2026-10-15T09:00:00', [], { area: APP_AREA }),
  item(
    {
      id: 5220,
      type: 'Feedback',
      title: 'Digitar a senha no celular é lento',
      area: APP_AREA,
      created: '2026-10-12T09:00:00',
      events: [['2026-10-13T09:00:00', { state: 'Approved' }]],
      fields: { [DESCRIPTION]: '<p>Pedem entrar com a digital.</p>' }
    },
    [4140]
  )
]

export const fluxoDoPo: Scenario = {
  id: 'fluxo-do-po',
  titulo: 'Retrato do fluxo do PO',
  prova:
    'O retrato de cada Produto traz as Features abertas e as fechadas nos últimos 180 dias, ' +
    'sem as removidas; os filhos de cada Feature, inclusive o que mora em outra área; os ' +
    'feedbacks nos estados configurados, ligados à Feature pelo vínculo de pai (Loja) ou ' +
    '"Related" (App); e os bugs abertos e os fechados na janela, com descrição só nos abertos. ' +
    'O título e a descrição vão em texto puro, e o token fictício colado num feedback sai redigido. ' +
    'A pasta de trabalho fictícia da Loja (tests/regression/pastas/fluxo-do-po/loja) tem uma Feature ' +
    'em cada situação: Discovery com pendências, Em quebra com ID de regra repetido entre duas ' +
    'pastas, rascunho, Pronta para quebra parada há 45 dias, fechada no Azure com regras ainda ' +
    'abertas, arquivada e anterior ao fluxo. O App não tem pasta.',
  regras: [
    'RN-FLX-01',
    'RN-FLX-02',
    'RN-FLX-03',
    'RN-FLX-04',
    'RN-FLX-05',
    'RN-FLX-06',
    'RN-FLX-07',
    'RN-FLX-08',
    'RN-FLX-09',
    'RN-FLX-10',
    'RN-FLX-11',
    'RN-FLX-18',
    'RN-FLX-19',
    'RN-CFG-14',
    'RN-SEC-24'
  ],
  telas: ['retrato', 'fluxo', 'descoberta'],
  anchorDate: '2026-11-26T10:00:00',
  config: baseConfig({
    products: [
      {
        ...LOJA_PRODUCT,
        poFlow: {
          feedback: {
            type: 'Feedback',
            states: ['Approved'],
            areaPaths: [FEEDBACK_AREA],
            link: 'parent'
          }
        }
      },
      {
        id: 'app',
        name: 'App Mobile',
        color: '#0e9f8e',
        project: LOJA_PROJECT,
        areaPaths: [APP_AREA],
        processProfile: 'scrum',
        poFlow: {
          priorityField: null,
          feedback: { type: 'Feedback', states: ['Approved'], link: 'related' }
        }
      }
    ]
  }),
  selections: ['loja', 'app'],
  azure: azure(
    [
      project({
        id: '00000000-0000-4000-9000-000000000001',
        name: LOJA_PROJECT,
        process: FLOW_PROCESS,
        areas: [LOJA_AREA, APP_AREA, FEEDBACK_AREA],
        iterations: LOJA_SPRINTS
      })
    ],
    WORK_ITEMS
  )
}
