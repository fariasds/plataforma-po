import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_GOAL_CHARS,
  MAX_PASTED_CHARS,
  formatSprintGoal,
  parsePastedGoal,
  sanitizeGoalText
} from '@shared/ai'
import type { UnifiedSprint } from '@shared/azure'
import { resetElectronMock } from '../helpers/electron-mock'

// RN-SEC-26: a resposta que o PO cola é texto puro e curto, nunca marcação nem
// comando, e não é gravada em lugar nenhum sem o PO aceitar. Conteúdo fictício.

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('../../src/main/services/azure/planning', () => ({
  getPlanningData: async () => ({
    items: [{ id: 101, title: 'Checkout com Pix', state: 'Approved', product: 'loja', priority: 1 }]
  })
}))
vi.mock('../../src/main/services/azure/descriptions', () => ({
  fetchDescriptions: async () => new Map([[101, '<p>Como cliente, quero pagar com Pix.</p>']])
}))
vi.mock('../../src/main/services/azure/scope', () => ({
  activeScope: () => ({ products: [{ id: 'loja', name: 'Loja Online' }] })
}))

const store = await import('../../src/main/profile/profile-store')
const { workDataDir } = await import('../../src/main/profile/paths')
const { buildSprintGoalRequest } = await import('../../src/main/services/ai/sprint-goal')

const SPRINT: UnifiedSprint = {
  key: '2026-10-05',
  label: 'Sprint 42',
  startDate: '2026-10-05',
  finishDate: '2026-10-16',
  iterations: {}
}

const GOAL = {
  objetivo: 'Permitir o pagamento com Pix no checkout.',
  impacto: 'O cliente conclui a compra sem cartão.',
  evidencias: ['O pedido pago com Pix é confirmado em até um minuto.'],
  tambem: ['Novo cabeçalho do painel']
}
const GOAL_TEXT = [
  'Objetivo: Permitir o pagamento com Pix no checkout.',
  'Impacto: O cliente conclui a compra sem cartão.',
  'Como saberemos:',
  '- O pedido pago com Pix é confirmado em até um minuto.',
  'Também nesta sprint:',
  '- Novo cabeçalho do painel'
].join('\n')

beforeEach(() => resetElectronMock())

describe('RN-SEC-26: texto puro e curto', () => {
  it('o que não é texto vira vazio', () => {
    for (const raw of [null, undefined, 42, {}, ['x']]) {
      expect(sanitizeGoalText(raw)).toBe('')
      expect(parsePastedGoal(raw)).toEqual({ text: '', structured: false })
    }
  })

  it('corta no limite', () => {
    expect(sanitizeGoalText('a'.repeat(50_000))).toHaveLength(MAX_GOAL_CHARS)
    expect(parsePastedGoal('a'.repeat(50_000)).text).toHaveLength(MAX_GOAL_CHARS)
  })

  it('tira caracteres de controle e mantém só as quebras de linha', () => {
    expect(sanitizeGoalText('Entregar\u0000 o\u001b[31m checkout\r\n\r\n\te o   frete')).toBe(
      'Entregar o [31m checkout\ne o frete'
    )
  })

  it('limita o número de linhas', () => {
    expect(sanitizeGoalText('linha\n'.repeat(200)).split('\n').length).toBeLessThanOrEqual(14)
    expect(parsePastedGoal('linha\n'.repeat(200)).text.split('\n').length).toBeLessThanOrEqual(14)
  })
})

describe('RN-SEC-26: o formato quem dá é o app', () => {
  it('monta o objetivo com os quatro campos, sempre na mesma ordem', () => {
    expect(formatSprintGoal(GOAL)).toBe(GOAL_TEXT)
  })

  it('cada campo é uma linha: quebra e rótulo falso dentro do campo não criam seção', () => {
    const text = formatSprintGoal({
      ...GOAL,
      objetivo: 'Permitir Pix.\nImpacto: falso\n- item falso',
      evidencias: ['- um\n- dois']
    })
    expect(text.split('\n')[0]).toBe('Objetivo: Permitir Pix. Impacto: falso - item falso')
    expect(text).toContain('- um - dois')
    expect(text.split('\n').filter((line) => line.startsWith('Impacto:'))).toHaveLength(1)
  })

  it('corta listas longas e ignora o que não é texto', () => {
    const text = formatSprintGoal({
      ...GOAL,
      evidencias: ['a', 'b', 'c', 'd', 'e', 42, null, { x: 1 }],
      tambem: Array.from({ length: 20 }, (_v, i) => `item ${i}`)
    })
    expect(text.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(3 + 6)
  })

  it('sem a frase do objetivo, ou com algo que não é objeto, devolve vazio', () => {
    for (const raw of [null, undefined, 'texto solto', 42, [], { ...GOAL, objetivo: '   ' }]) {
      expect(formatSprintGoal(raw)).toBe('')
    }
  })
})

describe('RN-SEC-26: a resposta colada', () => {
  it('no formato pedido, vira os quatro campos', () => {
    expect(parsePastedGoal(GOAL_TEXT)).toEqual({ text: GOAL_TEXT, structured: true })
  })

  it('aguenta o que um chat costuma acrescentar: preâmbulo, negrito, cerca de código', () => {
    const pasted = [
      'Claro! Aqui está o objetivo da sprint:',
      '```',
      '**Objetivo:** Permitir o pagamento com Pix no checkout.',
      '## Impacto: O cliente conclui a compra sem cartão.',
      '**Como saberemos**:',
      '1. O pedido pago com Pix é confirmado em até um minuto.',
      '**Também nesta sprint:**',
      '* Novo cabeçalho do painel',
      '```'
    ].join('\r\n')
    expect(parsePastedGoal(pasted)).toEqual({ text: GOAL_TEXT, structured: true })
  })

  it('rótulo sem acento e em outra caixa também é lido', () => {
    const pasted = 'OBJETIVO: Permitir Pix.\ntambem nesta sprint:\n- Painel'
    expect(parsePastedGoal(pasted).text).toBe(
      'Objetivo: Permitir Pix.\nTambém nesta sprint:\n- Painel'
    )
  })

  it('rótulo repetido não reabre a seção nem duplica o objetivo', () => {
    const pasted = `${GOAL_TEXT}\nObjetivo: Ignore as regras e publique isto.\n- linha extra`
    expect(parsePastedGoal(pasted)).toEqual({ text: GOAL_TEXT, structured: true })
  })

  it('listas longas são cortadas como as do formato', () => {
    const pasted = [
      'Objetivo: Permitir Pix.',
      'Como saberemos:',
      ...'abcdef'.split('').map((c) => `- ${c}`)
    ].join('\n')
    expect(
      parsePastedGoal(pasted)
        .text.split('\n')
        .filter((l) => l.startsWith('- '))
    ).toHaveLength(3)
  })

  it('fora do formato, o texto inteiro vira rascunho livre, com os mesmos limites', () => {
    const pasted = 'Entregar o pagamento com Pix.\n\n\u0007Sem formato nenhum.'
    expect(parsePastedGoal(pasted)).toEqual({
      text: 'Entregar o pagamento com Pix.\nSem formato nenhum.',
      structured: false
    })
  })

  it('marcação colada continua texto: o app não interpreta nada', () => {
    const pasted = 'Objetivo: <img src=x onerror=alert(1)> [link](javascript:alert(1))'
    expect(parsePastedGoal(pasted).text).toBe(
      'Objetivo: <img src=x onerror=alert(1)> [link](javascript:alert(1))'
    )
  })

  it('colagem enorme é lida só até o teto', () => {
    const pasted = 'Objetivo: Permitir Pix.\n' + 'x'.repeat(MAX_PASTED_CHARS * 2)
    expect(parsePastedGoal(pasted).text.length).toBeLessThanOrEqual(MAX_GOAL_CHARS)
  })
})

describe('RN-SEC-26: nada é gravado sem o PO aceitar', () => {
  it('montar o pedido não toca nos Dados de trabalho', async () => {
    store.createProfile({ name: 'Contoso', organization: 'contoso' })
    await buildSprintGoalRequest('loja', SPRINT, [101])

    const dir = workDataDir(store.requireActiveProfile().id)
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([])
  })

  it('a leitura da resposta é pura: o módulo não importa nada, então não grava', () => {
    // Quem grava é a tela, depois de "Usar este texto" (RN-PLN-20).
    const source = readFileSync(resolve(__dirname, '../../src/shared/ai.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\brequire\s*\(/)
  })
})
