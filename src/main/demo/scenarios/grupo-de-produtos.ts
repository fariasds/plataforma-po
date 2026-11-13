import {
  AGILE_PROCESS,
  AGILE_PROFILE,
  PEOPLE,
  SCRUM_PROCESS,
  SCRUM_PROFILE,
  azure,
  baseConfig,
  project,
  sprintSeries,
  workItem
} from '../builders'
import type { FakeWorkItem, Scenario } from '../types'
import {
  EFFORT,
  LOJA_AREA,
  LOJA_PROJECT,
  LOJA_SPRINTS,
  PRIORITY,
  lojaItem,
  lojaSprint
} from './comum'

/**
 * Dois Produtos em projetos e processos diferentes, somados num Grupo. As
 * sprints do App têm outro nome e a mesma janela das da Loja; uma iteração
 * extra do App, de uma semana, não casa com nenhuma da Loja.
 */

const MOBILE = 'Mobile'
const APP_AREA = 'Mobile\\App'
const STORY_POINTS_FIELD = 'Microsoft.VSTS.Scheduling.StoryPoints'

const APP_SPRINTS = [
  ...sprintSeries({
    folder: 'Mobile\\App',
    idPrefix: 'it-app',
    firstMonday: '2026-08-24',
    count: 3,
    firstNumber: 10,
    namePrefix: 'Iteração'
  }),
  // Semana de estabilização: janela própria, vira uma Sprint unificada só do App.
  {
    id: 'it-app-estabilizacao',
    name: 'Estabilização',
    path: 'Mobile\\App\\Estabilização',
    startDate: '2026-10-05T00:00:00Z',
    finishDate: '2026-10-09T00:00:00Z'
  }
]

// Iterações de outro time no mesmo projeto da Loja: não são do Produto (RN-GLB-05).
const INSTITUCIONAL_SPRINTS = sprintSeries({
  folder: 'Contoso\\Institucional',
  idPrefix: 'it-inst',
  firstMonday: '2026-08-31',
  count: 3
})

const APP_S12 = APP_SPRINTS[2].path
const LOJA_S3 = lojaSprint(3)

function appItem(spec: Omit<Parameters<typeof workItem>[1], 'project' | 'area'>): FakeWorkItem {
  return workItem(AGILE_PROCESS, { project: MOBILE, area: APP_AREA, ...spec })
}

export const grupoDeProdutos: Scenario = {
  id: 'grupo-de-produtos',
  titulo: 'Dois Produtos num Grupo',
  prova:
    'Loja Online (Scrum) e App Mobile (Agile), em projetos, times e cores diferentes, somados ' +
    'no Grupo "Digital". As sprints se unem pela janela de datas e não pelo nome; a iteração ' +
    'de outro time no mesmo projeto fica de fora; uma iteração do App sem par na Loja vira uma ' +
    'Sprint unificada só dele. Cada Produto é medido pelo próprio Perfil de processo.',
  regras: ['RN-GLB-01', 'RN-GLB-02', 'RN-GLB-04', 'RN-GLB-05', 'RN-ENT-13', 'RN-DES-05'],
  telas: ['sprint-unificada', 'entregas', 'bugs', 'desempenho', 'daily', 'planning'],
  anchorDate: '2026-09-29T15:00:00',
  config: baseConfig({
    processProfiles: { scrum: SCRUM_PROFILE, agile: AGILE_PROFILE },
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7b61ff',
        project: LOJA_PROJECT,
        team: 'Loja Team',
        areaPaths: [LOJA_AREA],
        processProfile: 'scrum'
      },
      {
        id: 'app',
        name: 'App Mobile',
        color: '#2f6fed',
        project: MOBILE,
        team: 'App Team',
        areaPaths: [APP_AREA],
        processProfile: 'agile'
      }
    ],
    groups: [{ id: 'digital', name: 'Digital', color: '#0e9f6e', products: ['loja', 'app'] }]
  }),
  selections: ['loja', 'app', 'digital'],
  azure: azure(
    [
      project({
        id: '00000000-0000-4000-9000-000000000001',
        name: LOJA_PROJECT,
        process: SCRUM_PROCESS,
        areas: [LOJA_AREA, 'Contoso\\Institucional'],
        iterations: [...LOJA_SPRINTS.slice(0, 4), ...INSTITUCIONAL_SPRINTS],
        defaultTeam: 'Loja Team',
        teams: [
          {
            id: 'team-loja',
            name: 'Loja Team',
            iterationIds: LOJA_SPRINTS.slice(0, 4).map((i) => i.id)
          },
          {
            id: 'team-inst',
            name: 'Institucional',
            iterationIds: INSTITUCIONAL_SPRINTS.map((i) => i.id)
          }
        ]
      }),
      project({
        id: '00000000-0000-4000-9000-000000000002',
        name: MOBILE,
        process: AGILE_PROCESS,
        areas: [APP_AREA],
        iterations: APP_SPRINTS,
        defaultTeam: 'App Team',
        teams: [{ id: 'team-app', name: 'App Team', iterationIds: APP_SPRINTS.map((i) => i.id) }]
      })
    ],
    [
      lojaItem({
        id: 2001,
        title: 'Vitrine personalizada',
        iteration: LOJA_S3,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [EFFORT]: 3, [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { state: 'Approved' }],
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-25T17:00:00', { state: 'Done' }]
        ]
      }),
      lojaItem({
        id: 2002,
        title: 'Checkout em uma página',
        iteration: LOJA_S3,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [EFFORT]: 8, [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { state: 'Approved' }],
          ['2026-09-22T09:00:00', { state: 'Committed' }]
        ]
      }),
      lojaItem({
        id: 2003,
        type: 'Bug',
        title: 'Preço sem desconto no carrinho',
        iteration: LOJA_S3,
        created: '2026-09-23T10:00:00',
        events: [
          ['2026-09-23T11:00:00', { state: 'Committed' }],
          ['2026-09-24T16:00:00', { state: 'Done' }]
        ]
      }),
      // Item do outro time, no mesmo projeto: fica de fora pela área.
      workItem(SCRUM_PROCESS, {
        id: 2004,
        project: LOJA_PROJECT,
        area: 'Contoso\\Institucional',
        type: 'Product Backlog Item',
        title: 'Página "quem somos"',
        iteration: INSTITUCIONAL_SPRINTS[1].path,
        created: '2026-09-10T09:00:00',
        events: [
          ['2026-09-14T09:00:00', { state: 'Committed' }],
          ['2026-09-22T12:00:00', { state: 'Done' }]
        ]
      }),
      appItem({
        id: 2101,
        type: 'User Story',
        title: 'Login com biometria',
        iteration: APP_S12,
        created: '2026-09-09T09:00:00',
        assignedTo: PEOPLE.diego,
        fields: { [STORY_POINTS_FIELD]: 5, [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { state: 'New' }],
          ['2026-09-21T09:00:00', { state: 'Active' }],
          ['2026-09-24T12:00:00', { state: 'Resolved' }],
          ['2026-09-28T10:00:00', { state: 'Closed' }]
        ]
      }),
      appItem({
        id: 2102,
        type: 'User Story',
        title: 'Notificação de pedido enviado',
        iteration: APP_S12,
        created: '2026-09-09T09:00:00',
        assignedTo: PEOPLE.ana,
        fields: { [STORY_POINTS_FIELD]: 3, [PRIORITY]: 2 },
        events: [['2026-09-28T09:00:00', { state: 'Active' }]]
      }),
      appItem({
        id: 2103,
        type: 'Bug',
        title: 'App fecha ao girar a tela',
        iteration: APP_S12,
        created: '2026-09-22T14:00:00',
        events: [
          ['2026-09-23T09:00:00', { state: 'Active' }],
          ['2026-09-25T11:00:00', { state: 'Resolved' }],
          ['2026-09-28T15:00:00', { state: 'Closed' }]
        ]
      }),
      appItem({
        id: 2104,
        type: 'User Story',
        title: 'Modo escuro',
        iteration: APP_SPRINTS[3].path,
        created: '2026-09-15T09:00:00',
        fields: { [STORY_POINTS_FIELD]: 2, [PRIORITY]: 3 }
      })
    ]
  )
}
