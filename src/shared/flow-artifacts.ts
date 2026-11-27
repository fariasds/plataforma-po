/**
 * Leitura dos artefatos do processo rule-first que moram na pasta de trabalho
 * (ADR 0013, ADR 0014): README da Feature, Brief, Registro de Decisões e Plano de
 * PBIs. O app lê **só as linhas que os modelos do processo já têm** (RN-FLX-04); o
 * resto do texto é da IA e do PO, e o app não interpreta prosa.
 *
 * Lógica pura: recebe o texto dos arquivos e devolve o que reconheceu, com as
 * linhas que pareciam marca e não bateram com o padrão.
 */

export type PlannedPbiType = 'DEV' | 'DESIGN' | 'AJUSTE VISUAL'
export type PlannedPbiStatus = 'Planejado' | 'Escrito' | 'Quebrado' | 'Unificado' | 'Cancelado'
export type DecisionStatus = 'Proposta' | 'Aceita' | 'Substituída'

/** Os quatro arquivos que o app lê, relativos à pasta da Feature. */
export const ARTIFACT_FILES = {
  readme: 'README.md',
  brief: 'discovery/brief.md',
  decisions: 'discovery/decisoes.md',
  plan: 'plano-pbis.md'
} as const

export type ArtifactFile = (typeof ARTIFACT_FILES)[keyof typeof ARTIFACT_FILES]

export interface UnrecognizedLine {
  file: ArtifactFile
  /** 1 é a primeira linha do arquivo. */
  line: number
  text: string
  reason: string
}

export interface Requirement {
  key: string
  decisions: string[]
}

export interface OpenQuestion {
  line: number
  text: string
  answered: boolean
  /** `null` quando a pergunta em aberto não diz se bloqueia a quebra. */
  blocks: boolean | null
}

export interface Brief {
  sections: { problem: boolean; audience: boolean; objective: boolean; scope: boolean }
  requirements: Requirement[]
  questions: OpenQuestion[]
}

export interface Decision {
  key: string
  line: number
  status: DecisionStatus
  /** `AAAA-MM-DD`, ou `null` sem data. */
  date: string | null
}

export interface PlannedPbi {
  key: string
  line: number
  type: PlannedPbiType
  title: string
  azureId: number | null
  status: PlannedPbiStatus
  requirements: string[]
  decisions: string[]
  /** IDs das regras, com as abreviações já expandidas. */
  rules: string[]
}

export interface Plan {
  pbis: PlannedPbi[]
  /** Requisitos que a tabela de cobertura justifica sem PBI. */
  justified: string[]
}

export interface FeatureFolderFiles {
  /** Nome da pasta, em `features/`. */
  slug: string
  /** Caminhos relativos à pasta da Feature, com `/`. */
  files: string[]
  readme: string | null
  brief: string | null
  decisions: string | null
  plan: string | null
}

export interface ParsedFeatureFolder {
  slug: string
  /** ID da Feature no Azure, pela linha `Feature: #<id>` do README. */
  featureId: number | null
  /** `Feature: #a criar`: a pasta é um rascunho. */
  draft: boolean
  /** Título do README (`# ...`), para o rascunho. */
  title: string | null
  /** A linha `Fase:` do README, se existir. O app não a usa para calcular (RN-FLX-05). */
  readmePhase: string | null
  archived: { date: string | null; reason: string } | null
  hasDiscovery: boolean
  /** A pasta só tem o README: rascunho recém-criado. */
  onlyReadme: boolean
  brief: Brief | null
  decisions: Decision[] | null
  plan: Plan | null
  unrecognized: UnrecognizedLine[]
}

// ─── Texto ───────────────────────────────────────────────────────────────────

function lines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/)
}

/** Minúsculas, sem acento, sem número de seção nem pontuação de borda. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/[*`_]/g, '')
    .trim()
}

/** Linha do modelo ainda não preenchida: só um `<...>`, com marcador de lista ou não. */
function isPlaceholder(line: string): boolean {
  return /^\s*(?:[-*]\s*)?(?:\*\*[^*]*\*\*\s*)?<[^>]*>\s*[.]?\s*$/.test(line)
}

/** Seções `## ...`: título normalizado e as linhas até a próxima. */
function sections(text: string): Array<{ title: string; start: number; body: string[] }> {
  const all = lines(text)
  const result: Array<{ title: string; start: number; body: string[] }> = []
  all.forEach((line, i) => {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading && !line.startsWith('###')) {
      result.push({ title: normalize(heading[1]), start: i + 1, body: [] })
    } else if (result.length > 0) {
      result[result.length - 1].body.push(line)
    }
  })
  return result
}

function keysIn(text: string, letter: 'R' | 'D' | 'P'): string[] {
  return [
    ...new Set(
      [...text.matchAll(new RegExp(`\\b${letter}(\\d+)\\b`, 'g'))].map((m) => `${letter}${m[1]}`)
    )
  ]
}

// ─── Regras citadas ──────────────────────────────────────────────────────────

/**
 * IDs de regra de uma linha `RNs:`, com as abreviações que o PO usa:
 * `RN-DOC-045, 041, 043` (o prefixo continua) e `RN-PED-050 a 053` (faixa). O que
 * está entre parênteses é observação e fica de fora: `RN-DOC-080 (nova)`.
 */
export function expandRuleIds(text: string): string[] {
  let stripped = text
  for (let i = 0; i < 5 && /\([^()]*\)/.test(stripped); i++) {
    stripped = stripped.replace(/\([^()]*\)/g, ' ')
  }
  const result: string[] = []
  let prefix: string | null = null
  let width = 0
  let last = 0
  const pattern = /RN-([A-Z]{2,})-(\d+)|\ba\s+(\d+)\b|\b(\d+)\b/g
  for (const m of stripped.matchAll(pattern)) {
    if (m[1] !== undefined) {
      prefix = `RN-${m[1]}`
      width = m[2].length
      last = Number(m[2])
      result.push(`${prefix}-${m[2]}`)
    } else if (m[3] !== undefined && prefix && m[3].length === width) {
      const end = Number(m[3])
      for (let n = last + 1; n <= end && n - last <= 50; n++) {
        result.push(`${prefix}-${String(n).padStart(width, '0')}`)
      }
      last = end
    } else if (m[4] !== undefined && prefix && m[4].length === width) {
      last = Number(m[4])
      result.push(`${prefix}-${m[4]}`)
    }
  }
  return [...new Set(result)]
}

// ─── README ──────────────────────────────────────────────────────────────────

function parseReadme(
  text: string,
  unrecognized: UnrecognizedLine[]
): Pick<ParsedFeatureFolder, 'featureId' | 'draft' | 'title' | 'readmePhase' | 'archived'> {
  let featureId: number | null = null
  let draft = false
  let title: string | null = null
  let readmePhase: string | null = null
  let archived: ParsedFeatureFolder['archived'] = null
  lines(text).forEach((line, i) => {
    const heading = /^#\s+(.+?)\s*$/.exec(line)
    if (heading && title === null) title = heading[1]
    const phase = /^Fase:\s*(.+?)\s*$/.exec(line)
    if (phase) readmePhase = phase[1]
    const feature = /^Feature:\s*(.*)$/.exec(line)
    if (feature) {
      const id = /^#(\d+)\b/.exec(feature[1].trim())
      if (id) featureId = Number(id[1])
      else if (/^#?\s*a criar\b/i.test(feature[1].trim())) draft = true
      else if (!isPlaceholder(feature[1])) {
        unrecognized.push({
          file: ARTIFACT_FILES.readme,
          line: i + 1,
          text: line,
          reason: 'Use "Feature: #<id>" ou "Feature: #a criar".'
        })
      }
    }
    const archive = /^Arquivada:\s*(.*)$/.exec(line)
    if (archive) {
      const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(archive[1])
      const reason = archive[1]
        .split('·')
        .slice(date ? 1 : 0)
        .join('·')
        .trim()
      archived = { date: date ? date[1] : null, reason }
    }
  })
  return { featureId, draft, title, readmePhase, archived }
}

// ─── Brief ───────────────────────────────────────────────────────────────────

function filled(body: string[]): boolean {
  return body.some(
    (line) => line.trim() !== '' && !isPlaceholder(line) && !/^\*\*.*\*\*\s*$/.test(line.trim())
  )
}

function parseBrief(text: string): Brief {
  const found = sections(text)
  const section = (match: (title: string) => boolean): (typeof found)[number] | undefined =>
    found.find((s) => match(s.title))

  const requirementsSection = section((t) => t.startsWith('requisitos'))
  const requirements: Requirement[] = []
  for (const line of requirementsSection?.body ?? []) {
    const head = /^\s*-\s*\*\*(R\d+)\*\*/.exec(line)
    if (head) {
      requirements.push({ key: head[1], decisions: [] })
      continue
    }
    const decisions = /Decis[õo]es:\s*([^·]*)/.exec(line)
    if (decisions && requirements.length > 0) {
      requirements[requirements.length - 1].decisions = keysIn(decisions[1], 'D')
    }
  }

  const questionsSection = section((t) => t.startsWith('perguntas em aberto'))
  const questions: OpenQuestion[] = []
  questionsSection?.body.forEach((line, i) => {
    const item = /^\s*-\s*\[( |x|X)\]\s*(.*)$/.exec(line)
    if (!item || /<[^>]+>/.test(item[2])) return
    const lower = normalize(item[2])
    const blocks = lower.includes('nao bloqueia')
      ? false
      : lower.includes('bloqueia a quebra')
        ? true
        : null
    questions.push({
      line: questionsSection.start + i + 1,
      text: item[2].trim(),
      answered: item[1] !== ' ',
      blocks
    })
  })

  const has = (match: (title: string) => boolean): boolean => {
    const s = section(match)
    return s !== undefined && filled(s.body)
  }
  return {
    sections: {
      problem: has((t) => t.startsWith('problema')),
      audience: has((t) => t.startsWith('para quem')),
      objective: has((t) => t.startsWith('objetivo')),
      scope: has((t) => t.startsWith('escopo'))
    },
    requirements,
    questions
  }
}

// ─── Decisões ────────────────────────────────────────────────────────────────

function parseDecisions(text: string, unrecognized: UnrecognizedLine[]): Decision[] {
  const all = lines(text)
  const decisions: Decision[] = []
  all.forEach((line, i) => {
    const heading = /^###\s+(D\d+)\s*·\s*(.*)$/.exec(line)
    if (!heading || /^</.test(heading[2].trim())) return
    // A linha de status vem logo abaixo do título.
    const meta = all.slice(i + 1, i + 4).find((l) => /Status:/.test(l))
    const statusText = meta ? (/Status:\s*([^`·]+)/.exec(meta)?.[1].trim() ?? '') : ''
    const status = decisionStatus(statusText)
    if (status === null) {
      unrecognized.push({
        file: ARTIFACT_FILES.decisions,
        line: meta ? i + 1 + all.slice(i + 1, i + 4).indexOf(meta) + 1 : i + 1,
        text: meta ?? line,
        reason: meta
          ? `"Status: ${statusText}" não é um status de Decisão. Use Proposta, Aceita ou Substituída por Dn.`
          : 'Decisão sem a linha de Status logo abaixo do título.'
      })
      return
    }
    const date = meta ? (/Data:\s*(\d{4}-\d{2}-\d{2})/.exec(meta)?.[1] ?? null) : null
    decisions.push({ key: heading[1], line: i + 1, status, date })
  })
  return decisions
}

function decisionStatus(text: string): DecisionStatus | null {
  const value = normalize(text)
  if (value.startsWith('proposta')) return 'Proposta'
  if (value.startsWith('aceita')) return 'Aceita'
  if (/^substituida por\s+d\d+/.test(value)) return 'Substituída'
  return null
}

// ─── Plano de PBIs ───────────────────────────────────────────────────────────

const PBI_TYPES: Record<string, PlannedPbiType> = {
  dev: 'DEV',
  design: 'DESIGN',
  'ajuste visual': 'AJUSTE VISUAL'
}

function pbiStatus(text: string): PlannedPbiStatus | null {
  const value = normalize(text)
  if (value.startsWith('planejado')) return 'Planejado'
  if (value.startsWith('escrito')) return 'Escrito'
  if (value.startsWith('quebrado')) return 'Quebrado'
  if (value.startsWith('unificado')) return 'Unificado'
  if (value.startsWith('cancelado')) return 'Cancelado'
  return null
}

/** PBI que conta: planejado ou escrito. Os outros são histórico do plano. */
export function isActivePbi(pbi: Pick<PlannedPbi, 'status'>): boolean {
  return pbi.status === 'Planejado' || pbi.status === 'Escrito'
}

function parsePlan(text: string, unrecognized: UnrecognizedLine[]): Plan {
  const all = lines(text)
  const pbis: PlannedPbi[] = []
  // `reported`: a linha de status já foi apontada como não reconhecida.
  let current: {
    pbi: Partial<PlannedPbi> & { key: string; line: number }
    reported: boolean
  } | null = null

  const close = (): void => {
    if (!current) return
    const { pbi, reported } = current
    if (pbi.status === undefined) {
      if (reported) {
        current = null
        return
      }
      unrecognized.push({
        file: ARTIFACT_FILES.plan,
        line: pbi.line,
        text: all[pbi.line - 1],
        reason: 'PBI sem a linha "Azure: #<id> · Status: <status>" logo abaixo do título.'
      })
    } else {
      pbis.push({
        requirements: [],
        decisions: [],
        rules: [],
        azureId: null,
        ...pbi
      } as PlannedPbi)
    }
    current = null
  }

  all.forEach((line, i) => {
    if (/^#{1,3}\s/.test(line)) close()
    const heading = /^###\s+(P\d+)\s*·\s*([^·]+?)\s*·\s*(.*)$/.exec(line)
    if (heading) {
      if (/^</.test(heading[3].trim())) return
      const type = PBI_TYPES[normalize(heading[2])]
      if (!type) {
        unrecognized.push({
          file: ARTIFACT_FILES.plan,
          line: i + 1,
          text: line,
          reason: `"${heading[2].trim()}" não é um tipo de PBI. Use DEV, DESIGN ou AJUSTE VISUAL.`
        })
        return
      }
      current = {
        pbi: { key: heading[1], line: i + 1, type, title: heading[3].trim() },
        reported: false
      }
      return
    }
    if (!current) return
    const { pbi } = current
    if (/^Azure:/.test(line)) {
      const id = /^Azure:\s*#(\d+)/.exec(line)
      pbi.azureId = id ? Number(id[1]) : null
      const statusText = /Status:\s*([^·]+)/.exec(line)?.[1] ?? ''
      const status = pbiStatus(statusText)
      if (status === null) {
        unrecognized.push({
          file: ARTIFACT_FILES.plan,
          line: i + 1,
          text: line,
          reason: `"Status: ${statusText.trim()}" não é um status de PBI. Use Planejado, Escrito, Quebrado em Px, Unificado em Px ou Cancelado.`
        })
        current.reported = true
      } else {
        pbi.status = status
      }
    } else if (/^Requisitos:/.test(line)) {
      const [requirements, ...rest] = line.split(/·\s*Decis[õo]es:/)
      pbi.requirements = keysIn(requirements, 'R')
      pbi.decisions = keysIn(rest.join(' ').split(/·\s*Depende/)[0] ?? '', 'D')
    } else if (/^RNs\b[^:]*:/.test(line)) {
      pbi.rules = expandRuleIds(line.slice(line.indexOf(':') + 1))
    }
  })
  close()

  const justified: string[] = []
  const coverage = sections(text).find((s) => s.title.startsWith('cobertura'))
  for (const line of coverage?.body ?? []) {
    const row = /^\|\s*(R\d+)\s*\|([^|]*)\|([^|]*)\|/.exec(line)
    if (row && keysIn(row[2], 'P').length === 0 && row[3].trim() !== '' && !isPlaceholder(row[3])) {
      justified.push(row[1])
    }
  }
  return { pbis, justified }
}

// ─── Pasta da Feature ────────────────────────────────────────────────────────

export function parseFeatureFolder(input: FeatureFolderFiles): ParsedFeatureFolder {
  const unrecognized: UnrecognizedLine[] = []
  const readme = input.readme
    ? parseReadme(input.readme, unrecognized)
    : { featureId: null, draft: false, title: null, readmePhase: null, archived: null }
  const files = input.files.map((f) => f.replace(/\\/g, '/'))
  return {
    slug: input.slug,
    ...readme,
    hasDiscovery: files.some((f) => f.startsWith('discovery/')),
    onlyReadme: files.length > 0 && files.every((f) => f === ARTIFACT_FILES.readme),
    brief: input.brief !== null ? parseBrief(input.brief) : null,
    decisions: input.decisions !== null ? parseDecisions(input.decisions, unrecognized) : null,
    plan: input.plan !== null ? parsePlan(input.plan, unrecognized) : null,
    unrecognized
  }
}
