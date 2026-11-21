import { existsSync, readFileSync } from 'fs'
import {
  parseConfigurationText,
  planImport,
  type ConfigurationDiff,
  type DiffEntry
} from '@shared/config/import'
import type { Configuration } from '@shared/config/schema'
import type { ConfigurationIssue } from '@shared/config/validate'
import { writeFileAtomic } from '../profile/atomic-write'
import { configPath, proposalPath } from '../profile/paths'
import { toolError, type McpTool, type ToolResult } from './protocol'

/**
 * As ferramentas que a IA do PO chama (ADR 0010). Duas só leem; a única que grava
 * escreve a proposta, e só ela (RN-SEC-35). Aplicar é sempre do PO, na janela
 * (RN-CFG-12).
 */

function text(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }] }
}

function issuesText(issues: ConfigurationIssue[]): string {
  return issues.map((issue) => `- ${issue.path || '(arquivo)'}: ${issue.message}`).join('\n')
}

const KIND_LABEL = { added: 'Entra', changed: 'Muda', removed: 'Sai' } as const
const ENTITY_LABEL = {
  products: 'Produto',
  groups: 'Grupo',
  squads: 'Squad',
  processProfiles: 'Perfil de processo'
} as const

/** A diferença em texto, para o modelo resumir ao PO. */
export function diffText(diff: ConfigurationDiff): string {
  const lines: string[] = []
  for (const kind of ['added', 'changed', 'removed'] as const) {
    for (const entity of Object.keys(ENTITY_LABEL) as (keyof typeof ENTITY_LABEL)[]) {
      for (const entry of diff[entity][kind] as DiffEntry[]) {
        const name = entry.name === entry.id ? '' : ` "${entry.name}"`
        lines.push(`- ${KIND_LABEL[kind]}: ${ENTITY_LABEL[entity]}${name} (${entry.id})`)
      }
    }
  }
  for (const section of diff.sections) lines.push(`- Muda: ${section}`)
  return lines.length > 0 ? lines.join('\n') : '- Nada muda em relação à Configuração em uso.'
}

/** A Configuração em uso, como está no disco. Inválida, é `null`: sem ela não há o que comparar. */
function currentConfiguration(profileId: string): Configuration | null {
  const file = configPath(profileId)
  if (!existsSync(file)) return null
  const result = parseConfigurationText(readFileSync(file, 'utf8'))
  return result.ok ? result.config : null
}

/** A IA pode mandar a Configuração como objeto ou como texto JSON. */
function configurationArgument(args: Record<string, unknown>): string | null {
  const value = args.configuracao
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return null
}

const CONFIGURATION_INPUT = {
  type: 'object',
  properties: {
    configuracao: {
      type: 'object',
      description:
        'A Configuração inteira, como ficaria, no formato de configuracao.json (veja o recurso plataforma-po://configuracao/schema). Nunca inclua o token do Azure.'
    }
  },
  required: ['configuracao'],
  additionalProperties: false
}

const MISSING_ARGUMENT =
  'Mande a Configuração inteira no argumento "configuracao", como objeto JSON.'

export function configurationTools(profileId: string): McpTool[] {
  return [
    {
      name: 'ler_configuracao',
      title: 'Ler a Configuração',
      description:
        'Lê a Configuração em uso no Perfil (configuracao.json), com os erros, se houver. Comece por aqui.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      readOnly: true,
      call: () => {
        const file = configPath(profileId)
        if (!existsSync(file)) return toolError('O Perfil ainda não tem configuracao.json.')
        const content = readFileSync(file, 'utf8')
        const result = parseConfigurationText(content)
        const status = result.ok
          ? 'A Configuração em uso é válida.'
          : `A Configuração no disco tem erros; o app segue com a última versão válida:\n${issuesText(result.issues)}`
        return text(`${status}\n\n${content}`)
      }
    },
    {
      name: 'validar',
      title: 'Validar uma Configuração',
      description:
        'Confere uma Configuração completa com as mesmas regras do app e diz o que ela mudaria. Não grava nada.',
      inputSchema: CONFIGURATION_INPUT,
      readOnly: true,
      call: (args) => {
        const json = configurationArgument(args)
        if (json === null) return toolError(MISSING_ARGUMENT)
        const plan = planImport(currentConfiguration(profileId), json)
        if (!plan.ok)
          return toolError(`O app recusaria esta Configuração:\n${issuesText(plan.issues)}`)
        return text(`Configuração válida. O que mudaria:\n${diffText(plan.diff)}`)
      }
    },
    {
      name: 'propor_configuracao',
      title: 'Propor a Configuração ao PO',
      description:
        'Grava a Configuração como proposta para o PO revisar e aplicar na Plataforma do PO. Não muda a Configuração em uso. Valide antes.',
      inputSchema: CONFIGURATION_INPUT,
      readOnly: false,
      call: (args) => {
        const json = configurationArgument(args)
        if (json === null) return toolError(MISSING_ARGUMENT)
        // Proposta recusada não é gravada: a IA corrige antes de o PO ver.
        const plan = planImport(currentConfiguration(profileId), json)
        if (!plan.ok) {
          return toolError(
            `Nada foi gravado. O app recusaria esta Configuração:\n${issuesText(plan.issues)}`
          )
        }
        writeFileAtomic(proposalPath(profileId), JSON.stringify(plan.content, null, 2) + '\n')
        return text(
          `Proposta gravada. O que muda:\n${diffText(plan.diff)}\n\nPeça ao PO para abrir a Plataforma do PO: no topo aparece a proposta, e nada muda até ele clicar em Aplicar.`
        )
      }
    }
  ]
}
