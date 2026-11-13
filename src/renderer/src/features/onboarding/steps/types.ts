import type { WizardDraft } from '../draft'

/** Toda mudança passa por uma função sobre o rascunho inteiro: os passos se cruzam. */
export type UpdateDraft = (change: (draft: WizardDraft) => WizardDraft) => void

export interface StepProps {
  draft: WizardDraft
  update: UpdateDraft
}
