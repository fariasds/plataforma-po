import { Avatar, Tooltip } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { DailyAssignee } from '@shared/dashboards'
// Mesma paleta do menu de usuário, para a mesma pessoa ter sempre a mesma cor.
import { AVATAR_COLORS, NEUTRA } from '../../theme'
import { t } from '../../i18n'

function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  assignee: DailyAssignee | null
  size?: number
}

/**
 * Foto do responsável. Quando o Azure não devolve a imagem — falta de escopo no
 * token, por exemplo — cai para as iniciais numa cor derivada do nome, em vez de
 * deixar um vazio.
 */
export function AssigneeAvatar({ assignee, size = 20 }: Props): React.JSX.Element {
  if (!assignee) {
    return (
      <Tooltip title={t('common.unassigned')}>
        <Avatar size={size} icon={<UserOutlined />} style={{ background: NEUTRA[300] }} />
      </Tooltip>
    )
  }

  return (
    <Tooltip title={assignee.displayName}>
      <Avatar
        size={size}
        src={assignee.avatar ?? undefined}
        style={{ background: colorFor(assignee.uniqueName || assignee.displayName), fontSize: 10 }}
      >
        {initialsFor(assignee.displayName)}
      </Avatar>
    </Tooltip>
  )
}
