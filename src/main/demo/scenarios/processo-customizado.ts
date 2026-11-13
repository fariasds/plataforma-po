import {
  PEOPLE,
  azure,
  baseConfig,
  project,
  sprintSeries,
  task,
  workItem,
  type ItemSpec
} from '../builders'
import type { FakeProcess, FakeWorkItem, Scenario } from '../types'
import { DUE_DATE, PRIORITY } from './comum'

/**
 * Processo herdado com tipos e estados que não são os do Scrum nem os do Agile.
 * Se algum nome estivesse fixo no código, este Cenário quebraria.
 */

const OPERACOES = 'Operacoes'
const PORTAL_AREA = 'Operacoes\\Portal'
const SUPORTE_AREA = 'Operacoes\\Suporte'
const SIZE = 'Microsoft.VSTS.Scheduling.Size'

const COMMON = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.AreaPath',
  'System.IterationPath',
  'System.AssignedTo',
  'System.Description',
  PRIORITY
]

const KANBAN_PROCESS: FakeProcess = {
  templateName: 'Contoso Kanban',
  types: [
    {
      name: 'Demanda',
      referenceName: 'Contoso.Demanda',
      fields: [...COMMON, SIZE],
      states: [
        { name: 'Triagem', category: 'Proposed' },
        { name: 'Pronta', category: 'Proposed' },
        { name: 'Fazendo', category: 'InProgress' },
        { name: 'Em teste', category: 'InProgress' },
        { name: 'Validando', category: 'Resolved' },
        { name: 'Entregue', category: 'Completed' },
        { name: 'Cancelada', category: 'Removed' }
      ]
    },
    {
      name: 'Defeito',
      referenceName: 'Contoso.Defeito',
      fields: [...COMMON, DUE_DATE],
      states: [
        { name: 'Aberto', category: 'Proposed' },
        { name: 'Corrigindo', category: 'InProgress' },
        { name: 'Corrigido', category: 'Completed' },
        { name: 'Descartado', category: 'Removed' }
      ]
    },
    {
      name: 'Atividade',
      referenceName: 'Contoso.Atividade',
      fields: COMMON,
      states: [
        { name: 'Pendente', category: 'Proposed' },
        { name: 'Executando', category: 'InProgress' },
        { name: 'Concluída', category: 'Completed' }
      ]
    },
    {
      name: 'Épico antigo',
      referenceName: 'Contoso.EpicoAntigo',
      fields: COMMON,
      disabled: true,
      states: [{ name: 'Aberto', category: 'Proposed' }]
    }
  ],
  categories: { requirement: ['Demanda'], bug: 'Defeito', task: 'Atividade', hidden: [] }
}

const KANBAN_PROFILE = {
  workItemTypes: ['Demanda', 'Defeito'],
  plannableTypes: ['Demanda'],
  developmentTypes: ['Demanda'],
  bugType: 'Defeito',
  taskType: 'Atividade',
  estimateField: SIZE,
  deliveredStates: ['Entregue', 'Corrigido'],
  terminalStates: ['Entregue', 'Corrigido', 'Cancelada', 'Descartado'],
  removedStates: ['Cancelada', 'Descartado'],
  inProgressState: 'Fazendo',
  devDoneState: 'Validando',
  testingState: 'Em teste',
  bugStateOrder: ['Aberto', 'Corrigindo', 'Corrigido']
}

const CICLOS = sprintSeries({
  folder: 'Operacoes\\Portal',
  idPrefix: 'it-portal',
  firstMonday: '2026-09-07',
  count: 3,
  firstNumber: 7,
  namePrefix: 'Ciclo'
})
const C8 = CICLOS[1].path
const C9 = CICLOS[2].path

function item(spec: Omit<ItemSpec, 'project'>): FakeWorkItem {
  return workItem(KANBAN_PROCESS, { project: OPERACOES, ...spec })
}

function demanda(spec: Omit<ItemSpec, 'project' | 'type' | 'area'>): FakeWorkItem {
  return item({ type: 'Demanda', area: PORTAL_AREA, ...spec })
}

export const processoCustomizado: Scenario = {
  id: 'processo-customizado',
  titulo: 'Processo com tipos e estados próprios',
  prova:
    'Um processo herdado em que o requisito é "Demanda", o bug é "Defeito" e a tarefa é ' +
    '"Atividade", com estados como "Fazendo", "Validando" e "Entregue". Todas as telas usam só ' +
    'o Perfil de processo da Configuração: nenhum nome de tipo ou estado está fixo no código. ' +
    'Também prova o Produto de fluxo contínuo (Suporte), medido pela janela de datas, somado ' +
    'num Grupo com um Produto de ciclos, o abrandamento da Daily para item só aguardando ' +
    'teste e a sugestão de Perfil de processo da descoberta, que lê as categorias do Azure.',
  regras: [
    'RN-GLB-01',
    'RN-GLB-04',
    'RN-ENT-04',
    'RN-ENT-08',
    'RN-DLY-14',
    'RN-DLY-19',
    'RN-BUG-17'
  ],
  telas: ['entregas', 'daily', 'bugs', 'desempenho', 'planning', 'descoberta'],
  anchorDate: '2026-10-08T11:00:00',
  config: baseConfig({
    processProfiles: { kanban: KANBAN_PROFILE },
    products: [
      {
        id: 'portal',
        name: 'Portal do Cliente',
        color: '#0e7490',
        project: OPERACOES,
        team: 'Portal',
        areaPaths: [PORTAL_AREA],
        processProfile: 'kanban'
      },
      {
        id: 'suporte',
        name: 'Suporte',
        color: '#a15c07',
        project: OPERACOES,
        areaPaths: [SUPORTE_AREA],
        processProfile: 'kanban',
        cadence: 'continuous'
      }
    ],
    groups: [{ id: 'operacoes', name: 'Operações', products: ['portal', 'suporte'] }],
    storyPoints: { '1': 3, '2': 6, '4': 12, '8': 60 }
  }),
  selections: ['portal', 'suporte', 'operacoes'],
  azure: azure(
    [
      project({
        id: '00000000-0000-4000-9000-000000000003',
        name: OPERACOES,
        process: KANBAN_PROCESS,
        areas: [PORTAL_AREA, SUPORTE_AREA],
        iterations: CICLOS,
        defaultTeam: 'Portal',
        teams: [
          { id: 'team-portal', name: 'Portal', iterationIds: CICLOS.map((c) => c.id) },
          { id: 'team-suporte', name: 'Suporte', iterationIds: [] }
        ]
      })
    ],
    [
      // Ciclo 8, entregue com passagem por validação.
      demanda({
        id: 9001,
        title: 'Segunda via de boleto',
        iteration: OPERACOES,
        created: '2026-09-14T09:00:00',
        assignedTo: PEOPLE.carla,
        fields: { [SIZE]: 2, [PRIORITY]: 1 },
        events: [
          ['2026-09-18T10:00:00', { iteration: C8, state: 'Pronta' }],
          ['2026-09-21T09:00:00', { state: 'Fazendo' }],
          ['2026-09-24T15:00:00', { state: 'Validando' }],
          ['2026-09-28T11:00:00', { state: 'Entregue' }]
        ]
      }),
      // Ciclo 9: desenvolvimento acabou e só falta testar. A projeção estoura a sprint,
      // mas a Daily abranda o alarme (RN-DLY-19).
      demanda({
        id: 9002,
        title: 'Cadastro de dependentes',
        iteration: OPERACOES,
        created: '2026-09-28T09:00:00',
        assignedTo: PEOPLE.bruno,
        fields: { [SIZE]: 8, [PRIORITY]: 1 },
        events: [
          ['2026-10-02T10:00:00', { iteration: C9, state: 'Pronta' }],
          ['2026-10-06T09:00:00', { state: 'Fazendo' }],
          ['2026-10-07T16:00:00', { state: 'Em teste' }]
        ]
      }),
      demanda({
        id: 9003,
        title: 'Histórico de atendimentos',
        iteration: OPERACOES,
        created: '2026-09-28T09:00:00',
        assignedTo: PEOPLE.diego,
        fields: { [SIZE]: 2, [PRIORITY]: 2 },
        events: [
          ['2026-10-02T10:00:00', { iteration: C9, state: 'Pronta' }],
          ['2026-10-05T10:00:00', { state: 'Fazendo' }]
        ]
      }),
      demanda({
        id: 9004,
        title: 'Termos de uso novos',
        iteration: OPERACOES,
        created: '2026-09-28T09:00:00',
        fields: { [SIZE]: 1, [PRIORITY]: 3 },
        events: [['2026-10-02T10:00:00', { iteration: C9, state: 'Pronta' }]]
      }),
      // Cancelada: fora de tudo.
      demanda({
        id: 9005,
        title: 'Chat com robô',
        iteration: OPERACOES,
        created: '2026-09-28T09:00:00',
        fields: { [SIZE]: 4 },
        events: [
          ['2026-10-02T10:00:00', { iteration: C9 }],
          ['2026-10-06T10:00:00', { state: 'Cancelada' }]
        ]
      }),
      item({
        id: 9006,
        type: 'Defeito',
        area: PORTAL_AREA,
        title: 'Boleto com vencimento errado',
        iteration: C9,
        created: '2026-10-05T09:00:00',
        fields: { [DUE_DATE]: '2026-10-07T17:00:00' },
        events: [
          ['2026-10-05T10:00:00', { state: 'Corrigindo' }],
          ['2026-10-06T15:00:00', { state: 'Corrigido' }]
        ]
      }),
      task(KANBAN_PROCESS, {
        id: 9101,
        parent: 9003,
        project: OPERACOES,
        area: PORTAL_AREA,
        iteration: C9,
        title: 'Consulta ao sistema antigo de atendimentos',
        created: '2026-10-05T09:00:00',
        assignedTo: PEOPLE.diego,
        events: [['2026-10-05T10:00:00', { state: 'Executando' }]]
      }),
      task(KANBAN_PROCESS, {
        id: 9102,
        parent: 9002,
        project: OPERACOES,
        area: PORTAL_AREA,
        iteration: C9,
        title: 'Formulário de dependente',
        created: '2026-10-05T09:00:00',
        assignedTo: PEOPLE.bruno,
        events: [
          ['2026-10-06T09:00:00', { state: 'Executando' }],
          ['2026-10-07T15:00:00', { state: 'Concluída' }]
        ]
      }),
      // Suporte, fluxo contínuo: sem iteração, medido pela janela.
      item({
        id: 9201,
        type: 'Demanda',
        area: SUPORTE_AREA,
        title: 'Liberar acesso de cliente bloqueado',
        iteration: OPERACOES,
        created: '2026-10-05T14:00:00',
        events: [
          ['2026-10-05T15:00:00', { state: 'Fazendo' }],
          ['2026-10-06T10:00:00', { state: 'Entregue' }]
        ]
      }),
      item({
        id: 9202,
        type: 'Defeito',
        area: SUPORTE_AREA,
        title: 'Relatório mensal sem dados',
        iteration: OPERACOES,
        created: '2026-09-22T09:00:00',
        events: [
          ['2026-09-22T10:00:00', { state: 'Corrigindo' }],
          ['2026-09-23T17:00:00', { state: 'Corrigido' }]
        ]
      })
    ]
  )
}
