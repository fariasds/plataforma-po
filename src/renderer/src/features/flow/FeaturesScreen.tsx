import { useState } from 'react'
import { Alert, Button, Collapse, Empty, Flex, Skeleton, Space, Typography } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { BoardFeature } from '@shared/flow-board'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { ProductFilter } from '../../components/ProductFilter'
import { formatDateTime, t } from '../../i18n'
import { useSelection } from '../../ipc/useAzure'
import { MONO_FONT, NEUTRA } from '../../theme'
import { funnelColumns, outsideFunnel } from './board-view'
import { FeatureCard } from './FeatureCard'
import { FeatureDrawer } from './FeatureDrawer'
import { useChooseWorkFolder, useFlowBoard, useFlowSnapshot, useWorkFolders } from './useFlow'

const { Text } = Typography

/**
 * Features: em que Fase está cada Feature do Produto e qual é o próximo passo
 * (RN-FLX-05 a RN-FLX-13). O retrato do Azure é refeito ao abrir a tela e no
 * Atualizar (RN-FLX-02); o resto vem da pasta de trabalho.
 */
export function FeaturesScreen(): React.JSX.Element {
  const selection = useSelection('flow')
  const productId = selection.value
  const productName = selection.selected?.name ?? ''
  const [openKey, setOpenKey] = useState<string | null>(null)

  const snapshot = useFlowSnapshot(productId)
  // Com o retrato em erro, o quadro sai do último retrato gravado.
  const board = useFlowBoard(productId, snapshot.data?.takenAt, !snapshot.isPending)
  const folders = useWorkFolders()
  const choose = useChooseWorkFolder()

  if (selection.options.length === 0) {
    return <Empty description={t('flow.noProducts')} />
  }

  const features = board.data?.features ?? []
  const open = features.find((f) => f.key === openKey) ?? null
  const folder = folders.data?.[productId]
  const takenAt = board.data?.snapshotTakenAt

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <ProductFilter
          options={selection.options}
          value={productId}
          onChange={(id) => {
            setOpenKey(null)
            selection.onChange(id)
          }}
        />
        <Flex align="center" gap={12} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {takenAt
              ? t('flow.snapshotAt', { date: formatDateTime(takenAt) })
              : t('flow.noSnapshot')}
          </Text>
          {folder && (
            <Text
              type="secondary"
              style={{ fontSize: 12, fontFamily: MONO_FONT, maxWidth: 320 }}
              ellipsis={{ tooltip: folder }}
            >
              {folder}
            </Text>
          )}
          {folder && (
            <Button
              icon={<FolderOpenOutlined />}
              loading={choose.isPending}
              onClick={() => choose.mutate(productId)}
            >
              {t('flow.folder.change')}
            </Button>
          )}
        </Flex>
      </Flex>

      {snapshot.isError && (
        <Alert
          type="warning"
          showIcon
          title={t('flow.snapshotFailed')}
          description={snapshot.error.message}
        />
      )}
      {choose.isError && <ErrorState error={choose.error} />}
      {board.isError && <ErrorState error={board.error} onRetry={() => board.refetch()} />}

      {board.data?.workFolder === 'unset' && (
        <Alert
          type="info"
          showIcon
          title={t('flow.folder.unsetTitle', { product: productName })}
          description={t('flow.folder.unsetText')}
          action={
            <Button
              type="primary"
              loading={choose.isPending}
              onClick={() => choose.mutate(productId)}
            >
              {t('flow.folder.choose')}
            </Button>
          }
        />
      )}
      {board.data?.workFolder === 'missing' && (
        <Alert
          type="warning"
          showIcon
          title={t('flow.folder.missingTitle', { product: productName })}
          description={t('flow.folder.missingText')}
          action={
            <Button loading={choose.isPending} onClick={() => choose.mutate(productId)}>
              {t('flow.folder.choose')}
            </Button>
          }
        />
      )}

      {board.isPending ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : features.length === 0 ? (
        <Empty description={t('flow.empty', { product: productName })} />
      ) : (
        <>
          <Funnel features={features} onOpen={(f) => setOpenKey(f.key)} />
          <Others features={outsideFunnel(features)} onOpen={(f) => setOpenKey(f.key)} />
        </>
      )}

      <FeatureDrawer feature={open} productId={productId} onClose={() => setOpenKey(null)} />
    </Space>
  )
}

function Funnel({
  features,
  onOpen
}: {
  features: BoardFeature[]
  onOpen: (feature: BoardFeature) => void
}): React.JSX.Element {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))',
          gap: 12,
          minWidth: 1040
        }}
      >
        {funnelColumns(features).map((column, index) => (
          <Flex key={column.phase} vertical gap={8}>
            <Flex align="center" justify="space-between" style={{ padding: '0 2px' }}>
              <Flex align="center" gap={6}>
                <Text strong style={{ fontSize: 13, color: NEUTRA[600] }}>
                  {t(`flow.phases.${column.phase}`)}
                </Text>
                {index === 0 && <HelpTip rule="RN-FLX-05" />}
              </Flex>
              <Text style={{ fontFamily: MONO_FONT, fontSize: 12, color: NEUTRA[500] }}>
                {column.features.length}
              </Text>
            </Flex>
            <Flex
              vertical
              gap={8}
              style={{ background: NEUTRA[100], borderRadius: 14, padding: 8, minHeight: 120 }}
            >
              {column.features.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12, padding: 6 }}>
                  {t('flow.emptyColumn')}
                </Text>
              ) : (
                column.features.map((feature) => (
                  <FeatureCard key={feature.key} feature={feature} onOpen={() => onOpen(feature)} />
                ))
              )}
            </Flex>
          </Flex>
        ))}
      </div>
    </div>
  )
}

function Others({
  features,
  onOpen
}: {
  features: BoardFeature[]
  onOpen: (feature: BoardFeature) => void
}): React.JSX.Element | null {
  if (features.length === 0) return null
  return (
    <Collapse
      ghost
      items={[
        {
          key: 'others',
          label: <Text type="secondary">{t('flow.others', { count: features.length })}</Text>,
          children: (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8
              }}
            >
              {features.map((feature) => (
                <Flex key={feature.key} vertical gap={4}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t(`flow.phases.${feature.phase}`)}
                  </Text>
                  <FeatureCard feature={feature} onOpen={() => onOpen(feature)} />
                </Flex>
              ))}
            </div>
          )
        }
      ]}
    />
  )
}
