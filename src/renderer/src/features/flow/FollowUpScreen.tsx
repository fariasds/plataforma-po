import { Alert, Card, Empty, Flex, Skeleton, Space, Table, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { FeatureBugs, FollowUpBug, RuleBugs, RuleToConfirm } from '@shared/flow-follow-up'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { ProductFilter } from '../../components/ProductFilter'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import { formatDateTime, t } from '../../i18n'
import { ipc } from '../../ipc/client'
import { useSelection } from '../../ipc/useAzure'
import { MONO_FONT, STATUS } from '../../theme'
import { useFlowSnapshot } from './useFlow'

const { Text } = Typography

/**
 * Acompanhamento: o que a entrega trouxe de volta (RN-FLX-21 a RN-FLX-24). Bugs que
 * faltam analisar, onde os bugs se concentram, por Feature e por regra, e as regras
 * novas entregues que ainda não foram conferidas em uso.
 */
export function FollowUpScreen(): React.JSX.Element {
  const href = useWorkItemHref()
  const selection = useSelection('flow')
  const productId = selection.value
  const snapshot = useFlowSnapshot(productId)
  const view = useQuery({
    queryKey: ['follow-up', productId, snapshot.data?.takenAt ?? null],
    enabled: productId !== '' && !snapshot.isPending,
    staleTime: 0,
    queryFn: () => ipc.getFollowUp(productId)
  })

  if (selection.options.length === 0) return <Empty description={t('flow.noProducts')} />

  const id = (value: number): React.ReactNode => {
    const link = href(value)
    const label = <span style={{ fontFamily: MONO_FONT }}>#{value}</span>
    return link ? (
      <a href={link} target="_blank" rel="noreferrer">
        {label}
      </a>
    ) : (
      label
    )
  }

  // "Bug" é estouro do que a regra prometia; "A validar" pede olhar; o resto é neutro.
  const verdictTag = (bug: FollowUpBug): React.JSX.Element => {
    const tone =
      bug.verdict === 'Bug'
        ? STATUS.danger
        : bug.verdict === 'A validar' || bug.verdict === null
          ? STATUS.warning
          : STATUS.neutral
    return (
      <Tag variant="filled" style={{ marginInlineEnd: 0, background: tone.bg, color: tone.text }}>
        {bug.verdict ?? t('followUp.verdict.none')}
      </Tag>
    )
  }

  const bugTitle = (bug: FollowUpBug): React.ReactNode => (
    <Flex gap={8} align="baseline">
      {id(bug.id)}
      <Text>{bug.title}</Text>
      {!bug.open && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('followUp.closed')}
        </Text>
      )}
    </Flex>
  )

  const data = view.data
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <ProductFilter
          options={selection.options}
          value={productId}
          onChange={selection.onChange}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {data?.snapshotTakenAt
            ? t('flow.snapshotAt', { date: formatDateTime(data.snapshotTakenAt) })
            : t('flow.noSnapshot')}
        </Text>
      </Flex>

      {snapshot.isError && (
        <Alert
          type="warning"
          showIcon
          title={t('flow.snapshotFailed')}
          description={snapshot.error.message}
        />
      )}
      {view.isError && <ErrorState error={view.error} onRetry={() => view.refetch()} />}
      {data && data.workFolder !== 'ok' && (
        <Alert type="info" showIcon title={t('followUp.noFolder')} />
      )}
      {data && data.workFolder === 'ok' && !data.catalogConfigured && (
        <Alert type="info" showIcon title={t('followUp.noCatalog')} />
      )}

      {view.isPending ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Card size="small" title={t('followUp.unanalyzed.title')}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                {t('followUp.unanalyzed.hint')}
              </Text>
              <Table<FollowUpBug>
                size="small"
                rowKey="id"
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                dataSource={data?.unanalyzed ?? []}
                locale={{ emptyText: <Empty description={t('followUp.unanalyzed.empty')} /> }}
                columns={[
                  {
                    title: t('followUp.columns.bug'),
                    key: 'bug',
                    render: (_: unknown, b) => bugTitle(b)
                  },
                  { title: t('followUp.columns.state'), dataIndex: 'state', width: 140 }
                ]}
              />
            </Space>
          </Card>

          <Card
            size="small"
            title={
              <Flex gap={6} align="center">
                {t('followUp.byFeature.title')}
                <HelpTip rule="RN-FLX-22" />
              </Flex>
            }
          >
            {(data?.byFeature ?? []).length === 0 ? (
              <Empty description={t('followUp.byFeature.empty')} />
            ) : (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                {data!.byFeature.map((feature: FeatureBugs) => (
                  <div key={feature.featureId}>
                    <Flex gap={8} align="baseline" style={{ marginBottom: 6 }}>
                      {id(feature.featureId)}
                      <Text style={{ fontWeight: 500 }}>{feature.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('followUp.byFeature.bugs', { count: feature.bugs.length })}
                      </Text>
                    </Flex>
                    <Table<FeatureBugs['bugs'][number]>
                      size="small"
                      rowKey="id"
                      pagination={false}
                      dataSource={feature.bugs}
                      columns={[
                        {
                          title: t('followUp.columns.bug'),
                          key: 'bug',
                          render: (_: unknown, b) => bugTitle(b)
                        },
                        {
                          title: t('followUp.columns.verdict'),
                          key: 'verdict',
                          width: 130,
                          render: (_: unknown, b) => verdictTag(b)
                        },
                        {
                          title: t('followUp.columns.via'),
                          dataIndex: 'via',
                          width: 130,
                          render: (via: FeatureBugs['bugs'][number]['via']) =>
                            t(`followUp.via.${via}`)
                        }
                      ]}
                    />
                  </div>
                ))}
              </Space>
            )}
          </Card>

          <Card size="small" title={t('followUp.byRule.title')}>
            <Table<RuleBugs>
              size="small"
              rowKey="rule"
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              dataSource={data?.byRule ?? []}
              locale={{ emptyText: <Empty description={t('followUp.byRule.empty')} /> }}
              columns={[
                {
                  title: t('followUp.columns.rule'),
                  key: 'rule',
                  render: (_: unknown, r) => (
                    <Flex gap={8} align="baseline">
                      <span style={{ fontFamily: MONO_FONT }}>{r.rule}</span>
                      <Text type="secondary">{r.title ?? ''}</Text>
                    </Flex>
                  )
                },
                {
                  title: t('followUp.columns.bugs'),
                  key: 'bugs',
                  render: (_: unknown, r) => (
                    <Flex gap={8} wrap>
                      {r.bugs.map((b) => (
                        <span key={b}>{id(b)}</span>
                      ))}
                    </Flex>
                  )
                }
              ]}
            />
          </Card>

          <Card size="small" title={t('followUp.toConfirm.title')}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                {t('followUp.toConfirm.hint')}
              </Text>
              <Table<RuleToConfirm>
                size="small"
                rowKey="rule"
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                dataSource={data?.toConfirm ?? []}
                locale={{ emptyText: <Empty description={t('followUp.toConfirm.empty')} /> }}
                columns={[
                  {
                    title: t('followUp.columns.rule'),
                    key: 'rule',
                    render: (_: unknown, r) => (
                      <Flex gap={8} align="baseline">
                        <span style={{ fontFamily: MONO_FONT }}>{r.rule}</span>
                        <Text>{r.title}</Text>
                      </Flex>
                    )
                  },
                  {
                    title: t('followUp.columns.pbi'),
                    key: 'pbi',
                    width: 200,
                    render: (_: unknown, r) => (
                      <Flex gap={8} align="baseline">
                        {id(r.pbi)}
                        <Text type="secondary">{r.pbiState}</Text>
                      </Flex>
                    )
                  },
                  {
                    title: t('followUp.columns.file'),
                    dataIndex: 'file',
                    width: 200,
                    render: (file: string) => <Text type="secondary">{file}</Text>
                  }
                ]}
              />
            </Space>
          </Card>
        </>
      )}
    </Space>
  )
}
