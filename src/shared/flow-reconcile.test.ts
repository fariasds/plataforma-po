import { describe, expect, it } from 'vitest'
import { parseFeatureFolder } from './flow-artifacts'
import {
  matchTitle,
  normalizeTitle,
  reconcileDraft,
  reconcilePlan,
  setPlanAzureId,
  setReadmeFeatureId,
  titleSimilarity
} from './flow-reconcile'
import type { SnapshotFeature, SnapshotItem } from './flow-snapshot'

// RN-FLX-12, RN-FLX-13. Dados fictícios: organização `contoso`, Produto "Loja Online".

function child(id: number, title: string): SnapshotItem {
  return { id, type: 'Product Backlog Item', title, state: 'New', parentId: 4102 }
}

describe('títulos', () => {
  it('normaliza maiúscula, acento, pontuação e espaço', () => {
    expect(normalizeTitle('  Expirar o PEDIDO — quando o Pix não é pago! ')).toBe(
      'expirar o pedido quando o pix nao e pago'
    )
  })

  it('parecido: as palavras do título menor quase todas no maior', () => {
    expect(
      titleSimilarity(
        'Cliente não sabe quanto tempo tem para pagar o Pix — checkout',
        'Cliente não sabe quanto tempo tem para pagar o Pix'
      )
    ).toBe(1)
    expect(titleSimilarity('Gerar o QR Code Pix', 'Liberar o pedido pago')).toBe(0)
  })
})

describe('matchTitle', () => {
  const items = [
    child(4211, 'Gerar o QR Code Pix no checkout'),
    child(4213, 'Expirar o pedido quando o Pix não é pago no prazo'),
    child(4214, 'Cliente não sabe quanto tempo tem para pagar o Pix')
  ]

  it('igual vale antes de parecido', () => {
    expect(matchTitle('Expirar o pedido quando o Pix não é pago no prazo', items)).toMatchObject({
      match: 'exact',
      candidates: [{ id: 4213 }]
    })
  })

  it('parecido, quando o PO encurtou o título ao colar', () => {
    expect(
      matchTitle('Cliente não sabe quanto tempo tem para pagar o Pix — checkout', items)
    ).toMatchObject({ match: 'similar', candidates: [{ id: 4214 }] })
  })

  it('dois iguais ficam para o PO escolher', () => {
    const twins = [child(1, 'Mostrar o cupom'), child(2, 'mostrar o cupom.')]
    expect(matchTitle('Mostrar o cupom', twins)).toMatchObject({
      match: 'ambiguous',
      candidates: [{ id: 1 }, { id: 2 }]
    })
  })

  it('nada parecido: nenhum candidato', () => {
    expect(matchTitle('Cobrar frete por região', items)).toEqual({ match: 'none', candidates: [] })
  })
})

describe('reconcilePlan', () => {
  const folder = parseFeatureFolder({
    slug: 'pix',
    files: ['README.md', 'plano-pbis.md'],
    readme: '# Pix\nFeature: #4102\n',
    brief: null,
    decisions: null,
    plan: [
      '### P1 · DEV · Gerar o QR Code Pix no checkout',
      'Azure: #4211 · Status: Escrito',
      '### P2 · DEV · Gerar o QR Code Pix no checkout de novo',
      'Azure: #a criar · Status: Planejado',
      '### P3 · DEV · Expirar o pedido quando o Pix não é pago no prazo',
      'Azure: — · Status: Cancelado'
    ].join('\n')
  })

  it('só PBI ativo sem ID; filho já usado por outro PBI não é candidato', () => {
    const result = reconcilePlan(folder, [
      child(4211, 'Gerar o QR Code Pix no checkout'),
      child(4213, 'Expirar o pedido quando o Pix não é pago no prazo')
    ])
    expect(result).toEqual([
      { pbi: 'P2', title: 'Gerar o QR Code Pix no checkout de novo', match: 'none', candidates: [] }
    ])
  })
})

describe('reconcileDraft', () => {
  const feature = (id: number, title: string): SnapshotFeature => ({
    id,
    type: 'Feature',
    title,
    state: 'New',
    parentId: null,
    priority: null,
    createdDate: '',
    stateChangeDate: null,
    childIds: []
  })

  it('o rascunho encontra a Feature aberta sem pasta, pelo título do README', () => {
    const draft = parseFeatureFolder({
      slug: 'retirada',
      files: ['README.md'],
      readme: '# Retirada na loja\nFeature: #a criar\n',
      brief: null,
      decisions: null,
      plan: null
    })
    const features = [feature(4120, 'Retirada na loja'), feature(4121, 'Retirada na loja')]
    expect(reconcileDraft(draft, features, new Set([4121]))).toMatchObject({
      match: 'exact',
      candidates: [{ id: 4120 }]
    })
  })
})

describe('a edição do arquivo', () => {
  const PLAN = [
    '### P1 · DEV · Gerar o QR',
    'Azure: #4211 · Status: Escrito',
    '',
    '### P3 · DEV · Expirar o pedido',
    'Azure: #a criar · Status: Planejado (falta o design) · Arquivo: —',
    'Requisitos: R2'
  ].join('\r\n')

  it('troca só o começo da linha Azure: do PBI, e preserva o CRLF', () => {
    const next = setPlanAzureId(PLAN, 'P3', 4213)!
    expect(next.split('\r\n')).toEqual([
      '### P1 · DEV · Gerar o QR',
      'Azure: #4211 · Status: Escrito',
      '',
      '### P3 · DEV · Expirar o pedido',
      'Azure: #4213 · Status: Planejado (falta o design) · Arquivo: —',
      'Requisitos: R2'
    ])
  })

  it('PBI que não existe, ou sem a linha Azure:, não muda nada', () => {
    expect(setPlanAzureId(PLAN, 'P9', 1)).toBeNull()
    expect(
      setPlanAzureId('### P1 · DEV · X\nRequisitos: R1\n### P2 · DEV · Y\nAzure: #a criar', 'P1', 1)
    ).toBeNull()
  })

  it('o README troca "#a criar" pelo ID e mantém o resto da linha', () => {
    expect(
      setReadmeFeatureId('# Retirada\nFeature: #a criar — pedido da área comercial\n', 4120)
    ).toBe('# Retirada\nFeature: #4120 — pedido da área comercial\n')
    expect(setReadmeFeatureId('# Retirada\nFeature: #4120\n', 9)).toBeNull()
  })
})
