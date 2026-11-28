import { Alert, Empty, Flex, Skeleton, Space, Table, Tag, Typography, theme } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { FitStatus, Opportunity } from '@shared/flow-opportunities'
import { ErrorState } from '../../components/ErrorState'
import { ProductFilter } from '../../components/ProductFilter'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import { formatDateTime, t } from '../../i18n'
import { ipc } from '../../ipc/client'
import { useSelection } from '../../ipc/useAzure'
import { MONO_FONT, STATUS } from '../../theme'
import { useFlowSnapshot } from './useFlow'

const { Text } = Typography

/**
 * Oportunidades: o que chegou e ainda não tem Feature, e o que falta para fechar o
 * encaixe (RN-FLX-14 a RN-FLX-16, RN-FLX-25). O encaixe em si é feito pela IA do PO,
 * com o prompt encaixar_oportunidade; a tela mostra o resultado.
 */
export function OpportunitiesScreen(): React.JSX.Element {
  const { token } = theme.useToken()
  const href = useWorkItemHref()
  const selection = useSelection('flow')
  const productId = selection.value
  const snapshot = useFlowSnapshot(productId)
  const view = useQuery({
    queryKey: ['opportunities', productId, snapshot.data?.takenAt ?? null],
    enabled: productId !== '' && !snapshot.isPending,
    staleTime: 0,
    queryFn: () => ipc.getOpportunities(productId)
  })

  if (selection.options.length === 0) return <Empty description={t('flow.noProducts')} />

  // Sem encaixe pede olhar; proposto pede um gesto do PO (o destaque); encaixada está dentro.
  const fitTag = (fit: FitStatus): React.JSX.Element => {
    const tone =
      fit === 'Sem encaixe'
        ? { bg: STATUS.warning.bg, text: STATUS.warning.text }
        : fit === 'Proposto'
          ? { bg: token.colorPrimaryBg, text: token.colorPrimaryText }
          : fit === 'Encaixada'
            ? { bg: STATUS.ok.bg, text: STATUS.ok.text }
            : { bg: STATUS.neutral.bg, text: STATUS.neutral.text }
    return (
      <Tag variant="filled" style={{ marginInlineEnd: 0, background: tone.bg, color: tone.text }}>
        {t(`opportunities.fit.${fit}`)}
      </Tag>
    )
  }

  const id = (value: number | null): React.ReactNode => {
    if (value === null) return null
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
      {data && !data.feedbackConfigured && (
        <Alert type="info" showIcon title={t('opportunities.noFeedback')} />
      )}
      {data && data.workFolder !== 'ok' && (
        <Alert type="info" showIcon title={t('opportunities.noFolder')} />
      )}

      {view.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Table<Opportunity>
          size="small"
          rowKey="key"
          pagination={{ pageSize: 30, hideOnSinglePage: true }}
          dataSource={data?.opportunities ?? []}
          locale={{ emptyText: <Empty description={t('opportunities.empty')} /> }}
          columns={[
            {
              title: t('opportunities.columns.opportunity'),
              key: 'title',
              render: (_: unknown, o) => (
                <Flex gap={8} align="baseline">
                  {id(o.azureId)}
                  <Text style={{ fontWeight: 500 }}>{o.title}</Text>
                </Flex>
              )
            },
            {
              title: t('opportunities.columns.source'),
              dataIndex: 'source',
              width: 110,
              render: (source: Opportunity['source']) => t(`opportunities.source.${source}`)
            },
            {
              title: t('opportunities.columns.fit'),
              dataIndex: 'fit',
              width: 130,
              render: fitTag
            },
            {
              title: t('opportunities.columns.feature'),
              key: 'feature',
              render: (_: unknown, o) =>
                o.feature === null ? null : 'id' in o.feature ? (
                  <Flex gap={6} align="baseline">
                    {id(o.feature.id)}
                    <Text type="secondary">{o.feature.title ?? ''}</Text>
                  </Flex>
                ) : (
                  <Text type="secondary">
                    {t('opportunities.newFeature', { title: o.feature.newTitle })}
                  </Text>
                )
            },
            {
              title: t('opportunities.columns.next'),
              key: 'next',
              render: (_: unknown, o) => (
                <Text style={{ fontSize: 12.5 }}>
                  {o.fit === 'Descartada' ? (o.discardReason ?? '') : (o.action ?? '')}
                </Text>
              )
            }
          ]}
        />
      )}
    </Space>
  )
}
