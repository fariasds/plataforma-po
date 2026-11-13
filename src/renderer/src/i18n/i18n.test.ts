import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatDateTime, formatHours, formatList, formatNumber, t, tPlural } from './index'
import { ptBR } from './pt-BR'
import { tRich } from './rich'

function leaves(node: unknown, path = ''): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [[path, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, path ? `${path}.${key}` : key)
  )
}

describe('dicionário', () => {
  it('só tem textos preenchidos', () => {
    for (const [path, value] of leaves(ptBR)) {
      expect(typeof value, path).toBe('string')
      expect(value, path).not.toBe('')
    }
  })

  it('todo plural tem singular e plural', () => {
    const paths = leaves(ptBR).map(([path]) => path)
    for (const path of paths.filter((p) => p.endsWith('.one'))) {
      expect(paths).toContain(path.replace(/\.one$/, '.other'))
    }
  })
})

describe('t', () => {
  it('devolve o texto da chave', () => {
    expect(t('actions.back')).toBe('Voltar')
  })

  it('preenche as variáveis', () => {
    expect(t('help.ruleLabel', { rule: 'RN-ENT-04' })).toBe('Regra RN-ENT-04')
    expect(t('daily.estimate', { points: 5, days: 3 })).toBe('5 SP · 3 dias')
  })
})

describe('tPlural', () => {
  it('só 1 é singular', () => {
    expect(tPlural('common.itemCount', 0)).toBe('0 itens')
    expect(tPlural('common.itemCount', 1)).toBe('1 item')
    expect(tPlural('common.itemCount', 2)).toBe('2 itens')
  })

  it('aceita variáveis além da contagem', () => {
    expect(
      tPlural('daily.holidayNotice', 1, { days: '3', sprintDays: 10, workingDays: 9 })
    ).toContain('no dia 3 da sprint')
  })
})

describe('tRich', () => {
  const html = (node: React.ReactNode): string =>
    renderToStaticMarkup(createElement(Fragment, null, node))

  it('converte a marcação em elementos', () => {
    expect(html(tRich('pat.stepNewToken'))).toBe('Clique em <b>New Token</b>.')
  })

  it('aceita elemento como variável, inclusive dentro da marcação', () => {
    expect(
      html(tRich('pat.stepOpenUrl', { url: createElement('code', null, 'https://x') }))
    ).toBe('Abra no navegador a página de tokens da organização: <code>https://x</code>')
    expect(html(tRich('daily.dayOf', { current: 3, total: 10, remaining: 7 }))).toBe(
      'dia <b>3</b> de 10 · restam 7'
    )
  })
})

describe('formatação', () => {
  it('hora cheia sem decimal, quebrada com uma casa e vírgula', () => {
    expect(formatHours(8)).toBe('8h')
    expect(formatHours(7.5)).toBe('7,5h')
    expect(formatHours(1234)).toBe('1234h')
  })

  it('número com casas fixas', () => {
    expect(formatNumber(1.25, 1)).toMatch(/^1,[23]$/)
    expect(formatNumber(2, 1)).toBe('2,0')
  })

  it('data e hora no fuso da máquina', () => {
    expect(formatDateTime(new Date(2026, 9, 2, 7, 5).toISOString())).toBe('02/10/2026 07:05')
  })

  it('lista com conjunção', () => {
    expect(formatList(['A', 'B', 'C'])).toBe('A, B e C')
  })
})
