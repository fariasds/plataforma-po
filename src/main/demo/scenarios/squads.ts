import { planningKeys } from '@shared/planning-keys'
import { PEOPLE, SCRUM_PROCESS, azure, baseConfig, project, sprintSeries } from '../builders'
import type { Scenario } from '../types'
import { EFFORT, LOJA_PROJECT, LOJA_SPRINTS, PRIORITY, lojaItem, lojaSprint } from './comum'

/**
 * Três Squads no mesmo projeto: Digital (Loja e App, com as mesmas sprints),
 * Parceiros (Portal, com sprints uma semana deslocadas) e Interno (Backoffice,
 * de fluxo contínuo). Cada aba vê só as sprints dos seus Produtos, e a
 * capacidade de cada Squad é guardada à parte (RN-GLB-17, RN-PLN-22).
 */

const APP_AREA = 'Contoso\\App'
const PORTAL_AREA = 'Contoso\\Portal'
const BACKOFFICE_AREA = 'Contoso\\Backoffice'

/** Sprints de duas semanas que começam uma semana depois das da Loja. */
const PORTAL_SPRINTS = sprintSeries({
  folder: 'Contoso\\Portal',
  idPrefix: 'it-portal',
  firstMonday: '2026-08-31',
  count: 4
})

const FRONT = 'Contoso.EsforcoFrontend'
const BACK = 'Contoso.EsforcoBackend'

/** Esforço total e por disciplina, para o resumo do Planning mostrar a capacidade. */
function effort(front: number, back: number): Record<string, number> {
  return { [EFFORT]: front + back, [FRONT]: front, [BACK]: back }
}

const LOJA_S3 = lojaSprint(3)
const PORTAL_S2 = PORTAL_SPRINTS[1].path
const PORTAL_S3 = PORTAL_SPRINTS[2].path

export const squads: Scenario = {
  id: 'squads',
  titulo: 'Três Squads com calendários diferentes',
  prova:
    'Digital soma Loja e App, que dividem as sprints; Parceiros tem o Portal, com sprints ' +
    'deslocadas uma semana; Interno tem só o Backoffice, de fluxo contínuo. As sprints de cada ' +
    'Squad vêm só dos Produtos dela, a Squad só de fluxo contínuo é medida pela janela das ' +
    'demais, a visão "Squad inteira" soma os Produtos da Squad e a capacidade de cada Squad ' +
    'fica separada, partindo da capacidade única de antes das Squads.',
  regras: ['RN-GLB-02', 'RN-GLB-04', 'RN-GLB-17', 'RN-PLN-22'],
  telas: ['sprint-unificada', 'entregas', 'daily', 'planning', 'home'],
  anchorDate: '2026-09-29T15:00:00',
  config: baseConfig({
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7b61ff',
        project: LOJA_PROJECT,
        team: 'Loja Team',
        areaPaths: ['Contoso\\Loja'],
        processProfile: 'scrum'
      },
      {
        id: 'app',
        name: 'App Mobile',
        color: '#2f6fed',
        project: LOJA_PROJECT,
        team: 'Loja Team',
        areaPaths: [APP_AREA],
        processProfile: 'scrum'
      },
      {
        id: 'portal',
        name: 'Portal do Parceiro',
        color: '#e8590c',
        project: LOJA_PROJECT,
        team: 'Portal Team',
        areaPaths: [PORTAL_AREA],
        processProfile: 'scrum'
      },
      {
        id: 'backoffice',
        name: 'Backoffice',
        color: '#475467',
        project: LOJA_PROJECT,
        areaPaths: [BACKOFFICE_AREA],
        processProfile: 'scrum',
        cadence: 'continuous'
      }
    ],
    squads: [
      { id: 'squad-digital', name: 'Digital', color: '#7b61ff', products: ['loja', 'app'] },
      { id: 'squad-parceiros', name: 'Parceiros', color: '#e8590c', products: ['portal'] },
      { id: 'squad-interno', name: 'Interno', products: ['backoffice'] }
    ],
    customFields: { effortFrontend: FRONT, effortBackend: BACK }
  }),
  selections: ['squad-digital', 'loja', 'app', 'portal', 'backoffice'],
  workData: {
    // Gravada antes das Squads: continua valendo para quem ainda não tem a sua.
    [planningKeys.capacity]: { frontDevs: 1.5 },
    [planningKeys.squadCapacity('squad-parceiros')]: { frontDevs: 1, backDevs: 1 }
  },
  azure: azure(
    [
      project({
        id: '00000000-0000-4000-9000-000000000001',
        name: LOJA_PROJECT,
        process: SCRUM_PROCESS,
        areas: ['Contoso\\Loja', APP_AREA, PORTAL_AREA, BACKOFFICE_AREA],
        iterations: [...LOJA_SPRINTS.slice(0, 4), ...PORTAL_SPRINTS],
        defaultTeam: 'Loja Team',
        customFields: [
          { name: 'Esforço Frontend', referenceName: FRONT, type: 'double' },
          { name: 'Esforço Backend', referenceName: BACK, type: 'double' }
        ],
        teams: [
          {
            id: 'team-loja',
            name: 'Loja Team',
            iterationIds: LOJA_SPRINTS.slice(0, 4).map((i) => i.id)
          },
          {
            id: 'team-portal',
            name: 'Portal Team',
            iterationIds: PORTAL_SPRINTS.map((i) => i.id)
          }
        ]
      })
    ],
    [
      lojaItem({
        id: 3001,
        title: 'Cupom no checkout',
        iteration: LOJA_S3,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { ...effort(2, 3), [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { state: 'Approved' }],
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-25T17:00:00', { state: 'Done' }]
        ]
      }),
      lojaItem({
        id: 3002,
        title: 'Frete por região',
        iteration: LOJA_S3,
        created: '2026-09-08T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { ...effort(3, 5), [PRIORITY]: 2 },
        events: [
          ['2026-09-18T10:00:00', { state: 'Approved' }],
          ['2026-09-22T09:00:00', { state: 'Committed' }]
        ]
      }),
      lojaItem({
        id: 3101,
        area: APP_AREA,
        title: 'Login com biometria',
        iteration: LOJA_S3,
        created: '2026-09-09T09:00:00',
        assignedTo: PEOPLE.diego,
        fields: { ...effort(2, 1), [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { state: 'Approved' }],
          ['2026-09-23T09:00:00', { state: 'Committed' }]
        ]
      }),
      lojaItem({
        id: 3201,
        area: PORTAL_AREA,
        title: 'Cadastro de parceiro em etapas',
        iteration: PORTAL_S3,
        created: '2026-09-16T09:00:00',
        assignedTo: PEOPLE.ana,
        fields: { ...effort(3, 5), [PRIORITY]: 1 },
        events: [
          ['2026-09-25T10:00:00', { state: 'Approved' }],
          ['2026-09-28T09:00:00', { state: 'Committed' }]
        ]
      }),
      lojaItem({
        id: 3202,
        area: PORTAL_AREA,
        type: 'Bug',
        title: 'Relatório de comissão sem o mês corrente',
        iteration: PORTAL_S2,
        created: '2026-09-15T10:00:00',
        events: [
          ['2026-09-15T11:00:00', { state: 'Committed' }],
          ['2026-09-17T16:00:00', { state: 'Done' }]
        ]
      }),
      // Fluxo contínuo: sem iteração, medido pela janela das sprints dos demais.
      lojaItem({
        id: 3301,
        area: BACKOFFICE_AREA,
        title: 'Exportar pedidos em planilha',
        iteration: LOJA_PROJECT,
        created: '2026-09-14T09:00:00',
        events: [
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-24T15:00:00', { state: 'Done' }]
        ]
      })
    ]
  )
}
