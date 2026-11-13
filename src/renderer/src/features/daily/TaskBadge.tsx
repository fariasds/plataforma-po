import { Checkbox, Flex, Popover, Typography } from 'antd'
import { CheckSquareOutlined } from '@ant-design/icons'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import type { DailyTask } from '@shared/dashboards'
import { t } from '../../i18n'
import { NEUTRA, STATUS } from '../../theme'
import { AssigneeAvatar } from './AssigneeAvatar'

const { Text } = Typography

/**
 * Contador de tasks no formato `concluídas/total`, como no card do Azure DevOps.
 * Clicar abre a lista com o estado de cada uma.
 *
 * Os checkboxes são **somente leitura**: o app lê o Azure, não escreve nele.
 */
export function TaskBadge({ tasks }: { tasks: DailyTask[] }): React.JSX.Element | null {
  const workItemHref = useWorkItemHref()
  if (tasks.length === 0) return null

  const done = tasks.filter((t) => t.done).length
  const complete = done === tasks.length

  return (
    <Popover
      trigger={['hover', 'click']}
      placement="bottomLeft"
      title={t('daily.tasksTitle', { done, total: tasks.length })}
      content={
        <Flex vertical gap={6} style={{ maxWidth: 340 }}>
          {tasks.map((task) => (
            <Flex key={task.id} align="flex-start" gap={8}>
              <Checkbox checked={task.done} disabled style={{ marginTop: 2 }} />
              <Flex vertical style={{ minWidth: 0 }}>
                <Text
                  delete={task.done}
                  type={task.done ? 'secondary' : undefined}
                  style={{ fontSize: 12.5 }}
                >
                  {task.title}
                </Text>
                <Flex align="center" gap={6}>
                  <AssigneeAvatar assignee={task.assignee} size={16} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {task.assignee?.displayName ?? t('common.unassigned')}
                  </Text>
                  <Typography.Link
                    href={workItemHref(task.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11 }}
                  >
                    #{task.id}
                  </Typography.Link>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {task.state}
                  </Text>
                </Flex>
              </Flex>
            </Flex>
          ))}
        </Flex>
      }
    >
      <Flex
        align="center"
        gap={4}
        style={{
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          padding: '1px 7px',
          borderRadius: 5,
          border: `1px solid ${complete ? STATUS.ok.bg : NEUTRA[200]}`,
          background: complete ? STATUS.ok.bg : NEUTRA[100],
          color: complete ? STATUS.ok.text : NEUTRA[600]
        }}
      >
        <CheckSquareOutlined style={{ fontSize: 11 }} />
        {done}/{tasks.length}
      </Flex>
    </Popover>
  )
}
