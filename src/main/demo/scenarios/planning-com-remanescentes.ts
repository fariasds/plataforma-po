import { planningKeys } from '@shared/planning-keys'
import { PEOPLE, azure, baseConfig, type HistoryEvent } from '../builders'
import type { FakeWorkItem, Scenario } from '../types'
import {
  DESCRIPTION,
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
/** Chave da Sprint unificada da sprint 4, que o Planning abre no sábado anterior. */
const S4_KEY = '2026-10-05_2026-10-16'

const FRONT = 'Contoso.EsforcoFrontend'
const BACK = 'Contoso.EsforcoBackend'
const QA = 'Contoso.EsforcoQA'

/**
 * Um token com a forma de PAT clássico do Azure (52 caracteres de `a-z2-7`),
 * montado em tempo de execução para o texto nunca existir no repositório. Ele
 * vai na descrição de um item e precisa sair redigido do pedido à IA (RN-SEC-24).
 */
export const FAKE_TOKEN = Array.from(
  { length: 52 },
  (_, i) => 'abcdefghijklmnopqrstuvwxyz234567'[(i * 7 + 3) % 32]
).join('')

function planned(
  id: number,
  title: string,
  effort: { front?: number; back?: number; qa?: number; total?: number },
  extra: { priority?: number; description?: string; state?: string } = {}
): FakeWorkItem {
  const events: HistoryEvent[] = [['2026-10-01T15:00:00', { iteration: S4, state: 'Approved' }]]
  if (extra.state) events.push(['2026-10-02T10:00:00', { state: extra.state }])
  return lojaItem({
    id,
    title,
    iteration: LOJA_PROJECT,
    created: '2026-09-22T09:00:00',
    assignedTo: PEOPLE.diego,
    fields: {
      ...(effort.front !== undefined ? { [FRONT]: effort.front } : {}),
      ...(effort.back !== undefined ? { [BACK]: effort.back } : {}),
      ...(effort.qa !== undefined ? { [QA]: effort.qa } : {}),
      ...(effort.total !== undefined ? { [EFFORT]: effort.total } : {}),
      ...(extra.priority !== undefined ? { [PRIORITY]: extra.priority } : {}),
      ...(extra.description ? { [DESCRIPTION]: extra.description } : {})
    },
    events
  })
}

export const planningComRemanescentes: Scenario = {
  id: 'planning-com-remanescentes',
  titulo: 'Planning com remanescentes, desmarcados e reserva de bugs',
  prova:
    'No sábado entre duas sprints, o Planning abre a próxima. Somam-se os itens do Azure e os ' +
    'remanescentes que o PO puxou da sprint anterior, com o percentual que sobrou de cada ' +
    'disciplina; o item desmarcado sai das somas e aparece à parte no resumo; a capacidade ' +
    'desconta a reserva de bugs, aqui gravada no formato antigo de percentual único; o item ' +
    'removido e o bug não entram. O pedido à IA leva só os campos permitidos, com a descrição ' +
    'em texto e o token fictício redigido.',
  regras: [
    'RN-PLN-01',
    'RN-PLN-02',
    'RN-PLN-03',
    'RN-PLN-04',
    'RN-PLN-10',
    'RN-PLN-12',
    'RN-PLN-15',
    'RN-PLN-16',
    'RN-PLN-17',
    'RN-PLN-18',
    'RN-PLN-20',
    'RN-PLN-21',
    'RN-SEC-24'
  ],
  telas: ['planning', 'pedido-ia', 'sprint-unificada'],
  anchorDate: '2026-10-03T10:00:00',
  config: baseConfig({
    products: [LOJA_PRODUCT],
    customFields: { effortFrontend: FRONT, effortBackend: BACK, effortQa: QA }
  }),
  selections: ['loja'],
  workData: {
    [planningKeys.manual('loja', S4_KEY)]: [
      {
        id: 7101,
        title: 'Recomendação de produtos',
        state: 'Committed',
        product: 'loja',
        frontend: 1.5,
        backend: 4,
        qa: 1,
        priority: 1,
        total: 6.5,
        frontendPercent: 50,
        backendPercent: 100
      },
      {
        id: 7102,
        title: 'Histórico de pedidos',
        state: 'Committed',
        product: 'loja',
        frontend: 0.5,
        backend: 0,
        qa: 1,
        priority: 2,
        total: 1.5,
        frontendPercent: 25,
        backendPercent: 0
      }
    ],
    [planningKeys.unchecked(S4_KEY)]: [7004],
    [planningKeys.capacity]: { frontDevs: 1.5, sprintDays: 9, bugPercent: 25 },
    [planningKeys.goal('loja', S4_KEY)]:
      'Objetivo: Permitir que o cliente acompanhe o pedido sem falar com o suporte\n' +
      'Impacto: menos chamados sobre entrega\n' +
      'Como saberemos:\n' +
      '- o status aparece na página do pedido'
  },
  azure: azure(
    [
      lojaProject({
        customFields: [
          { name: 'Esforço Frontend', referenceName: FRONT, type: 'double' },
          { name: 'Esforço Backend', referenceName: BACK, type: 'double' },
          { name: 'Esforço QA', referenceName: QA, type: 'double' }
        ]
      })
    ],
    [
      planned(
        7001,
        'Status do pedido na página',
        { front: 3, back: 2, qa: 1, total: 6 },
        {
          priority: 1,
          description:
            '<div><b>Como</b> cliente, <i>quero</i> ver o status do pedido.</div>' +
            `<p>Token de teste colado por engano: ${FAKE_TOKEN}</p>` +
            '<ul><li>Mostrar data prevista</li><li>Atualizar a cada mudança</li></ul>'
        }
      ),
      planned(
        7002,
        'Notificar atraso na entrega',
        { front: 1, back: 3, qa: 1, total: 5 },
        {
          priority: 2,
          description: '<p>Enviar e-mail quando a entrega atrasar mais de 1 dia.</p>'
        }
      ),
      planned(
        7003,
        'Ajuste de layout do rastreio',
        { front: 2, qa: 0.5, total: 2.5 },
        { priority: 2 }
      ),
      // Desmarcado pelo PO: sai das somas, aparece à parte no resumo.
      planned(
        7004,
        'Mapa da rota de entrega',
        { front: 5, back: 5, qa: 2, total: 12 },
        { priority: 3 }
      ),
      // Sem prioridade e sem esforço: vai para o fim e soma zero.
      planned(7005, 'Pesquisa de satisfação pós-entrega', {}),
      // Removido: fora do Planning.
      planned(7006, 'Rastreio por SMS', { front: 1, back: 1, total: 2 }, { state: 'Removed' }),
      // Bug na sprint: o Planning só olha os tipos planejáveis.
      lojaItem({
        id: 7007,
        type: 'Bug',
        title: 'Status some depois de entregue',
        iteration: S4,
        created: '2026-10-02T09:00:00'
      }),
      // Remanescentes da sprint 3, puxados pelo ID.
      lojaItem({
        id: 7101,
        title: 'Recomendação de produtos',
        iteration: S3,
        created: '2026-09-10T09:00:00',
        fields: { [FRONT]: 3, [BACK]: 4, [QA]: 1, [EFFORT]: 8, [PRIORITY]: 1 },
        events: [['2026-09-22T09:00:00', { state: 'Committed' }]]
      }),
      lojaItem({
        id: 7102,
        title: 'Histórico de pedidos',
        iteration: S3,
        created: '2026-09-10T09:00:00',
        fields: { [FRONT]: 2, [BACK]: 3, [QA]: 1, [EFFORT]: 6, [PRIORITY]: 2 },
        events: [['2026-09-23T09:00:00', { state: 'Committed' }]]
      })
    ]
  )
}
