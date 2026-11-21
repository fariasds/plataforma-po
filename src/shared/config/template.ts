import { z } from 'zod'
import { configurationShape, type Configuration } from './schema'
import { validateAgainst, type ConfigurationIssue } from './validate'

/**
 * Modelo de processo (RN-CFG-10): a parte da Configuração que serve a outra
 * empresa. Leva como o time trabalha e deixa de fora o que é da empresa de quem
 * exportou: organização, Produtos, Grupos, Squads e a cor de destaque.
 */
export const TEMPLATE_KIND = 'modelo-de-processo'

/** Seções que o Modelo leva, na ordem em que aparecem no arquivo. */
export const TEMPLATE_SECTIONS = [
  'processProfiles',
  'customFields',
  'criticality',
  'recurrentBugTag',
  'calendar',
  'storyPoints',
  'capacityDefaults'
] as const

export const processTemplateSchema = configurationShape
  .pick({
    $schema: true,
    version: true,
    processProfiles: true,
    customFields: true,
    criticality: true,
    recurrentBugTag: true,
    calendar: true,
    storyPoints: true,
    capacityDefaults: true
  })
  .extend({
    kind: z.literal(TEMPLATE_KIND).describe('Marca o arquivo como Modelo de processo.')
  })
  .describe(
    'Modelo de processo da Plataforma do PO: Perfis de processo, campos e calendário, sem organização nem Produtos.'
  )

export type ProcessTemplate = z.output<typeof processTemplateSchema>

export type TemplateResult =
  { ok: true; template: ProcessTemplate } | { ok: false; issues: ConfigurationIssue[] }

/** O arquivo diz que é um Modelo? A forma é conferida depois, pelo schema. */
export function isTemplate(raw: unknown): boolean {
  return (
    typeof raw === 'object' && raw !== null && (raw as { kind?: unknown }).kind === TEMPLATE_KIND
  )
}

/** Mesma varredura de segredo da Configuração (RN-CFG-05), antes da forma. */
export function validateTemplate(raw: unknown): TemplateResult {
  const result = validateAgainst(processTemplateSchema, raw)
  return result.ok ? { ok: true, template: result.value } : result
}

/** O Modelo de processo da Configuração em uso, pronto para virar arquivo. */
export function templateFrom(config: Configuration): Record<string, unknown> {
  const template: Record<string, unknown> = { kind: TEMPLATE_KIND, version: 1 }
  for (const section of TEMPLATE_SECTIONS) template[section] = config[section]
  return template
}

/**
 * O Modelo por cima da Configuração em uso. Perfis de processo se somam pelo ID,
 * e o do Modelo vence; as outras seções do Modelo substituem as do Perfil; o que
 * é da empresa (organização, Produtos, Grupos, Squads, cor) fica como está.
 */
export function applyTemplate(
  current: Configuration,
  template: ProcessTemplate
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  for (const section of TEMPLATE_SECTIONS) next[section] = template[section]
  next.processProfiles = { ...current.processProfiles, ...template.processProfiles }
  return next
}
