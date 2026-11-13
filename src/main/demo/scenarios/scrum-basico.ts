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

const S2 = lojaSprint(2)
const S3 = lojaSprint(3)

export const scrumBasico: Scenario = {
  id: 'scrum-basico',
  titulo: 'Scrum básico, sem campos customizados',
  prova:
    'Um Produto só, Perfil de processo Scrum e nenhum campo customizado. Toda tela abre, e os ' +
    'indicadores que dependem de campo (retrabalho, criticidade, esforço por disciplina, ' +
    'reincidência) chegam vazios e dizendo o que configurar, em vez de mostrar zero.',
  regras: [
    'RN-GLB-01',
    'RN-GLB-05',
    'RN-ENT-01',
    'RN-BUG-04',
    'RN-BUG-05',
    'RN-PLN-03',
    'RN-DLY-01'
  ],
  telas: ['entregas', 'bugs', 'desempenho', 'daily', 'planning', 'descoberta'],
  anchorDate: '2026-09-29T10:00:00',
  config: baseConfig({ products: [LOJA_PRODUCT] }),
  selections: ['loja'],
  azure: azure(
    [lojaProject()],
    [
      // Entregue na sprint 3, planejado antes de ela começar.
      lojaItem({
        id: 1001,
        title: 'Busca por categoria',
        iteration: S3,
        created: '2026-09-10T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [EFFORT]: 3, [PRIORITY]: 1 },
        events: [
          ['2026-09-17T14:00:00', { state: 'Approved' }],
          ['2026-09-21T09:00:00', { state: 'Committed' }],
          ['2026-09-24T16:00:00', { state: 'Done' }]
        ]
      }),
      // Em andamento.
      lojaItem({
        id: 1002,
        title: 'Carrinho salvo entre sessões',
        iteration: S3,
        created: '2026-09-11T10:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [EFFORT]: 5, [PRIORITY]: 2 },
        events: [
          ['2026-09-17T14:00:00', { state: 'Approved' }],
          ['2026-09-23T08:30:00', { state: 'Committed' }]
        ]
      }),
      // Ainda não iniciado.
      lojaItem({
        id: 1003,
        title: 'Cupom de primeira compra',
        iteration: S3,
        created: '2026-09-14T11:00:00',
        fields: { [EFFORT]: 2, [PRIORITY]: 3 },
        events: [['2026-09-17T14:00:00', { state: 'Approved' }]]
      }),
      // Sem estimativa: a Daily não tem como projetar.
      lojaItem({
        id: 1004,
        title: 'Ajustar texto do rodapé',
        iteration: S3,
        created: '2026-09-15T11:00:00',
        assignedTo: PEOPLE.diego,
        events: [['2026-09-28T13:00:00', { state: 'Committed' }]]
      }),
      // Bug corrigido na sprint.
      lojaItem({
        id: 1005,
        type: 'Bug',
        title: 'Frete calculado em dobro',
        iteration: S3,
        created: '2026-09-22T09:00:00',
        assignedTo: PEOPLE.bruno,
        events: [
          ['2026-09-22T10:00:00', { state: 'Committed' }],
          ['2026-09-23T15:00:00', { state: 'Done' }]
        ]
      }),
      // Bug ativo, aberto na sprint anterior.
      lojaItem({
        id: 1006,
        type: 'Bug',
        title: 'Imagem quebrada na vitrine',
        iteration: S2,
        created: '2026-09-15T09:00:00',
        events: [['2026-09-16T10:00:00', { state: 'Approved' }]]
      }),
      // Item entregue na sprint 2: não conta na 3.
      lojaItem({
        id: 1007,
        title: 'Página de produto',
        iteration: S2,
        created: '2026-08-31T09:00:00',
        fields: { [EFFORT]: 5, [PRIORITY]: 1 },
        events: [
          ['2026-09-04T10:00:00', { state: 'Approved' }],
          ['2026-09-08T09:00:00', { state: 'Committed' }],
          ['2026-09-15T17:00:00', { state: 'Done' }]
        ]
      }),
      task(SCRUM_PROCESS, {
        id: 1101,
        parent: 1002,
        project: LOJA_PROJECT,
        area: LOJA_AREA,
        iteration: S3,
        title: 'Persistir carrinho',
        created: '2026-09-21T10:00:00',
        assignedTo: PEOPLE.carla,
        events: [['2026-09-23T08:30:00', { state: 'In Progress' }]]
      }),
      task(SCRUM_PROCESS, {
        id: 1102,
        parent: 1002,
        project: LOJA_PROJECT,
        area: LOJA_AREA,
        iteration: S3,
        title: 'Teste de regressão do carrinho',
        created: '2026-09-21T10:00:00'
      }),
      task(SCRUM_PROCESS, {
        id: 1103,
        parent: 1001,
        project: LOJA_PROJECT,
        area: LOJA_AREA,
        iteration: S3,
        title: 'Índice de categoria',
        created: '2026-09-21T10:00:00',
        assignedTo: PEOPLE.bruno,
        events: [
          ['2026-09-21T11:00:00', { state: 'In Progress' }],
          ['2026-09-24T15:00:00', { state: 'Done' }]
        ]
      })
    ]
  )
}
