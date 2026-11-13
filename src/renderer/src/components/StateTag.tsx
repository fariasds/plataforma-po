import { Tag } from 'antd'
import { STATUS, type StatusKey } from '../theme'

/**
 * Categoria de cada estado padrão dos processos do Azure DevOps (Basic, Agile,
 * Scrum e CMMI), com a cor que o próprio Azure usa para ela. Estado criado pelo
 * time não está aqui e fica cinza: o app não adivinha o que ele significa.
 */
const AZURE_STATE_COLORS: Record<string, StatusKey> = {
  // Proposto: cinza, como no board do Azure.
  New: 'neutral',
  'To Do': 'neutral',
  Approved: 'neutral',
  Proposed: 'neutral',
  // Em andamento: azul.
  Active: 'info',
  Committed: 'info',
  Doing: 'info',
  'In Progress': 'info',
  // Resolvido: laranja.
  Resolved: 'warning',
  // Concluído: verde.
  Done: 'ok',
  Closed: 'ok',
  // Removido: cinza.
  Removed: 'neutral'
}

/**
 * Work item state, coloured by where it sits in the lifecycle. Shared by every
 * screen that shows a state column, so the same word never reads two ways.
 */
function stateStatus(state: string): StatusKey {
  return Object.hasOwn(AZURE_STATE_COLORS, state) ? AZURE_STATE_COLORS[state] : 'neutral'
}

export function StateTag({ state }: { state: string }): React.JSX.Element {
  const tone = STATUS[stateStatus(state)]
  return (
    <Tag
      variant="filled"
      style={{ background: tone.bg, color: tone.text, fontWeight: 600, marginInlineEnd: 0 }}
    >
      {state}
    </Tag>
  )
}
