import { configurationSchema, type Configuration } from './schema'
import { findSecrets } from './secrets'

export interface ConfigurationIssue {
  /** Caminho no JSON, no formato que a tela e a IA leem: `products[0].areaPaths[1]`. */
  path: string
  message: string
}

export type ConfigurationResult =
  { ok: true; config: Configuration } | { ok: false; issues: ConfigurationIssue[] }

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`
    const name = String(key)
    return acc ? `${acc}.${name}` : name
  }, '')
}

/**
 * Valida uma Configuração já lida do JSON. Nunca lança: devolve os problemas
 * todos de uma vez, para a tela (e a IA) corrigirem numa passada só.
 *
 * A varredura de segredo (RN-CFG-05) vem antes e é independente da forma: um
 * arquivo com PAT é recusado mesmo que o resto esteja certo.
 */
export function validateConfiguration(raw: unknown): ConfigurationResult {
  const issues: ConfigurationIssue[] = findSecrets(raw).map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message
  }))

  const parsed = configurationSchema.safeParse(raw)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ path: formatPath(issue.path), message: issue.message })
    }
  }

  if (issues.length > 0 || !parsed.success) return { ok: false, issues }
  return { ok: true, config: parsed.data }
}

/**
 * RN-CFG-02: IDs de Produto e Grupo que existiam e sumiram.
 *
 * O schema não enxerga a versão anterior do arquivo, então quem salva compara as
 * duas. Um ID sumido pode ser remoção legítima ou renomeação — e a renomeação
 * órfã os Dados de trabalho guardados sob o ID antigo. Quem chama decide como
 * avisar; aqui só se aponta.
 */
export function removedIds(
  previous: Pick<Configuration, 'products' | 'groups'>,
  next: Pick<Configuration, 'products' | 'groups'>
): { products: string[]; groups: string[] } {
  const gone = (before: { id: string }[], after: { id: string }[]): string[] => {
    const kept = new Set(after.map((item) => item.id))
    return before.map((item) => item.id).filter((itemId) => !kept.has(itemId))
  }
  return {
    products: gone(previous.products, next.products),
    groups: gone(previous.groups, next.groups)
  }
}
