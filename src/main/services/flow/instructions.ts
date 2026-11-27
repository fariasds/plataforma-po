import { existsSync, readFileSync, rmSync } from 'fs'
import { AppError } from '@shared/errors'
import {
  MAX_INSTRUCTION_BYTES,
  isRuleFirstPrompt,
  type InstructionState
} from '@shared/flow-prompts'
import { instructionStates } from '../../flow/instructions'
import { writeFileAtomic } from '../../profile/atomic-write'
import { instructionPath, instructionProposalPath } from '../../profile/paths'
import { requireActiveProfile } from '../../profile/profile-store'

/**
 * As instruções do processo na janela (ADR 0014, RN-FLX-26): o PO aplica ou descarta
 * o que a IA propôs, e volta ao texto de fábrica quando quiser. O servidor MCP só
 * grava a proposta.
 */

function assertName(name: unknown): string {
  if (!isRuleFirstPrompt(name)) throw new AppError('PROFILE_INVALID', 'Instrução desconhecida.')
  return name
}

export function listInstructions(): InstructionState[] {
  return instructionStates(requireActiveProfile().id)
}

export function applyInstructionProposal(name: string): InstructionState[] {
  const profileId = requireActiveProfile().id
  const proposal = instructionProposalPath(profileId, assertName(name))
  if (!existsSync(proposal))
    throw new AppError('PROFILE_INVALID', 'Não há proposta para esta instrução.')
  const text = readFileSync(proposal, 'utf8')
  if (text.trim() === '' || Buffer.byteLength(text, 'utf8') > MAX_INSTRUCTION_BYTES) {
    throw new AppError('PROFILE_INVALID', 'A proposta está vazia ou passa de 100 KB.')
  }
  writeFileAtomic(instructionPath(profileId, name), text)
  rmSync(proposal, { force: true })
  return listInstructions()
}

export function discardInstructionProposal(name: string): InstructionState[] {
  rmSync(instructionProposalPath(requireActiveProfile().id, assertName(name)), { force: true })
  return listInstructions()
}

/** Voltar ao padrão é apagar o texto do PO (ADR 0014). */
export function resetInstruction(name: string): InstructionState[] {
  rmSync(instructionPath(requireActiveProfile().id, assertName(name)), { force: true })
  return listInstructions()
}
