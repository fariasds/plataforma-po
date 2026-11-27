import { existsSync, readFileSync } from 'fs'
import {
  RULE_FIRST_PROMPTS,
  type InstructionState,
  type RuleFirstPromptName
} from '@shared/flow-prompts'
import analisarBug from '../../../resources/mcp/rule-first/analisar-bug.md?raw'
import discovery from '../../../resources/mcp/rule-first/discovery.md?raw'
import encaixarOportunidade from '../../../resources/mcp/rule-first/encaixar-oportunidade.md?raw'
import quebra from '../../../resources/mcp/rule-first/quebra.md?raw'
import reescreverBug from '../../../resources/mcp/rule-first/reescrever-bug.md?raw'
import resumirFeedback from '../../../resources/mcp/rule-first/resumir-feedback.md?raw'
import { instructionPath, instructionProposalPath } from '../profile/paths'

/**
 * Os textos de instrução do processo rule-first (ADR 0014, RN-FLX-26): o de fábrica,
 * que vem com o app, ou o do PO, em `instrucoes/<nome>.md` na pasta do Perfil. Só
 * leitura: a janela aplica e o servidor MCP propõe, cada um no seu módulo.
 */

const DEFAULTS: Record<RuleFirstPromptName, string> = {
  resumir_feedback: resumirFeedback,
  encaixar_oportunidade: encaixarOportunidade,
  discovery,
  quebra,
  analisar_bug: analisarBug,
  reescrever_bug: reescreverBug
}

export function defaultInstruction(name: RuleFirstPromptName): string {
  return DEFAULTS[name]
}

function readIfExists(file: string): string | null {
  if (!existsSync(file)) return null
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** O texto em uso: o do PO, se ele trocou e o arquivo não está vazio; senão, o de fábrica. */
export function currentInstruction(profileId: string, name: RuleFirstPromptName): string {
  const own = readIfExists(instructionPath(profileId, name))
  return own !== null && own.trim() !== '' ? own : DEFAULTS[name]
}

export function instructionStates(profileId: string): InstructionState[] {
  return RULE_FIRST_PROMPTS.map((prompt) => {
    const own = readIfExists(instructionPath(profileId, prompt.name))
    return {
      name: prompt.name,
      title: prompt.title,
      overridden: own !== null && own.trim() !== '',
      current: currentInstruction(profileId, prompt.name),
      proposal: readIfExists(instructionProposalPath(profileId, prompt.name))
    }
  })
}
