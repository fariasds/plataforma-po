import { PEOPLE, azure, baseConfig } from '../builders'
import type { FakeWorkItem, Scenario } from '../types'
import { DUE_DATE, LOJA_PRODUCT, lojaItem, lojaProject, lojaSprint } from './comum'

const CRITICIDADE = 'Contoso.Criticidade'
/** Listado na Configuração, mas inexistente no projeto: é ignorado (RN-BUG-05). */
const SEVERIDADE = 'Contoso.Severidade'

function bug(
  id: number,
  title: string,
  sprint: number,
  created: string,
  events: Parameters<typeof lojaItem>[0]['events'],
  fields: { criticidade?: string; due?: string } = {}
): FakeWorkItem {
  return lojaItem({
    id,
    type: 'Bug',
    title,
    iteration: lojaSprint(sprint),
    created,
    assignedTo: PEOPLE.bruno,
    events,
    fields: {
      ...(fields.criticidade ? { [CRITICIDADE]: fields.criticidade } : {}),
      ...(fields.due ? { [DUE_DATE]: fields.due } : {})
    }
  })
}

export const bugsComCriticidade: Scenario = {
  id: 'bugs-com-criticidade',
  titulo: 'Bugs com criticidade e SLA',
  prova:
    'Com o campo de criticidade configurado, o bug cai no nível pelo prefixo do valor, sem ' +
    'diferenciar maiúsculas; o SLA compara o fechamento com o Due Date do próprio bug. Prova o ' +
    'bug fechado no prazo, o fechado fora, o reaberto (vale o último fechamento), o ativo com ' +
    'prazo vencido, o sem criticidade ("Não informado"), o valor que não casa com nenhum nível ' +
    '(fora do SLA), o removido (fora de tudo), a reincidência pelo marcador no título e um ' +
    'segundo campo de criticidade que não existe no projeto e é ignorado.',
  regras: [
    'RN-BUG-01',
    'RN-BUG-02',
    'RN-BUG-04',
    'RN-BUG-05',
    'RN-BUG-17',
    'RN-DES-03',
    'RN-DES-05'
  ],
  telas: ['bugs', 'desempenho'],
  anchorDate: '2026-10-08T15:00:00',
  config: baseConfig({
    products: [LOJA_PRODUCT],
    customFields: { criticality: [CRITICIDADE, SEVERIDADE] },
    criticality: [
      { name: 'Alta', matches: ['alta'], color: '#d92d20' },
      { name: 'Média', matches: ['média', 'media'], color: '#f79009' },
      { name: 'Baixa', matches: ['baixa'], color: '#12b76a' }
    ],
    recurrentBugTag: '[reincidente]'
  }),
  selections: ['loja'],
  azure: azure(
    [
      lojaProject({
        customFields: [{ name: 'Criticidade', referenceName: CRITICIDADE, type: 'string' }]
      })
    ],
    [
      bug(
        5001,
        'Pagamento recusado com cartão válido',
        3,
        '2026-09-22T09:00:00',
        [
          ['2026-09-22T10:00:00', { state: 'Committed' }],
          ['2026-09-23T15:00:00', { state: 'Done' }]
        ],
        { criticidade: 'Alta - SLA 16h', due: '2026-09-23T17:00:00' }
      ),
      bug(
        5002,
        'Estoque negativo após cancelamento',
        3,
        '2026-09-24T10:00:00',
        [
          ['2026-09-24T11:00:00', { state: 'Approved' }],
          ['2026-09-28T09:00:00', { state: 'Committed' }],
          ['2026-09-29T16:00:00', { state: 'Done' }]
        ],
        { criticidade: 'ALTA - SLA 16h', due: '2026-09-25T12:00:00' }
      ),
      // Reaberto: o ClosedDate é o do último fechamento.
      bug(
        5003,
        'Nota fiscal com CNPJ errado',
        3,
        '2026-09-28T09:00:00',
        [
          ['2026-09-28T10:00:00', { state: 'Committed' }],
          ['2026-09-30T15:00:00', { state: 'Done' }],
          ['2026-10-05T09:00:00', { state: 'Committed' }],
          ['2026-10-06T14:00:00', { state: 'Done' }]
        ],
        { criticidade: 'Média - SLA 40h', due: '2026-10-02T17:00:00' }
      ),
      // Ativo, sem criticidade.
      bug(5004, 'Ícone desalinhado no menu', 4, '2026-10-05T10:00:00', [
        ['2026-10-05T11:00:00', { state: 'Approved' }]
      ]),
      // Ativo, reincidente e com prazo vencido.
      bug(
        5005,
        '[reincidente] Cache do catálogo desatualizado',
        4,
        '2026-10-06T09:00:00',
        [['2026-10-06T10:00:00', { state: 'Committed' }]],
        { criticidade: 'baixa', due: '2026-10-07T17:00:00' }
      ),
      // Sprint anterior, reincidente com outra caixa.
      bug(
        5006,
        '[Reincidente] Timeout no pagamento',
        2,
        '2026-09-08T09:00:00',
        [
          ['2026-09-08T10:00:00', { state: 'Committed' }],
          ['2026-09-10T11:00:00', { state: 'Done' }]
        ],
        { criticidade: 'Alta - SLA 16h', due: '2026-09-09T17:00:00' }
      ),
      // Removido: fora de todas as contagens.
      bug(
        5007,
        'Duplicado do 5002',
        3,
        '2026-09-29T09:00:00',
        [['2026-09-29T10:00:00', { state: 'Removed' }]],
        { criticidade: 'Alta - SLA 16h' }
      ),
      // Valor que não casa com nenhum nível: aparece na quebra, fica fora do SLA.
      bug(
        5008,
        'Lentidão na busca',
        3,
        '2026-09-25T09:00:00',
        [
          ['2026-09-25T10:00:00', { state: 'Committed' }],
          ['2026-10-01T10:00:00', { state: 'Done' }]
        ],
        { criticidade: 'Crítica - SLA 8h', due: '2026-09-25T17:00:00' }
      ),
      // Agosto, fechado no prazo: só aparece na visão por mês.
      bug(
        5009,
        'Carrinho vazio após login',
        1,
        '2026-08-26T09:00:00',
        [
          ['2026-08-26T10:00:00', { state: 'Committed' }],
          ['2026-08-27T11:00:00', { state: 'Done' }]
        ],
        { criticidade: 'Média', due: '2026-08-28T17:00:00' }
      )
    ]
  )
}
