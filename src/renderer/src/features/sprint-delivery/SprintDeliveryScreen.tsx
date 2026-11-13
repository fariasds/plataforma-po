import { useMemo, useState } from 'react'
import {
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tooltip,
  Typography,
  theme
} from 'antd'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import type { DeliveredItem } from '@shared/dashboards'
import { DashboardFilters } from '../../components/DashboardFilters'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { formatDateTime, formatHours, formatList, t } from '../../i18n'
import { StateTag } from '../../components/StateTag'
import { useConfiguration, useSelection, useSprintDelivery, useSprints } from '../../ipc/useAzure'
import { MONO_FONT, STATUS, workItemColor } from '../../theme'
import { developmentTypesOf, summarizeDelivery } from './summary'

const { Text } = Typography

export function SprintDeliveryScreen(): React.JSX.Element {
  const config = useConfiguration()
  const workItemHref = useWorkItemHref()
  const selection = useSelection('review')
  const product = selection.value
  const [sprintKey, setSprintKey] = useState<string>()
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const sprints = useSprints(5)
  const selectedSprint = sprints.data?.find((s) => s.key === sprintKey) ?? sprints.data?.[0]
  const delivery = useSprintDelivery(product, selectedSprint)

  // Memoized so the empty-array fallback does not create a new reference each render.
  const deliveredItems = useMemo(() => delivery.data?.deliveredItems ?? [], [delivery.data])
  const typeDistributionInSprint = delivery.data?.typeDistributionInSprint ?? []
  const totalTypeHours = typeDistributionInSprint.reduce((sum, d) => sum + d.value, 0)
  const { token } = theme.useToken()

  const developmentTypes = useMemo(() => developmentTypesOf(config, product), [config, product])
  const {
    delivered,
    totalInSprint,
    completionRate,
    devHoursInSprint,
    devPercent,
    typeCounts: typeEntries
  } = useMemo(
    () => summarizeDelivery(delivery.data, developmentTypes),
    [delivery.data, developmentTypes]
  )

  const filteredItems = selectedType
    ? deliveredItems.filter((d) => d.workItem.fields['System.WorkItemType'] === selectedType)
    : deliveredItems

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <DashboardFilters
        selection={selection}
        sprints={sprints.data}
        selectedSprintKey={selectedSprint?.key}
        onSprintChange={setSprintKey}
      />

      {sprints.isError && <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />}
      {delivery.isError && <ErrorState error={delivery.error} onRetry={() => delivery.refetch()} />}

      {delivery.isPending || delivery.isFetching ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Card>
                  <Statistic
                    title={
                      <Flex align="center" justify="space-between" gap={8}>
                        <span>{t('delivery.delivered')}</span>
                        <HelpTip rule="RN-ENT-04" />
                      </Flex>
                    }
                    value={delivered}
                    suffix={
                      <Text type="secondary">
                        {t('delivery.inSprint', { total: totalInSprint })}
                      </Text>
                    }
                  />
                  <Progress
                    percent={completionRate}
                    strokeColor={STATUS.ok.solid}
                    showInfo={false}
                  />
                  <Text type="secondary">
                    {t('delivery.completion', { percent: completionRate })}
                  </Text>
                </Card>

                <Card>
                  <Statistic
                    title={
                      <Flex align="center" justify="space-between" gap={8}>
                        <span>{t('delivery.devFocus')}</span>
                        <HelpTip rule="RN-ENT-05" />
                      </Flex>
                    }
                    value={devPercent}
                    suffix="%"
                  />
                  <Progress percent={devPercent} showInfo={false} />
                  <Text type="secondary">
                    {t('delivery.devHours', {
                      hours: formatHours(devHoursInSprint),
                      types: formatList(developmentTypes)
                    })}
                  </Text>
                </Card>
              </Space>
            </Col>

            <Col xs={24} md={16}>
              <Card
                title={t('delivery.effortByType')}
                extra={<HelpTip rule="RN-ENT-09" />}
                style={{ height: '100%' }}
              >
                {typeDistributionInSprint.length === 0 ? (
                  <Empty description={t('delivery.noneDelivered')} />
                ) : (
                  <Flex vertical gap={16}>
                    {/*
                      Barra empilhada no lugar da rosca: comprimento compara melhor que
                      ângulo, e a fatia pequena (um Ad Hoc de 6 h) continua visível.
                    */}
                    <Tooltip title={t('delivery.devInSprint')}>
                      <Flex
                        gap={2}
                        style={{ height: 14, borderRadius: 7, overflow: 'hidden' }}
                        role="img"
                        aria-label={t('delivery.devInSprint')}
                      >
                        {typeDistributionInSprint.map((entry) => (
                          <div
                            key={entry.name}
                            style={{
                              flex: `${entry.value} 1 0`,
                              background: workItemColor(entry.name)
                            }}
                          />
                        ))}
                      </Flex>
                    </Tooltip>

                    <Flex vertical gap={2}>
                      {typeEntries.map(([type, count]) => {
                        const hours =
                          typeDistributionInSprint.find((d) => d.name === type)?.value ?? 0
                        const share =
                          totalTypeHours > 0 ? Math.round((hours / totalTypeHours) * 100) : 0
                        const isActive = selectedType === type
                        return (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelectedType(isActive ? null : type)}
                            style={{
                              font: 'inherit',
                              display: 'grid',
                              gridTemplateColumns: '12px 1fr 72px 48px 40px',
                              alignItems: 'center',
                              gap: 12,
                              padding: '8px 10px',
                              border: 0,
                              borderRadius: 9,
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: token.colorText,
                              background: isActive ? token.colorPrimaryBg : 'transparent'
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 3,
                                background: workItemColor(type)
                              }}
                            />
                            <Text strong={isActive}>{type}</Text>
                            <Text
                              type="secondary"
                              style={{ fontFamily: MONO_FONT, textAlign: 'right' }}
                            >
                              {formatHours(hours)}
                            </Text>
                            <Text
                              type="secondary"
                              style={{ fontFamily: MONO_FONT, textAlign: 'right' }}
                            >
                              {share}%
                            </Text>
                            <Text strong style={{ textAlign: 'right' }}>
                              {count}
                            </Text>
                          </button>
                        )
                      })}
                    </Flex>
                  </Flex>
                )}
              </Card>
            </Col>
          </Row>

          <Card
            title={selectedType ?? t('delivery.delivered')}
            extra={
              <Text type="secondary">
                {t('delivery.itemCount', { count: filteredItems.length })}
              </Text>
            }
          >
            <Table<DeliveredItem>
              size="small"
              rowKey={(record) => record.workItem.id}
              dataSource={filteredItems}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description={t('delivery.noneForFilter')} /> }}
              columns={[
                {
                  title: t('common.id'),
                  width: 90,
                  render: (_, { workItem }) => (
                    <Typography.Link
                      style={{ fontFamily: MONO_FONT }}
                      href={workItemHref(workItem.fields['System.Id'])}
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{workItem.fields['System.Id']}
                    </Typography.Link>
                  )
                },
                {
                  title: t('common.title'),
                  render: (_, { workItem }) => workItem.fields['System.Title']
                },
                {
                  title: t('delivery.type'),
                  width: 160,
                  render: (_, { workItem }) => {
                    const type = workItem.fields['System.WorkItemType']
                    return (
                      <Flex align="center" gap={7}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            flex: 'none',
                            background: workItemColor(type)
                          }}
                        />
                        <Text>{type}</Text>
                      </Flex>
                    )
                  }
                },
                {
                  title: t('common.status'),
                  width: 120,
                  render: (_, { workItem }) => <StateTag state={workItem.fields['System.State']} />
                },
                {
                  title: t('delivery.createdClosed'),
                  width: 170,
                  render: (_, { workItem, closedAt }) => (
                    <>
                      <div>
                        <Text type="secondary">
                          {formatDateTime(workItem.fields['System.CreatedDate'])}
                        </Text>
                      </div>
                      <div>{formatDateTime(closedAt)}</div>
                    </>
                  )
                },
                {
                  title: (
                    <Flex align="center" justify="flex-end" gap={6}>
                      <span>{t('delivery.devTotal')}</span>
                      <HelpTip rule="RN-ENT-06" />
                    </Flex>
                  ),
                  width: 160,
                  align: 'right',
                  render: (_, { leadTimeHours, devTimeInSprintHours }) => (
                    <>
                      <div>
                        <Text type="secondary">{formatHours(leadTimeHours)}</Text>
                      </div>
                      <div>
                        <Text strong>{formatHours(devTimeInSprintHours)}</Text>
                      </div>
                    </>
                  )
                }
              ]}
            />
          </Card>
        </>
      )}
    </Space>
  )
}
