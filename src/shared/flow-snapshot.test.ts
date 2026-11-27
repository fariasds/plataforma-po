import { describe, expect, it } from 'vitest'
import {
  SNAPSHOT_DESCRIPTION_CHARS,
  SNAPSHOT_DESCRIPTIONS_TOTAL_CHARS,
  flowKeys,
  linkedFeatureIds,
  relationTargetId,
  snapshotDescriptionBudget,
  summarizeSnapshot,
  windowStartDate,
  type FlowSnapshot
} from './flow-snapshot'

// RN-FLX-01, RN-CFG-14. Dados fictícios: organização `contoso`.

const FEATURES = [
  { id: 4102, parentId: 5214 },
  { id: 4088, parentId: null },
  { id: 4140, parentId: 5214 }
]

describe('linkedFeatureIds: o vínculo da Configuração liga o feedback à Feature', () => {
  it('"parent": as Features de que o feedback é pai', () => {
    expect(linkedFeatureIds({ id: 5214, parentId: null, related: [] }, FEATURES, 'parent')).toEqual(
      [4102, 4140]
    )
  })

  it('"child": a Feature que é pai do feedback, se estiver no retrato', () => {
    expect(linkedFeatureIds({ id: 5300, parentId: 4088, related: [] }, FEATURES, 'child')).toEqual([
      4088
    ])
    expect(linkedFeatureIds({ id: 5301, parentId: 9999, related: [] }, FEATURES, 'child')).toEqual(
      []
    )
    expect(linkedFeatureIds({ id: 5302, parentId: null, related: [] }, FEATURES, 'child')).toEqual(
      []
    )
  })

  it('"related": os itens Related que são Features do retrato, sem repetir', () => {
    expect(
      linkedFeatureIds(
        { id: 5220, parentId: 4088, related: [4140, 7777, 4140] },
        FEATURES,
        'related'
      )
    ).toEqual([4140])
  })
})

describe('windowStartDate', () => {
  it('180 dias antes, no fuso da máquina', () => {
    expect(windowStartDate(new Date(2026, 10, 26, 10))).toBe('2026-05-30')
    expect(windowStartDate(new Date(2026, 0, 5), 10)).toBe('2025-12-26')
  })
})

describe('snapshotDescriptionBudget', () => {
  it('cada descrição tem o teto por item, até o total obrigar a dividir', () => {
    expect(snapshotDescriptionBudget(0)).toBe(SNAPSHOT_DESCRIPTION_CHARS)
    expect(snapshotDescriptionBudget(10)).toBe(SNAPSHOT_DESCRIPTION_CHARS)
    expect(snapshotDescriptionBudget(400)).toBe(SNAPSHOT_DESCRIPTIONS_TOTAL_CHARS / 400)
  })
})

describe('relationTargetId', () => {
  it('lê o ID no fim da URL do vínculo', () => {
    expect(relationTargetId('https://dev.azure.com/contoso/_apis/wit/workItems/4211')).toBe(4211)
    expect(relationTargetId('https://dev.azure.com/contoso/_apis/wit/workItems/4211/x')).toBeNull()
    expect(relationTargetId(undefined)).toBeNull()
  })
})

describe('flowKeys', () => {
  it('chave pelo ID do Produto, no alfabeto dos Dados de trabalho (RN-CFG-08)', () => {
    expect(flowKeys.snapshot('Loja_Online')).toBe('flow:snapshot:loja_online')
    expect(flowKeys.snapshot('loja')).toMatch(/^[a-z0-9:_-]{1,120}$/)
  })
})

describe('summarizeSnapshot', () => {
  it('só contagens e a data: nada de título nem descrição', () => {
    const snapshot: FlowSnapshot = {
      version: 1,
      productId: 'loja',
      takenAt: '2026-11-26T13:00:00.000Z',
      windowStart: '2026-05-30',
      priorityField: null,
      features: [],
      children: [],
      feedbacks: null,
      bugs: [
        {
          id: 1,
          type: 'Bug',
          title: 't',
          state: 'New',
          parentId: null,
          createdDate: '',
          closedDate: null,
          open: true,
          description: 'segredo'
        },
        {
          id: 2,
          type: 'Bug',
          title: 't',
          state: 'Done',
          parentId: null,
          createdDate: '',
          closedDate: '',
          open: false,
          description: ''
        }
      ]
    }
    expect(summarizeSnapshot(snapshot)).toEqual({
      productId: 'loja',
      takenAt: '2026-11-26T13:00:00.000Z',
      features: 0,
      children: 0,
      feedbacks: null,
      bugs: 2,
      openBugs: 1
    })
  })
})
