import { PEOPLE, SCRUM_PROCESS, azure, baseConfig, task, type HistoryEvent } from '../builders'
import type { FakePerson, FakeWorkItem, Scenario } from '../types'
import {
  DESCRIPTION,
  DUE_DATE,
  EFFORT,
  LOJA_AREA,
  LOJA_PRODUCT,
  LOJA_PROJECT,
  LOJA_SPRINTS,
  lojaItem,
  lojaProject
} from './comum'

/**
 * O Cenário dos prints e do Perfil de demonstração (RN-GLB-15): um Grupo com dois
 * Produtos, cinco sprints de histórico, a sprint 6 em andamento e a 7 por planejar.
 *
 * O "hoje" é a segunda-feira da segunda semana da sprint 6, às 9h, e nenhum
 * evento passa dele. Na demonstração as datas andam em semanas inteiras até essa
 * semana ser a de hoje (RN-GLB-16): com o "hoje" na segunda de manhã, nenhum dia
 * da semana real cai antes de um evento, e nada aparece acontecendo no futuro.
 */

const ANCHOR = '2026-11-09T09:00:00'
const APP_AREA = 'Contoso\\App'
const CRITICIDADE = 'Contoso.Criticidade'
const RETRABALHO = 'Contoso.Retrabalho'
const FRONT = 'Contoso.EsforcoFrontend'
const BACK = 'Contoso.EsforcoBackend'
const QA = 'Contoso.EsforcoQA'

/**
 * Divisão do esforço por disciplina, em pontos, para o Planning mostrar
 * frontend, backend, QA e a capacidade da sprint. A soma é o esforço total.
 */
const SPLIT: Record<number, [front: number, back: number, qa: number]> = {
  2: [1, 1, 0],
  3: [1, 1, 1],
  5: [2, 2, 1],
  8: [3, 4, 1]
}

function effortFields(effort: number): Record<string, number> {
  const [front, back, qa] = SPLIT[effort] ?? [0, effort, 0]
  return { [EFFORT]: effort, [FRONT]: front, [BACK]: back, [QA]: qa }
}

/** Dia `offset` (0 = segunda da primeira semana) da sprint, às `hour` horas. */
function day(sprint: number, offset: number, hour: number): string {
  const start = new Date(`${LOJA_SPRINTS[sprint - 1].startDate.slice(0, 10)}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() + offset)
  return `${start.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00`
}

function past(events: HistoryEvent[]): HistoryEvent[] {
  return events.filter(([date]) => date <= ANCHOR)
}

function sprintPath(sprint: number): string {
  return LOJA_SPRINTS[sprint - 1].path
}

interface Product {
  area: string
  /** Primeiro ID dos itens do Produto: 10000 na Loja, 20000 no App. */
  base: number
  names: string[]
}

const LOJA: Product = {
  area: LOJA_AREA,
  base: 10000,
  names: ['Filtro por marca', 'Página de ofertas', 'Carrinho salvo', 'Comparar produtos']
}

const APP: Product = {
  area: APP_AREA,
  base: 20000,
  names: ['Tela de pedidos', 'Modo escuro', 'Busca com sugestões', 'Endereços salvos']
}

const TEAM: FakePerson[] = [PEOPLE.bruno, PEOPLE.carla, PEOPLE.diego, PEOPLE.ana]

function item(
  product: Product,
  spec: Omit<Parameters<typeof lojaItem>[0], 'area'> & { events?: HistoryEvent[] }
): FakeWorkItem {
  return lojaItem({ ...spec, area: product.area, events: past(spec.events ?? []) })
}

// ─── Histórico: sprints 1 a 5 ────────────────────────────────────────────────

/**
 * O mesmo desenho a cada sprint, com números que variam: o retrabalho cai, o
 * bug de criticidade média atrasa cada vez mais no App, o item grande das
 * sprints pares não cabe e vai para a seguinte, e nas ímpares entra um item
 * no meio da sprint.
 */
function historyItems(product: Product, sprint: number): FakeWorkItem[] {
  const base = product.base + sprint * 100
  const path = sprintPath(sprint)
  const efforts = [3, 5, 2, 8]
  const doneOffsets = [2, 4, 7, 9]
  const spills = sprint % 2 === 0

  const pbis = efforts.map((effort, i) => {
    const spillsThis = spills && i === 3
    const events: HistoryEvent[] = [
      [day(sprint, -3, 15), { iteration: path, state: 'Approved' }],
      [day(sprint, i, 9), { state: 'Committed' }]
    ]
    if (spillsThis) {
      events.push([day(sprint, 11, 18), { iteration: sprintPath(sprint + 1) }])
      events.push([day(sprint + 1, 3, 16), { state: 'Done' }])
    } else {
      events.push([day(sprint, doneOffsets[i], 16), { state: 'Done' }])
    }
    return item(product, {
      id: base + i + 1,
      title: `${product.names[i]} (parte ${sprint})`,
      iteration: LOJA_PROJECT,
      created: day(sprint, -7, 9),
      assignedTo: TEAM[i],
      fields: {
        [EFFORT]: effort,
        [RETRABALHO]: sprint <= 3 && i < 4 - sprint ? 1 : undefined
      },
      events
    })
  })

  // Puxado no meio da sprint: entra no escopo injetado.
  const injected =
    sprint % 2 === 1
      ? [
          item(product, {
            id: base + 5,
            title: `Ajuste pedido pelo time comercial (${sprint})`,
            iteration: path,
            created: day(sprint, 3, 10),
            assignedTo: TEAM[sprint % TEAM.length],
            fields: { [EFFORT]: 2 },
            events: [
              [day(sprint, 3, 11), { state: 'Committed' }],
              [day(sprint, 8, 15), { state: 'Done' }]
            ]
          })
        ]
      : []

  const late = product === APP ? Math.max(0, sprint - 2) : 0
  const bugs = [0, 1].map((i) =>
    item(product, {
      id: base + 51 + i,
      type: 'Bug',
      title: i === 0 ? `Erro ao finalizar compra (${sprint})` : `Texto cortado na tela (${sprint})`,
      iteration: path,
      created: day(sprint, 1, 9),
      assignedTo: TEAM[(i + sprint) % TEAM.length],
      fields: {
        [CRITICIDADE]: i === 0 ? 'Alta - SLA 16h' : 'Média - SLA 40h',
        [DUE_DATE]: day(sprint, 2 + i * 2, 17)
      },
      events: [
        [day(sprint, 1, 10), { state: 'Committed' }],
        [day(sprint, 2 + i * 2 + (i === 1 ? late : 0), 15), { state: 'Done' }]
      ]
    })
  )

  return [...pbis, ...injected, ...bugs]
}

// ─── Sprint 6, em andamento ──────────────────────────────────────────────────

const S6 = sprintPath(6)

function current(
  product: Product,
  id: number,
  title: string,
  effort: number | null,
  events: HistoryEvent[],
  assignedTo: FakePerson
): FakeWorkItem {
  return item(product, {
    id,
    title,
    iteration: S6,
    created: day(5, 8, 10),
    assignedTo,
    fields: effort === null ? {} : effortFields(effort),
    events: [[day(5, 11, 15), { state: 'Approved' }], ...events]
  })
}

function sprintTask(
  product: Product,
  id: number,
  parent: number,
  title: string,
  assignedTo: FakePerson,
  events: HistoryEvent[]
): FakeWorkItem {
  return task(SCRUM_PROCESS, {
    id,
    parent,
    project: LOJA_PROJECT,
    area: product.area,
    iteration: S6,
    title,
    created: day(6, 0, 9),
    assignedTo,
    events: past(events)
  })
}

/**
 * Uma situação por item na Daily: entregue no prazo, entregue com estouro, em
 * andamento dentro do estimado, em andamento além do estimado, projeção que
 * passa do fim da sprint, não iniciado que já não cabe e sem estimativa.
 */
const sprint6: FakeWorkItem[] = [
  current(
    LOJA,
    10601,
    'Checkout em uma etapa',
    5,
    [
      [day(6, 1, 9), { state: 'Committed' }],
      [day(6, 2, 17), { state: 'Done' }]
    ],
    PEOPLE.bruno
  ),
  current(
    LOJA,
    10602,
    'Cupom de primeira compra',
    2,
    [
      [day(6, 1, 9), { state: 'Committed' }],
      [day(6, 3, 15), { state: 'Done' }]
    ],
    PEOPLE.carla
  ),
  current(
    LOJA,
    10603,
    'Frete por região',
    3,
    [[day(6, 4, 14), { state: 'Committed' }]],
    PEOPLE.diego
  ),
  current(
    LOJA,
    10604,
    'Avaliações de produto',
    3,
    [[day(6, 2, 9), { state: 'Committed' }]],
    PEOPLE.carla
  ),
  current(LOJA, 10605, 'Busca por voz', 8, [[day(6, 7, 8), { state: 'Committed' }]], PEOPLE.bruno),
  current(LOJA, 10606, 'Lista de desejos', 8, [], PEOPLE.ana),
  current(LOJA, 10607, 'Ajuste de layout no rodapé', null, [], PEOPLE.diego),
  sprintTask(LOJA, 10611, 10603, 'Tabela de frete', PEOPLE.diego, [
    [day(6, 4, 14), { state: 'In Progress' }],
    [day(6, 4, 17), { state: 'Done' }]
  ]),
  sprintTask(LOJA, 10612, 10603, 'Cálculo no carrinho', PEOPLE.diego, [
    [day(6, 7, 8), { state: 'In Progress' }]
  ]),
  sprintTask(LOJA, 10613, 10604, 'Formulário de avaliação', PEOPLE.carla, [
    [day(6, 2, 9), { state: 'In Progress' }]
  ]),
  sprintTask(LOJA, 10614, 10604, 'Moderação', PEOPLE.ana, []),
  sprintTask(LOJA, 10615, 10605, 'Reconhecimento de fala', PEOPLE.bruno, [
    [day(6, 7, 8), { state: 'In Progress' }]
  ]),
  item(LOJA, {
    id: 10651,
    type: 'Bug',
    title: 'Pagamento duplicado no cartão',
    iteration: S6,
    created: day(6, 1, 10),
    assignedTo: PEOPLE.bruno,
    fields: { [CRITICIDADE]: 'Alta - SLA 16h', [DUE_DATE]: day(6, 2, 17) },
    events: [[day(6, 1, 11), { state: 'Committed' }]]
  }),
  item(LOJA, {
    id: 10652,
    type: 'Bug',
    title: 'Foto do produto não carrega',
    iteration: S6,
    created: day(6, 3, 9),
    assignedTo: PEOPLE.carla,
    fields: { [CRITICIDADE]: 'Média - SLA 40h', [DUE_DATE]: day(6, 7, 17) },
    events: [
      [day(6, 3, 10), { state: 'Committed' }],
      [day(6, 4, 15), { state: 'Done' }]
    ]
  }),
  item(LOJA, {
    id: 10653,
    type: 'Bug',
    title: 'Ícone desalinhado no menu',
    iteration: S6,
    created: day(6, 4, 11),
    fields: { [CRITICIDADE]: 'Baixa' }
  }),
  current(
    APP,
    20601,
    'Histórico de compras',
    3,
    [
      [day(6, 1, 9), { state: 'Committed' }],
      [day(6, 3, 12), { state: 'Done' }]
    ],
    PEOPLE.ana
  ),
  current(
    APP,
    20602,
    'Pagamento com carteira digital',
    5,
    [[day(6, 4, 9), { state: 'Committed' }]],
    PEOPLE.diego
  ),
  current(APP, 20603, 'Tela de boas-vindas', 2, [], PEOPLE.ana),
  item(APP, {
    id: 20651,
    type: 'Bug',
    title: 'App fecha ao girar a tela',
    iteration: S6,
    created: day(6, 2, 9),
    assignedTo: PEOPLE.diego,
    fields: { [CRITICIDADE]: 'Alta - SLA 16h', [DUE_DATE]: day(6, 3, 17) },
    events: [
      [day(6, 2, 10), { state: 'Committed' }],
      [day(6, 3, 11), { state: 'Done' }]
    ]
  })
]

// ─── Sprint 7, por planejar ──────────────────────────────────────────────────

const S7 = sprintPath(7)

function next(
  product: Product,
  id: number,
  title: string,
  effort: number,
  description: string
): FakeWorkItem {
  return item(product, {
    id,
    title,
    iteration: S7,
    created: day(6, 1, 14),
    fields: { ...effortFields(effort), [DESCRIPTION]: `<p>${description}</p>` },
    events: [[day(6, 3, 15), { state: 'Approved' }]]
  })
}

const sprint7: FakeWorkItem[] = [
  next(
    LOJA,
    10701,
    'Pagamento parcelado no Pix',
    5,
    'Como cliente, quero parcelar a compra no Pix para pagar sem cartão de crédito.'
  ),
  next(
    LOJA,
    10702,
    'Rastreio do pedido',
    3,
    'Como cliente, quero acompanhar a entrega do pedido sem sair da loja.'
  ),
  next(
    LOJA,
    10703,
    'Recomendações na página inicial',
    8,
    'Mostrar produtos parecidos com os que o cliente já comprou.'
  ),
  next(
    APP,
    20701,
    'Entrar com biometria',
    5,
    'Como cliente, quero entrar no app com a digital, sem digitar a senha.'
  ),
  next(
    APP,
    20702,
    'Aviso de pedido enviado',
    2,
    'Avisar o cliente quando o pedido sair para entrega.'
  )
]

export const vitrine: Scenario = {
  id: 'vitrine',
  titulo: 'Vitrine para a demonstração e os prints',
  prova:
    'Um Grupo com Loja Online e App Mobile no mesmo projeto, separados por área: cinco sprints ' +
    'de histórico com item que não cabe e vai para a seguinte, escopo injetado, retrabalho e ' +
    'bugs com criticidade; a sprint 6 em andamento com um item em cada situação da Daily ' +
    '(entregue, estouro, dentro, projeção além da sprint, sem estimativa) e a sprint 7 com ' +
    'itens descritos e com esforço por disciplina para o Planning e o pedido à IA. É o Cenário ' +
    'do Perfil de demonstração.',
  regras: [
    'RN-GLB-01',
    'RN-GLB-02',
    'RN-GLB-15',
    'RN-ENT-01',
    'RN-ENT-08',
    'RN-BUG-02',
    'RN-DLY-01'
  ],
  telas: ['entregas', 'bugs', 'desempenho', 'daily', 'planning', 'pedido-ia', 'home'],
  anchorDate: ANCHOR,
  config: baseConfig({
    products: [
      LOJA_PRODUCT,
      {
        id: 'app',
        name: 'App Mobile',
        color: '#2f6fed',
        project: LOJA_PROJECT,
        areaPaths: [APP_AREA],
        processProfile: 'scrum'
      }
    ],
    groups: [{ id: 'digital', name: 'Digital', color: '#0e9f6e', products: ['loja', 'app'] }],
    customFields: {
      reworkCount: RETRABALHO,
      criticality: CRITICIDADE,
      effortFrontend: FRONT,
      effortBackend: BACK,
      effortQa: QA
    },
    criticality: [
      { name: 'Alta', matches: ['alta'], color: '#d92d20' },
      { name: 'Média', matches: ['média'], color: '#f79009' },
      { name: 'Baixa', matches: ['baixa'], color: '#12b76a' }
    ]
  }),
  selections: ['digital', 'loja', 'app'],
  azure: azure(
    [
      lojaProject({
        customFields: [
          { name: 'Retrabalho', referenceName: RETRABALHO, type: 'integer' },
          { name: 'Criticidade', referenceName: CRITICIDADE, type: 'string' },
          { name: 'Esforço Frontend', referenceName: FRONT, type: 'double' },
          { name: 'Esforço Backend', referenceName: BACK, type: 'double' },
          { name: 'Esforço QA', referenceName: QA, type: 'double' }
        ]
      })
    ],
    [
      ...[1, 2, 3, 4, 5].flatMap((sprint) => [
        ...historyItems(LOJA, sprint),
        ...historyItems(APP, sprint)
      ]),
      ...sprint6,
      ...sprint7
    ]
  )
}
