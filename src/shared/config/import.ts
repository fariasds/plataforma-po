import type { Configuration } from './schema'
import {
  validateConfiguration,
  type ConfigurationIssue,
  type ConfigurationResult,
  type RemovedIds
} from './validate'

/**
 * O caminho de toda Configuração que chega de fora: arquivo de um colega, texto
 * colado ou proposta da IA. Valida, confere que é da mesma organização e calcula
 * a diferença para a Configuração em uso, **sem gravar nada** (RN-CFG-09).
 *
 * Quem grava é o main, com o `content` que sai daqui. A tela usa a mesma
 * conta para a prévia, então o que o PO revisou é o que vai para o disco.
 */

/** O mesmo teto da leitura do arquivo no disco. */
export const MAX_CONFIG_BYTES = 1024 * 1024

// ─── Leitura do texto ───────────────────────────────────────────────────────

/**
 * A mensagem do `JSON.parse` cita um trecho do texto. Se o PO colou um token e
 * quebrou o JSON, esse trecho iria para a tela e o log — o vazamento que a
 * RN-CFG-05 fecha. Fica só a posição.
 */
function syntaxIssue(error: unknown): ConfigurationIssue {
  const message = error instanceof Error ? error.message : ''
  const line = /line (\d+) column (\d+)/.exec(message)
  const position = /position (\d+)/.exec(message)
  const where = line
    ? ` (linha ${line[1]}, coluna ${line[2]})`
    : position
      ? ` (caractere ${position[1]})`
      : ''
  return { path: '', message: `O arquivo não é um JSON válido${where}.` }
}

export type ParsedText = { ok: true; raw: unknown } | { ok: false; issues: ConfigurationIssue[] }

/** Lê o texto como JSON, com o teto de tamanho e sem repetir o conteúdo no erro. */
export function parseJsonText(text: string): ParsedText {
  if (typeof text !== 'string') {
    return { ok: false, issues: [{ path: '', message: 'O arquivo precisa chegar como texto.' }] }
  }
  if (new TextEncoder().encode(text).length > MAX_CONFIG_BYTES) {
    return { ok: false, issues: [{ path: '', message: 'A Configuração passa de 1 MB.' }] }
  }
  try {
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    return { ok: true, raw: JSON.parse(body) }
  } catch (error) {
    return { ok: false, issues: [syntaxIssue(error)] }
  }
}

/** Texto do disco ou de fora → Configuração validada (RN-CFG-01 a 05). */
export function parseConfigurationText(text: string): ConfigurationResult {
  const parsed = parseJsonText(text)
  return parsed.ok ? validateConfiguration(parsed.raw) : parsed
}

// ─── Diferença ──────────────────────────────────────────────────────────────

export interface DiffEntry {
  id: string
  /** Nome para a tela; o Perfil de processo não tem nome, então repete o ID. */
  name: string
}

export interface EntityDiff {
  added: DiffEntry[]
  changed: DiffEntry[]
  removed: DiffEntry[]
}

/** Seções da Configuração que não são listas de coisas com ID. */
export const CONFIG_SECTIONS = [
  'organization',
  'appearance',
  'customFields',
  'criticality',
  'recurrentBugTag',
  'calendar',
  'storyPoints',
  'capacityDefaults'
] as const

export type ConfigSection = (typeof CONFIG_SECTIONS)[number]

export interface ConfigurationDiff {
  products: EntityDiff
  groups: EntityDiff
  squads: EntityDiff
  processProfiles: EntityDiff
  /** Seções que mudaram, na ordem de `CONFIG_SECTIONS`. */
  sections: ConfigSection[]
}

/**
 * Compara por valor. Os dois lados saíram do mesmo schema, então as chaves vêm
 * na mesma ordem e a serialização basta.
 */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function diffById<T extends { id: string; name: string }>(before: T[], after: T[]): EntityDiff {
  const previous = new Map(before.map((item) => [item.id, item]))
  const next = new Map(after.map((item) => [item.id, item]))
  const entry = (item: T): DiffEntry => ({ id: item.id, name: item.name })
  return {
    added: after.filter((item) => !previous.has(item.id)).map(entry),
    changed: after
      .filter((item) => previous.has(item.id) && !same(previous.get(item.id), item))
      .map(entry),
    removed: before.filter((item) => !next.has(item.id)).map(entry)
  }
}

function diffProfiles(
  before: Configuration['processProfiles'],
  after: Configuration['processProfiles']
): EntityDiff {
  const asList = (profiles: Configuration['processProfiles']): (DiffEntry & { value: unknown })[] =>
    Object.entries(profiles).map(([id, value]) => ({ id, name: id, value }))
  return diffById(asList(before), asList(after))
}

const EMPTY: Pick<Configuration, 'products' | 'groups' | 'squads' | 'processProfiles'> = {
  products: [],
  groups: [],
  squads: [],
  processProfiles: {}
}

/** O que muda de `previous` para `next`. Sem `previous`, tudo entra. */
export function diffConfiguration(
  previous: Configuration | null,
  next: Configuration
): ConfigurationDiff {
  const base = previous ?? EMPTY
  return {
    products: diffById(base.products, next.products),
    groups: diffById(base.groups, next.groups),
    squads: diffById(base.squads, next.squads),
    processProfiles: diffProfiles(base.processProfiles, next.processProfiles),
    sections: previous
      ? CONFIG_SECTIONS.filter((section) => !same(previous[section], next[section]))
      : []
  }
}

/** RN-CFG-02: o que sai e órfã os Dados de trabalho guardados pelo ID. */
export function removedFromDiff(diff: ConfigurationDiff): RemovedIds {
  const ids = (entries: DiffEntry[]): string[] => entries.map((entry) => entry.id)
  return {
    products: ids(diff.products.removed),
    groups: ids(diff.groups.removed),
    squads: ids(diff.squads.removed)
  }
}

export function hasChanges(diff: ConfigurationDiff): boolean {
  const lists = [diff.products, diff.groups, diff.squads, diff.processProfiles]
  return (
    diff.sections.length > 0 ||
    lists.some((list) => list.added.length + list.changed.length + list.removed.length > 0)
  )
}

// ─── Plano de importação ────────────────────────────────────────────────────

export type ImportPlan =
  | {
      ok: true
      /** A Configuração que fica em uso depois de aplicar. */
      config: Configuration
      /** O que vai para o disco: o JSON como veio, para o arquivo continuar do autor. */
      content: unknown
      diff: ConfigurationDiff
    }
  | { ok: false; issues: ConfigurationIssue[] }

/**
 * Organização do Azure não diferencia maiúsculas: `Contoso` e `contoso` são a
 * mesma, e o PAT do Perfil vale para as duas.
 */
function sameOrganization(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Planeja a troca da Configuração em uso (`current`) pelo texto que chegou.
 * Sem `current` (Perfil nascendo agora), qualquer organização serve: é a do
 * arquivo que cria o Perfil.
 */
export function planImport(current: Configuration | null, text: string): ImportPlan {
  const parsed = parseJsonText(text)
  if (!parsed.ok) return parsed
  const result = validateConfiguration(parsed.raw)
  if (!result.ok) return result

  if (current && !sameOrganization(current.organization, result.config.organization)) {
    return {
      ok: false,
      issues: [
        {
          path: 'organization',
          message: `Este arquivo é da organização "${result.config.organization}", e este Perfil usa "${current.organization}". O token do Perfil só vale para "${current.organization}", então o app não importa um arquivo de outra organização.`
        }
      ]
    }
  }

  return {
    ok: true,
    config: result.config,
    content: parsed.raw,
    diff: diffConfiguration(current, result.config)
  }
}
