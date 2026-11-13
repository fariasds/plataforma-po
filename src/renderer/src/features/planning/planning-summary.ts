import { workItemUrl } from '@shared/azure'
import type { PlanningItem } from '@shared/dashboards'
import { spToHours, type StoryPointsTable } from '@shared/story-points'
import { formatHours, formatNumber, t, tPlural } from '../../i18n'
import {
  capacityHours,
  capacityRatio,
  capacityStatus,
  comparePlanningItems,
  type CapacityConfig,
  type CapacityStatus
} from './planning-rules'

/**
 * Resumo do Planning para colar no Loop ou no Teams (RN-PLN-18, RN-PLN-19).
 *
 * O resumo é montado uma vez, como dado, e só depois vira HTML e Markdown: as
 * duas saídas vão juntas para a área de transferência e precisam dizer a mesma
 * coisa.
 */

export type SummaryCell =
  | string
  | {
      text: string
      href?: string
      strong?: boolean
      /** Etiqueta depois do texto, como a de remanescente. */
      tag?: string
    }

export interface SummaryTable {
  headers: string[]
  rows: SummaryCell[][]
}

/** Um parágrafo, com rótulo opcional, seguido ou não de uma lista. */
export interface SummaryBlock {
  label?: string
  text?: string
  bullets: string[]
}

export interface SummarySection {
  title: string
  note?: string
  /** Texto corrido da seção; hoje só o objetivo da sprint usa. */
  body?: SummaryBlock[]
  tables: SummaryTable[]
}

export interface PlanningSummary {
  title: string
  subtitle: string
  sections: SummarySection[]
}

export interface PlanningSummaryInput {
  /** `null` no Perfil de demonstração: o item sai sem link (RN-SEC-27). */
  organization: string | null
  /** Nome do Produto ou do Grupo selecionado. */
  selectionName: string
  sprintLabel: string
  /** Data e hora da geração, já formatadas. */
  generatedAt: string
  /** Produtos da seleção, na ordem da Configuração. */
  products: Array<{ id: string; name: string }>
  isGroup: boolean
  /** Todos os itens da tela, marcados ou não, do Azure e remanescentes. */
  items: PlanningItem[]
  uncheckedIds: ReadonlySet<number>
  manualIds: ReadonlySet<number>
  effort: { frontend: boolean; backend: boolean; qa: boolean }
  capacity: CapacityConfig
  productiveHoursPerDay: number
  storyPoints: StoryPointsTable
  /** Objetivo da sprint aceito pelo PO (RN-PLN-20). Vazio, a seção não existe. */
  goal?: string
  /** Lista os desmarcados numa seção à parte, como evidência do que não coube (RN-PLN-18). */
  showUnchecked?: boolean
}

type Discipline = 'frontend' | 'backend' | 'qa'

// O Loop descarta cor de fundo ao colar; o símbolo carrega a situação no lugar dela.
const STATUS_SYMBOL: Record<CapacityStatus, string> = { ok: '🟢', warning: '🟡', over: '🔴' }

const NONE = '—'

function points(value: number | null): string {
  return value === null ? NONE : formatNumber(value, value % 1 === 0 ? 0 : 1)
}

function statusLabel(status: CapacityStatus): string {
  const label = {
    ok: t('planning.capacityWithin'),
    warning: t('planning.capacityAtLimit'),
    over: t('planning.capacityOver')
  }[status]
  return `${STATUS_SYMBOL[status]} ${label}`
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

const strong = (text: string): SummaryCell => ({ text, strong: true })

/**
 * O objetivo é texto do PO (RN-PLN-20). Duas convenções viram formatação, e só
 * elas: `Rótulo: texto` no começo da linha e `- item` de lista.
 */
export function goalBlocks(goal: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = []
  for (const line of goal.split('\n').map((l) => l.trim())) {
    if (!line) continue
    const bullet = /^[-•]\s+(.*)$/.exec(line)
    if (bullet) {
      if (!blocks.length) blocks.push({ bullets: [] })
      blocks[blocks.length - 1].bullets.push(bullet[1])
      continue
    }
    const labelled = /^([^:]{1,40}):\s*(.*)$/.exec(line)
    blocks.push(
      labelled
        ? { label: labelled[1], ...(labelled[2] ? { text: labelled[2] } : {}), bullets: [] }
        : { text: line, bullets: [] }
    )
  }
  return blocks
}

export function buildPlanningSummary(input: PlanningSummaryInput): PlanningSummary {
  const { effort, storyPoints } = input
  const sorted = [...input.items].sort(comparePlanningItems)
  const checked = sorted.filter((item) => !input.uncheckedIds.has(item.id))
  const uncheckedCount = sorted.length - checked.length

  const sum = (list: PlanningItem[], key: Discipline | 'total'): number =>
    list.reduce((total, item) => total + (item[key] ?? 0), 0)
  const hours = (key: 'frontend' | 'backend'): number =>
    Math.round(checked.reduce((total, item) => total + spToHours(item[key], storyPoints), 0) * 10) /
    10

  const disciplines = (
    [
      { key: 'frontend', label: t('disciplines.front') },
      { key: 'backend', label: t('disciplines.back') },
      { key: 'qa', label: t('disciplines.qa') }
    ] as const
  ).filter(({ key }) => effort[key])

  // A capacidade só existe para frontend e backend (RN-PLN-17).
  const capacity = capacityHours(input.capacity, input.productiveHoursPerDay)
  const measured = disciplines.filter(
    (d): d is (typeof disciplines)[number] & { key: 'frontend' | 'backend' } => d.key !== 'qa'
  )
  const hasCapacity = measured.length > 0
  const allocated = { frontend: hours('frontend'), backend: hours('backend') }

  const usage = (allocatedHours: number, capacityTotal: number): SummaryCell[] => {
    const ratio = capacityRatio(allocatedHours, capacityTotal)
    return [percent(ratio), statusLabel(capacityStatus(ratio))]
  }

  const overviewRows: SummaryCell[][] = disciplines.map(({ key, label }) => [
    label,
    points(sum(checked, key)),
    ...(hasCapacity ? (key === 'qa' ? [NONE, NONE] : usage(allocated[key], capacity[key])) : [])
  ])
  overviewRows.push([
    strong(t('planning.totalAll')),
    strong(points(sum(checked, 'total'))),
    ...(hasCapacity
      ? usage(
          measured.reduce((total, d) => total + allocated[d.key], 0),
          measured.reduce((total, d) => total + capacity[d.key], 0)
        )
      : [])
  ])

  const overview: SummarySection = {
    title: t('planning.summary.overview'),
    tables: [
      {
        headers: [
          t('planning.summary.discipline'),
          t('planning.summary.points'),
          ...(hasCapacity ? [t('planning.summary.usage'), t('planning.summary.situation')] : [])
        ],
        rows: overviewRows
      }
    ]
  }

  if (input.isGroup) {
    const sprintTotal = sum(checked, 'total')
    overview.tables.push({
      headers: [
        t('common.product'),
        ...disciplines.map((d) => d.label),
        t('common.total'),
        t('planning.summary.sprintShare')
      ],
      rows: input.products.map((product) => {
        const own = checked.filter((item) => item.product === product.id)
        const total = sum(own, 'total')
        return [
          product.name,
          ...disciplines.map((d) => points(sum(own, d.key))),
          points(total),
          percent(sprintTotal > 0 ? total / sprintTotal : 0)
        ]
      })
    })
  }

  const goal = input.goal?.trim()
  const sections: SummarySection[] = [
    // Texto livre do PO ou rascunho da IA: escapado nas duas saídas (RN-SEC-26).
    ...(goal ? [{ title: t('planning.goal.title'), body: goalBlocks(goal), tables: [] }] : []),
    overview
  ]

  if (hasCapacity) {
    const devs = { frontend: input.capacity.frontDevs, backend: input.capacity.backDevs }
    const bugReserve = {
      frontend: input.capacity.frontBugPercent,
      backend: input.capacity.backBugPercent
    }
    const row = (label: string, value: (key: 'frontend' | 'backend') => string): SummaryCell[] => [
      label,
      ...measured.map((d) => value(d.key))
    ]
    sections.push({
      title: t('planning.capacityTitle'),
      note: t('planning.summary.capacityParams', {
        days: input.capacity.sprintDays,
        hours: formatHours(input.productiveHoursPerDay)
      }),
      tables: [
        {
          headers: ['', ...measured.map((d) => d.label)],
          rows: [
            row(t('planning.summary.devs'), (key) => points(devs[key])),
            row(t('planning.summary.bugReserve'), (key) => percent(bugReserve[key] / 100)),
            row(t('planning.summary.capacity'), (key) => formatHours(capacity[key])),
            row(t('planning.summary.allocated'), (key) => formatHours(allocated[key])),
            row(t('planning.summary.balance'), (key) =>
              formatHours(Math.round((capacity[key] - allocated[key]) * 10) / 10)
            )
          ]
        }
      ]
    })
  }

  const productName = (id: string): string =>
    input.products.find((product) => product.id === id)?.name ?? id

  // Marcados e desmarcados saem na mesma tabela, para quem lê comparar as duas.
  const itemTable = (list: PlanningItem[]): SummaryTable[] => {
    if (list.length === 0) return []
    const rows: SummaryCell[][] = list.map((item) => [
      {
        text: `#${item.id}`,
        href: input.organization === null ? undefined : workItemUrl(input.organization, item.id)
      },
      input.manualIds.has(item.id) ? { text: item.title, tag: t('planning.leftover') } : item.title,
      ...(input.isGroup ? [productName(item.product)] : []),
      item.priority === null ? NONE : t('planning.priorityShort', { priority: item.priority }),
      ...disciplines.map((d) => points(item[d.key])),
      strong(points(item.total))
    ])
    rows.push([
      strong(t('common.total')),
      tPlural('common.itemCount', list.length),
      ...(input.isGroup ? [''] : []),
      '',
      ...disciplines.map((d) => strong(points(sum(list, d.key)))),
      strong(points(sum(list, 'total')))
    ])
    return [
      {
        headers: [
          t('common.id'),
          t('common.title'),
          ...(input.isGroup ? [t('common.product')] : []),
          t('planning.priority'),
          ...disciplines.map((d) => d.label),
          t('common.total')
        ],
        rows
      }
    ]
  }

  const listUnchecked = Boolean(input.showUnchecked) && uncheckedCount > 0
  const itemNotes = [
    checked.length === 0 ? t('planning.summary.empty') : null,
    uncheckedCount > 0 && !listUnchecked
      ? tPlural('planning.summary.uncheckedNote', uncheckedCount)
      : null
  ].filter((note): note is string => note !== null)

  sections.push({
    title: t('planning.sprintItems'),
    ...(itemNotes.length > 0 ? { note: itemNotes.join(' ') } : {}),
    tables: itemTable(checked)
  })

  if (listUnchecked) {
    sections.push({
      title: t('planning.summary.outOfSprint'),
      note: t('planning.summary.outOfSprintNote'),
      tables: itemTable(sorted.filter((item) => input.uncheckedIds.has(item.id)))
    })
  }

  return {
    title: t('planning.summary.docTitle', { sprint: input.sprintLabel }),
    subtitle: [
      input.selectionName,
      t('planning.summary.generatedAt', { date: input.generatedAt })
    ].join(' · '),
    sections
  }
}

// ─── Saídas ──────────────────────────────────────────────────────────────────

/** O título do item vem do Azure e vai para `innerHTML` na prévia: nada dele é marcação. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cellHtml(cell: SummaryCell): string {
  if (typeof cell === 'string') return escapeHtml(cell)
  let html = escapeHtml(cell.text)
  if (cell.href) html = `<a href="${escapeHtml(cell.href)}">${html}</a>`
  if (cell.strong) html = `<strong>${html}</strong>`
  if (cell.tag) html += ` <strong>[${escapeHtml(cell.tag)}]</strong>`
  return html
}

export function summaryToHtml(summary: PlanningSummary): string {
  const table = ({ headers, rows }: SummaryTable): string =>
    '<table><thead><tr>' +
    headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join('')}</tr>`)
      .join('') +
    '</tbody></table>'

  const block = ({ label, text, bullets }: SummaryBlock): string =>
    (label || text
      ? '<p>' +
        (label ? `<strong>${escapeHtml(label)}:</strong>` : '') +
        (label && text ? ' ' : '') +
        escapeHtml(text ?? '') +
        '</p>'
      : '') +
    (bullets.length
      ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '')

  return (
    `<h1>${escapeHtml(summary.title)}</h1><p>${escapeHtml(summary.subtitle)}</p>` +
    summary.sections
      .map(
        (section) =>
          `<h2>${escapeHtml(section.title)}</h2>` +
          (section.note ? `<p>${escapeHtml(section.note)}</p>` : '') +
          (section.body ?? []).map(block).join('') +
          section.tables.map(table).join('')
      )
      .join('')
  )
}

/** Barra vertical ou quebra de linha no título quebrariam a tabela em Markdown. */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\s*\r?\n\s*/g, ' ')
}

function cellMarkdown(cell: SummaryCell): string {
  if (typeof cell === 'string') return escapeMarkdown(cell)
  let markdown = escapeMarkdown(cell.text)
  if (cell.href) markdown = `[${markdown}](${cell.href})`
  if (cell.strong && markdown !== '') markdown = `**${markdown}**`
  if (cell.tag) markdown += ` **\\[${escapeMarkdown(cell.tag)}\\]**`
  return markdown
}

export function summaryToMarkdown(summary: PlanningSummary): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`
  const table = ({ headers, rows }: SummaryTable): string =>
    [
      line(headers.map(escapeMarkdown)),
      line(headers.map(() => '---')),
      ...rows.map((row) => line(row.map(cellMarkdown)))
    ].join('\n')

  const blocks = [`# ${escapeMarkdown(summary.title)}`, escapeMarkdown(summary.subtitle)]
  for (const section of summary.sections) {
    blocks.push(`## ${escapeMarkdown(section.title)}`)
    if (section.note) blocks.push(escapeMarkdown(section.note))
    for (const { label, text, bullets } of section.body ?? []) {
      const head = [label ? `**${escapeMarkdown(label)}:**` : '', escapeMarkdown(text ?? '')]
        .filter((part) => part !== '')
        .join(' ')
      if (head) blocks.push(head)
      if (bullets.length) blocks.push(bullets.map((item) => `- ${escapeMarkdown(item)}`).join('\n'))
    }
    blocks.push(...section.tables.map(table))
  }
  return `${blocks.join('\n\n')}\n`
}
