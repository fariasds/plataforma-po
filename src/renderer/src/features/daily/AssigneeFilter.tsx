import { Flex, Tooltip, Typography } from 'antd'
import type { DailyAssignee } from '@shared/dashboards'
import { t } from '../../i18n'
import { NEUTRA } from '../../theme'
import { useAccent } from './constants'
import { AssigneeAvatar } from './AssigneeAvatar'

const { Text } = Typography

interface Props {
  assignees: DailyAssignee[]
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * Filtro rápido por responsável: as fotas de quem tem item em andamento, mais
 * "Todos". Clicar no selecionado remove o filtro.
 *
 * É uma fileira de avatares em vez de um seletor porque a pergunta na daily é
 * visual — "quem está com o quê" — e o time se reconhece pela foto antes do nome.
 */
export function AssigneeFilter({ assignees, value, onChange }: Props): React.JSX.Element {
  const accent = useAccent()
  return (
    <Flex align="center" gap={5} wrap>
      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          font: 'inherit',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 999,
          cursor: 'pointer',
          border: `1px solid ${value === null ? accent.base : NEUTRA[200]}`,
          background: value === null ? accent.bg : 'transparent',
          color: value === null ? accent.base : NEUTRA[500]
        }}
      >
        {t('common.all')}
      </button>

      {assignees.map((assignee) => {
        const active = value === assignee.displayName
        return (
          <Tooltip key={assignee.displayName} title={assignee.displayName}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : assignee.displayName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 2,
                borderRadius: 999,
                cursor: 'pointer',
                background: 'transparent',
                border: `2px solid ${active ? accent.base : 'transparent'}`,
                opacity: value === null || active ? 1 : 0.45,
                transition: 'opacity .15s, border-color .15s'
              }}
            >
              <AssigneeAvatar assignee={assignee} size={22} />
            </button>
          </Tooltip>
        )
      })}

      {value !== null && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {value}
        </Text>
      )}
    </Flex>
  )
}
