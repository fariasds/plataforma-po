import { useMemo } from 'react'
import { Space, Table, Tag, Tooltip, Typography } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import { calcBusinessHours } from '@shared/business-hours'
import { createCalendar, type Calendar } from '@shared/calendar'
import type { BugItem } from '@shared/dashboards'
import { StateTag } from '../../components/StateTag'
import { formatDateTime, formatHours, t } from '../../i18n'
import { useConfiguration } from '../../ipc/useAzure'
import { MONO_FONT, STATUS } from '../../theme'
import { getCriticalityColor } from './constants'

/** Green when closed before the due date, red with the overrun in business hours. */
function SlaIcon({
  closedDate,
  dueDate,
  calendar
}: {
  closedDate?: string
  dueDate?: string
  calendar: Calendar
}): React.JSX.Element | null {
  if (!closedDate || !dueDate) return null

  if (new Date(closedDate) <= new Date(dueDate)) {
    return (
      <Tooltip title={t('bugs.withinSla')}>
        <CheckCircleFilled style={{ color: STATUS.ok.solid }} />
      </Tooltip>
    )
  }

  return (
    <Tooltip
      title={t('bugs.slaExceeded', {
        hours: formatHours(calcBusinessHours(dueDate, closedDate, calendar))
      })}
    >
      <ExclamationCircleFilled style={{ color: STATUS.danger.solid }} />
    </Tooltip>
  )
}

export function BugList({ bugs }: { bugs: BugItem[] }): React.JSX.Element {
  const { calendar: calendarSettings, criticality } = useConfiguration()
  const workItemHref = useWorkItemHref()
  const calendar = useMemo(() => createCalendar(calendarSettings), [calendarSettings])
  return (
    <Table<BugItem>
      size="small"
      rowKey="id"
      dataSource={bugs}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      locale={{ emptyText: t('bugs.listEmpty') }}
      columns={[
        {
          title: t('common.id'),
          width: 90,
          render: (_, bug) => (
            <Typography.Link
              style={{ fontFamily: MONO_FONT }}
              href={workItemHref(bug.id)}
              target="_blank"
              rel="noreferrer"
            >
              #{bug.id}
            </Typography.Link>
          )
        },
        {
          title: t('common.title'),
          render: (_, bug) => (
            <Space size={6}>
              {bug.isRecurrent && <Tag color="warning">{t('bugs.recurrentTag')}</Tag>}
              {bug.title}
            </Space>
          )
        },
        {
          title: t('common.status'),
          width: 130,
          render: (_, bug) => <StateTag state={bug.state} />
        },
        {
          title: t('bugs.criticality'),
          width: 170,
          render: (_, bug) => (
            <Tag
              style={{
                background: getCriticalityColor(bug.criticality, criticality),
                color: '#FFFFFF',
                border: 'none'
              }}
            >
              {bug.criticality}
            </Tag>
          )
        },
        {
          title: t('bugs.created'),
          width: 150,
          render: (_, bug) => (
            <Typography.Text type="secondary">{formatDateTime(bug.createdDate)}</Typography.Text>
          )
        },
        {
          title: t('bugs.closed'),
          width: 165,
          render: (_, bug) => (
            <Space size={6}>
              <Typography.Text type="secondary">
                {bug.closedDate ? formatDateTime(bug.closedDate) : '—'}
              </Typography.Text>
              <SlaIcon closedDate={bug.closedDate} dueDate={bug.dueDate} calendar={calendar} />
            </Space>
          )
        }
      ]}
    />
  )
}
