import { describe, expect, it } from 'vitest'
import type { PlanningItem } from '@shared/dashboards'
import {
  buildPlanningSummary,
  summaryToHtml,
  summaryToMarkdown,
  type PlanningSummaryInput,
  type SummaryCell,
  type SummaryTable
} from './planning-summary'

// Resumo do Planning com dados fictícios: organização `contoso`, Grupo "Comércio"
// com os Produtos "Loja Online" e "App Mobile".

function item(
  id: number,
  product: string,
  priority: number | null,
  [frontend, backend, qa]: Array<number | null>,
  title = `Item ${id}`
): PlanningItem {
  return {
    id,
    title,
    state: 'Approved',
    product,
    frontend,
    backend,
    qa,
    total: (frontend ?? 0) + (backend ?? 0) + (qa ?? 0),
    priority
  }
}

const ITEMS = [
  item(202, 'app-mobile', 2, [3, 8, 2], 'Exportar relatório de vendas'),
  item(103, 'loja-online', 3, [3, 5, 2], 'Refatorar serviço de frete'),
  item(101, 'loja-online', 1, [8, 8, 3], 'Checkout: pagamento via Pix'),
  item(201, 'app-mobile', 2, [5, 5, 3], 'Notificação de pedido enviado'),
  item(102, 'loja-online', 1, [3, 5, 2], 'Carrinho perde o cupom')
]

const PRODUCTS = [
  { id: 'loja-online', name: 'Loja Online' },
  { id: 'app-mobile', name: 'App Mobile' }
]

/** Grupo com 103 desmarcado e 102 remanescente; capacidade de 96h e 144h. */
function groupInput(overrides: Partial<PlanningSummaryInput> = {}): PlanningSummaryInput {
  return {
    organization: 'contoso',
    selectionName: 'Comércio',
    sprintLabel: '13 de out. → 24 de out.',
    generatedAt: '11/10/2026 16:40',
    products: PRODUCTS,
    isGroup: true,
    items: ITEMS,
    uncheckedIds: new Set([103]),
    manualIds: new Set([102]),
    effort: { frontend: true, backend: true, qa: true },
    capacity: {
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    },
    productiveHoursPerDay: 6,
    storyPoints: { '1': 3, '2': 6, '3': 12, '5': 24, '8': 36, '13': 60 },
    ...overrides
  }
}

/** A visão de um Produto sozinho: só os itens e a lista dele. */
function productInput(overrides: Partial<PlanningSummaryInput> = {}): PlanningSummaryInput {
  return groupInput({
    selectionName: 'Loja Online',
    products: [PRODUCTS[0]],
    isGroup: false,
    items: ITEMS.filter((i) => i.product === 'loja-online'),
    ...overrides
  })
}

const text = (cell: SummaryCell): string => (typeof cell === 'string' ? cell : cell.text)
const texts = (table: SummaryTable): string[][] => table.rows.map((row) => row.map(text))

function sections(input: PlanningSummaryInput): Record<string, SummaryTable[]> {
  return Object.fromEntries(buildPlanningSummary(input).sections.map((s) => [s.title, s.tables]))
}

describe('cabeçalho', () => {
  it('traz a sprint, a seleção e quando foi gerado', () => {
    const summary = buildPlanningSummary(groupInput())
    expect(summary.title).toBe('Planning · 13 de out. → 24 de out.')
    expect(summary.subtitle).toBe('Comércio · gerado em 11/10/2026 16:40')
  })

  it('as seções saem na ordem resumo, capacidade, itens', () => {
    expect(buildPlanningSummary(groupInput()).sections.map((s) => s.title)).toEqual([
      'Resumo geral',
      'Capacidade da sprint',
      'Itens da sprint'
    ])
  })
})

describe('Resumo geral (RN-PLN-18)', () => {
  it('soma os pontos só dos itens marcados e mede front e back contra a capacidade', () => {
    const [overview] = sections(groupInput())['Resumo geral']
    expect(overview.headers).toEqual(['Disciplina', 'Pontos', 'Uso da capacidade', 'Situação'])
    expect(texts(overview)).toEqual([
      ['Front', '19', '88%', '🟢 Dentro da capacidade'],
      ['Back', '26', '83%', '🟢 Dentro da capacidade'],
      ['QA', '10', '—', '—'],
      ['Total geral', '55', '85%', '🟢 Dentro da capacidade']
    ])
  })

  it('o uso geral é o alocado de front e back sobre a capacidade das duas', () => {
    // 84h + 120h alocadas sobre 86,4h + 144h: front no limite, geral dentro.
    const capacity = {
      frontDevs: 1.8,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
    const rows = texts(sections(groupInput({ capacity }))['Resumo geral'][0])
    expect(rows[0].slice(2)).toEqual(['97%', '🟡 No limite'])
    expect(rows[3].slice(2)).toEqual(['89%', '🟢 Dentro da capacidade'])
  })

  it('acima de 100% a situação é acima da capacidade, com o excedente real', () => {
    const capacity = {
      frontDevs: 1,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
    const rows = texts(sections(groupInput({ capacity }))['Resumo geral'][0])
    expect(rows[0].slice(2)).toEqual(['175%', '🔴 Acima da capacidade'])
  })

  it('no Grupo, mostra a parte de cada Produto na ordem da Configuração', () => {
    const [, byProduct] = sections(groupInput())['Resumo geral']
    expect(byProduct.headers).toEqual(['Produto', 'Front', 'Back', 'QA', 'Total', '% da sprint'])
    expect(texts(byProduct)).toEqual([
      ['Loja Online', '11', '13', '5', '29', '53%'],
      ['App Mobile', '8', '13', '5', '26', '47%']
    ])
  })

  it('num Produto sozinho não há quebra por Produto', () => {
    const tables = sections(productInput())['Resumo geral']
    expect(tables).toHaveLength(1)
    expect(texts(tables[0])[3].slice(0, 2)).toEqual(['Total geral', '29'])
  })

  it('Grupo sem ponto nenhum mostra 0%, não NaN', () => {
    const input = groupInput({ uncheckedIds: new Set(ITEMS.map((i) => i.id)) })
    const [, byProduct] = sections(input)['Resumo geral']
    expect(texts(byProduct).map((row) => row[5])).toEqual(['0%', '0%'])
  })
})

describe('Capacidade da sprint', () => {
  it('traz os parâmetros, a capacidade, o alocado e o saldo por disciplina', () => {
    const summary = buildPlanningSummary(groupInput())
    const section = summary.sections[1]
    expect(section.note).toBe('10 dias de sprint · 6h produtivas por dia')
    expect(section.tables[0].headers).toEqual(['', 'Front', 'Back'])
    expect(texts(section.tables[0])).toEqual([
      ['Devs', '2', '3'],
      ['Reserva a bugs', '20%', '20%'],
      ['Capacidade', '96h', '144h'],
      ['Alocado', '84h', '120h'],
      ['Saldo', '12h', '24h']
    ])
  })

  it('saldo negativo quando o alocado passa da capacidade', () => {
    const capacity = {
      frontDevs: 1,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
    const rows = texts(sections(groupInput({ capacity }))['Capacidade da sprint'][0])
    expect(rows[4]).toEqual(['Saldo', '-36h', '24h'])
  })

  it('dev fracionário sai com vírgula', () => {
    const capacity = {
      frontDevs: 2.5,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
    const rows = texts(sections(groupInput({ capacity }))['Capacidade da sprint'][0])
    expect(rows[0]).toEqual(['Devs', '2,5', '3'])
  })

  it('a capacidade é a mesma no Produto e no Grupo; muda só o alocado (RN-PLN-16)', () => {
    const rows = texts(sections(productInput())['Capacidade da sprint'][0])
    expect(rows[2]).toEqual(['Capacidade', '96h', '144h'])
    expect(rows[3]).toEqual(['Alocado', '48h', '60h'])
  })
})

describe('Itens da sprint', () => {
  it('lista só os marcados, na ordem da tela (RN-PLN-04)', () => {
    const [table] = sections(groupInput())['Itens da sprint']
    expect(table.headers).toEqual([
      'ID',
      'Título',
      'Produto',
      'Prioridade',
      'Front',
      'Back',
      'QA',
      'Total'
    ])
    expect(texts(table)).toEqual([
      ['#101', 'Checkout: pagamento via Pix', 'Loja Online', 'P1', '8', '8', '3', '19'],
      ['#102', 'Carrinho perde o cupom', 'Loja Online', 'P1', '3', '5', '2', '10'],
      ['#201', 'Notificação de pedido enviado', 'App Mobile', 'P2', '5', '5', '3', '13'],
      ['#202', 'Exportar relatório de vendas', 'App Mobile', 'P2', '3', '8', '2', '13'],
      ['Total', '4 itens', '', '', '19', '26', '10', '55']
    ])
  })

  it('o ID é um link para o work item na organização da Configuração', () => {
    const [table] = sections(groupInput())['Itens da sprint']
    expect(table.rows[0][0]).toEqual({
      text: '#101',
      href: 'https://dev.azure.com/contoso/_workitems/edit/101'
    })
  })

  it('marca o remanescente no título (RN-PLN-11)', () => {
    const [table] = sections(groupInput())['Itens da sprint']
    expect(table.rows[1][1]).toEqual({ text: 'Carrinho perde o cupom', tag: 'Remanescente' })
    expect(table.rows[0][1]).toBe('Checkout: pagamento via Pix')
  })

  it('avisa quantos itens desmarcados ficaram de fora', () => {
    const summary = buildPlanningSummary(groupInput())
    expect(summary.sections[2].note).toBe('1 item desmarcado na tela ficou fora deste resumo.')
    const none = buildPlanningSummary(groupInput({ uncheckedIds: new Set() }))
    expect(none.sections[2].note).toBeUndefined()
  })

  it('num Produto sozinho traz só os itens dele, sem a coluna Produto', () => {
    const [table] = sections(productInput())['Itens da sprint']
    expect(table.headers).toEqual(['ID', 'Título', 'Prioridade', 'Front', 'Back', 'QA', 'Total'])
    expect(texts(table)).toEqual([
      ['#101', 'Checkout: pagamento via Pix', 'P1', '8', '8', '3', '19'],
      ['#102', 'Carrinho perde o cupom', 'P1', '3', '5', '2', '10'],
      ['Total', '2 itens', '', '11', '13', '5', '29']
    ])
  })

  it('ponto não estimado aparece como travessão e soma zero (RN-PLN-03)', () => {
    const items = [item(301, 'loja-online', null, [null, 5, null], 'Sem estimativa de front')]
    const input = productInput({ items, uncheckedIds: new Set(), manualIds: new Set() })
    const [table] = sections(input)['Itens da sprint']
    expect(texts(table)).toEqual([
      ['#301', 'Sem estimativa de front', '—', '—', '5', '—', '5'],
      ['Total', '1 item', '', '0', '5', '0', '5']
    ])
  })

  it('ponto fracionário de remanescente rateado sai com vírgula (RN-PLN-09)', () => {
    const items = [{ ...item(302, 'loja-online', 1, [2.5, 4, 2]), total: 8.5 }]
    const input = productInput({ items, uncheckedIds: new Set(), manualIds: new Set([302]) })
    const [table] = sections(input)['Itens da sprint']
    expect(texts(table)[0].slice(2)).toEqual(['P1', '2,5', '4', '2', '8,5'])
  })

  it('sem item marcado não há tabela, só o aviso', () => {
    const input = productInput({ uncheckedIds: new Set([101, 102, 103]) })
    const section = buildPlanningSummary(input).sections[2]
    expect(section.tables).toEqual([])
    expect(section.note).toBe(
      'Nenhum item marcado para esta sprint. 3 itens desmarcados na tela ficaram fora deste resumo.'
    )
  })
})

describe('Ficaram fora da sprint (RN-PLN-18)', () => {
  it('por padrão os desmarcados não aparecem, só a contagem', () => {
    const titles = buildPlanningSummary(groupInput()).sections.map((s) => s.title)
    expect(titles).not.toContain('Ficaram fora da sprint')
  })

  it('ligado, os desmarcados vão para uma seção à parte, depois dos itens', () => {
    const input = groupInput({ uncheckedIds: new Set([103, 201]), showUnchecked: true })
    const summary = buildPlanningSummary(input)
    expect(summary.sections.map((s) => s.title)).toEqual([
      'Resumo geral',
      'Capacidade da sprint',
      'Itens da sprint',
      'Ficaram fora da sprint'
    ])
    const out = summary.sections[3]
    expect(out.note).toBe(
      'Avaliados no Planning e desmarcados. Não entram na soma de pontos nem na capacidade.'
    )
    expect(texts(out.tables[0])).toEqual([
      ['#201', 'Notificação de pedido enviado', 'App Mobile', 'P2', '5', '5', '3', '13'],
      ['#103', 'Refatorar serviço de frete', 'Loja Online', 'P3', '3', '5', '2', '10'],
      ['Total', '2 itens', '', '', '8', '10', '5', '23']
    ])
  })

  it('ligado, a contagem sai da seção de itens e os números da sprint não mudam', () => {
    const off = buildPlanningSummary(groupInput())
    const on = buildPlanningSummary(groupInput({ showUnchecked: true }))
    expect(on.sections[2].note).toBeUndefined()
    expect(on.sections.slice(0, 3).map((s) => s.tables)).toEqual(
      off.sections.slice(0, 3).map((s) => s.tables)
    )
  })

  it('sem desmarcados, ligado ou não, a seção não existe', () => {
    const input = groupInput({ uncheckedIds: new Set(), showUnchecked: true })
    const titles = buildPlanningSummary(input).sections.map((s) => s.title)
    expect(titles).not.toContain('Ficaram fora da sprint')
  })

  it('remanescente desmarcado mantém a etiqueta, e a seção vai para as duas saídas', () => {
    const input = groupInput({ uncheckedIds: new Set([102]), showUnchecked: true })
    const summary = buildPlanningSummary(input)
    expect(summary.sections[3].tables[0].rows[0][1]).toEqual({
      text: 'Carrinho perde o cupom',
      tag: 'Remanescente'
    })
    expect(summaryToHtml(summary)).toContain('<h2>Ficaram fora da sprint</h2>')
    expect(summaryToMarkdown(summary)).toContain('## Ficaram fora da sprint')
  })
})

describe('campos de esforço ausentes na Configuração (RN-PLN-03)', () => {
  it('sem QA, a disciplina some do resumo e da tabela de itens', () => {
    const tables = sections(groupInput({ effort: { frontend: true, backend: true, qa: false } }))
    expect(texts(tables['Resumo geral'][0]).map((row) => row[0])).toEqual([
      'Front',
      'Back',
      'Total geral'
    ])
    expect(tables['Itens da sprint'][0].headers).not.toContain('QA')
  })

  it('só com backend, a capacidade e o uso geral medem só o backend', () => {
    const tables = sections(groupInput({ effort: { frontend: false, backend: true, qa: true } }))
    expect(tables['Capacidade da sprint'][0].headers).toEqual(['', 'Back'])
    expect(texts(tables['Resumo geral'][0])).toEqual([
      ['Back', '26', '83%', '🟢 Dentro da capacidade'],
      ['QA', '10', '—', '—'],
      ['Total geral', '55', '83%', '🟢 Dentro da capacidade']
    ])
  })

  it('sem frontend nem backend, não há seção de capacidade nem colunas de uso', () => {
    const input = groupInput({ effort: { frontend: false, backend: false, qa: true } })
    const summary = buildPlanningSummary(input)
    expect(summary.sections.map((s) => s.title)).toEqual(['Resumo geral', 'Itens da sprint'])
    expect(summary.sections[0].tables[0].headers).toEqual(['Disciplina', 'Pontos'])
  })

  it('sem nenhum campo de esforço, sobram os itens e o total', () => {
    const input = productInput({ effort: { frontend: false, backend: false, qa: false } })
    const tables = sections(input)
    expect(texts(tables['Resumo geral'][0])).toEqual([['Total geral', '29']])
    expect(tables['Itens da sprint'][0].headers).toEqual(['ID', 'Título', 'Prioridade', 'Total'])
  })
})

describe('saídas (RN-PLN-19)', () => {
  const hostile = [
    item(
      401,
      'loja-online',
      1,
      [1, 1, 1],
      '<img src=x onerror=alert(1)> & "aspas" | barra [x]\nlinha'
    )
  ]
  const hostileInput = productInput({
    items: hostile,
    uncheckedIds: new Set(),
    manualIds: new Set([401])
  })

  it('o HTML tem títulos, tabelas, link e a etiqueta de remanescente', () => {
    const html = summaryToHtml(buildPlanningSummary(groupInput()))
    expect(html).toContain('<h1>Planning · 13 de out. → 24 de out.</h1>')
    expect(html).toContain('<h2>Itens da sprint</h2>')
    expect(html).toContain('<a href="https://dev.azure.com/contoso/_workitems/edit/101">#101</a>')
    expect(html).toContain('Carrinho perde o cupom <strong>[Remanescente]</strong>')
    expect(html.match(/<table>/g)).toHaveLength(4)
  })

  it('o título do item nunca vira marcação no HTML', () => {
    const html = summaryToHtml(buildPlanningSummary(hostileInput))
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;aspas&quot;')
  })

  it('o Markdown tem as mesmas seções, com tabela e link', () => {
    const markdown = summaryToMarkdown(buildPlanningSummary(groupInput()))
    expect(markdown).toContain('# Planning · 13 de out. → 24 de out.')
    expect(markdown).toContain('## Capacidade da sprint')
    expect(markdown).toContain('| ID | Título | Produto | Prioridade | Front | Back | QA | Total |')
    expect(markdown).toContain('| --- | --- | --- | --- | --- | --- | --- | --- |')
    expect(markdown).toContain(
      '| [#101](https://dev.azure.com/contoso/_workitems/edit/101) | Checkout: pagamento via Pix | Loja Online | P1 | 8 | 8 | 3 | **19** |'
    )
    expect(markdown).toContain('Carrinho perde o cupom **\\[Remanescente\\]**')
  })

  it('barra vertical e quebra de linha no título não quebram a tabela em Markdown', () => {
    const markdown = summaryToMarkdown(buildPlanningSummary(hostileInput))
    const row = markdown.split('\n').find((line) => line.includes('#401')) ?? ''
    expect(row).toContain('\\| barra \\[x\\] linha')
    // 7 colunas: 8 barras de tabela, fora as escapadas.
    expect(row.replace(/\\\|/g, '').split('|')).toHaveLength(9)
  })

  it('HTML e Markdown trazem as mesmas linhas de item', () => {
    const summary = buildPlanningSummary(groupInput())
    const html = summaryToHtml(summary)
    const markdown = summaryToMarkdown(summary)
    for (const id of [101, 102, 201, 202]) {
      expect(html).toContain(`#${id}`)
      expect(markdown).toContain(`#${id}`)
    }
    expect(html).not.toContain('#103')
    expect(markdown).not.toContain('#103')
  })
})

describe('Objetivo da sprint (RN-PLN-20)', () => {
  it('quando há objetivo, ele é a primeira seção, antes do resumo geral', () => {
    const summary = buildPlanningSummary(groupInput({ goal: 'Entregar o checkout com Pix.' }))
    expect(summary.sections[0]).toEqual({
      title: 'Objetivo da sprint',
      body: [{ text: 'Entregar o checkout com Pix.', bullets: [] }],
      tables: []
    })
    expect(summary.sections[1].title).toBe('Resumo geral')
  })

  it('sem objetivo, ou só com espaços, a seção não existe', () => {
    for (const goal of [undefined, '', '   ']) {
      const titles = buildPlanningSummary(groupInput({ goal })).sections.map((s) => s.title)
      expect(titles).not.toContain('Objetivo da sprint')
    }
  })

  it('rótulo e lista do objetivo saem formatados nas duas saídas', () => {
    const goal = [
      'Objetivo: Permitir o pagamento com Pix.',
      'Como saberemos:',
      '- Pedido confirmado em um minuto',
      '- Estorno automático'
    ].join('\n')
    const summary = buildPlanningSummary(groupInput({ goal }))

    expect(summary.sections[0].body).toEqual([
      { label: 'Objetivo', text: 'Permitir o pagamento com Pix.', bullets: [] },
      { label: 'Como saberemos', bullets: ['Pedido confirmado em um minuto', 'Estorno automático'] }
    ])
    expect(summaryToHtml(summary)).toContain(
      '<p><strong>Objetivo:</strong> Permitir o pagamento com Pix.</p>' +
        '<p><strong>Como saberemos:</strong></p>' +
        '<ul><li>Pedido confirmado em um minuto</li><li>Estorno automático</li></ul>'
    )
    expect(summaryToMarkdown(summary)).toContain(
      '**Objetivo:** Permitir o pagamento com Pix.\n\n**Como saberemos:**\n\n- Pedido confirmado em um minuto\n- Estorno automático'
    )
  })

  it('marcação dentro de rótulo e de item de lista também é escapada', () => {
    const summary = buildPlanningSummary(
      groupInput({ goal: '<b>Rótulo</b>: <i>texto</i>\n- <img src=x onerror=alert(1)>' })
    )
    const html = summaryToHtml(summary)
    expect(html).not.toMatch(/<b>|<i>|<img/)
    expect(html).toContain('&lt;b&gt;Rótulo&lt;/b&gt;')
  })

  it('o texto do objetivo nunca vira marcação, em HTML nem em Markdown (RN-SEC-26)', () => {
    const goal = '<img src=x onerror=alert(1)> [clique](https://evil.example) | a'
    const summary = buildPlanningSummary(groupInput({ goal }))
    const html = summaryToHtml(summary)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(summaryToMarkdown(summary)).toContain('\\[clique\\](https://evil.example) \\| a')
  })
})
