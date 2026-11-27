import {
  App,
  Alert,
  Button,
  Collapse,
  Empty,
  Flex,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import { CloudDownloadOutlined } from '@ant-design/icons'
import type { CatalogPageView } from '@shared/flow-absorb'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { ProductFilter } from '../../components/ProductFilter'
import { formatDateTime, formatList, t, tPlural } from '../../i18n'
import { useSelection } from '../../ipc/useAzure'
import { MONO_FONT, STATUS } from '../../theme'
import { AbsorbModal } from './AbsorbModal'
import { useAbsorbCatalog, useCatalog, usePreviewAbsorb } from './useFlow'

const { Text } = Typography

/**
 * Catálogo: as regras do Produto na pasta de trabalho, o que ainda não está na wiki e
 * a absorção da wiki (RN-CAT-01 a 06, ADR 0015).
 */
export function CatalogScreen(): React.JSX.Element {
  const { message } = App.useApp()
  const selection = useSelection('flow')
  const productId = selection.value
  const productName = selection.selected?.name ?? ''
  const catalog = useCatalog(productId)
  const preview = usePreviewAbsorb()
  const absorb = useAbsorbCatalog()

  if (selection.options.length === 0) return <Empty description={t('flow.noProducts')} />

  const view = catalog.data
  const isWiki = view?.source?.kind === 'wiki'

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <ProductFilter
          options={selection.options}
          value={productId}
          onChange={(id) => {
            preview.reset()
            selection.onChange(id)
          }}
        />
        {view?.source && view.workFolder === 'ok' && (
          <Flex align="center" gap={12} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {view.source.kind === 'wiki'
                ? t('catalog.sourceWiki', { wiki: view.source.wiki, root: view.source.rootPage })
                : t('catalog.sourceLocal')}
              {isWiki &&
                ` · ${view.absorbedAt ? t('catalog.absorbedAt', { date: formatDateTime(view.absorbedAt) }) : t('catalog.neverAbsorbed')}`}
            </Text>
            {isWiki && (
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                loading={preview.isPending}
                onClick={() => preview.mutate(productId)}
              >
                {t('catalog.absorb')}
              </Button>
            )}
          </Flex>
        )}
      </Flex>

      {catalog.isError && <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />}
      {preview.isError && <ErrorState error={preview.error} />}
      {absorb.isError && <ErrorState error={absorb.error} />}

      {catalog.isPending ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !view ? null : view.source === null ? (
        <Alert type="info" showIcon title={t('catalog.noSource', { product: productName })} />
      ) : view.workFolder !== 'ok' ? (
        <Alert type="info" showIcon title={t('catalog.noFolder', { product: productName })} />
      ) : (
        <>
          {view.duplicates.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t('catalog.duplicates', { ids: view.duplicates.join(', ') })}
            />
          )}
          {view.consults.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('catalog.consults', {
                list: formatList(
                  view.consults.map((c) =>
                    c.rules === null
                      ? t('catalog.consultMissing', { name: c.name })
                      : t('catalog.consultCount', { name: c.name, count: c.rules })
                  )
                )
              })}
            </Text>
          )}
          {view.pages.length === 0 ? (
            <Empty description={t('catalog.empty')} />
          ) : (
            <Collapse items={view.pages.map((page) => pageItem(page, isWiki))} />
          )}
        </>
      )}

      <AbsorbModal
        preview={preview.data ?? null}
        pending={absorb.isPending}
        onCancel={() => preview.reset()}
        onConfirm={(useWiki) =>
          absorb.mutate(
            { productId, useWiki },
            {
              onSuccess: () => {
                preview.reset()
                void message.success(t('catalog.preview.done'))
              }
            }
          )
        }
      />
    </Space>
  )
}

function pageItem(
  page: CatalogPageView,
  isWiki: boolean
): {
  key: string
  label: React.ReactNode
  children: React.ReactNode
} {
  return {
    key: page.file,
    label: (
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Flex align="center" gap={8}>
          <Text strong>{page.title}</Text>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: MONO_FONT }}>
            {page.file}
          </Text>
        </Flex>
        <Flex align="center" gap={6}>
          {isWiki && page.toPublish && (
            <>
              <Tag
                variant="filled"
                style={{
                  marginInlineEnd: 0,
                  background: STATUS.warning.bg,
                  color: STATUS.warning.text
                }}
              >
                {t('catalog.toPublish')}
              </Tag>
              <HelpTip rule="RN-CAT-06" />
            </>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {page.rules.length === 0
              ? t('catalog.noRules')
              : tPlural('catalog.rules', page.rules.length)}
          </Text>
        </Flex>
      </Flex>
    ),
    children: (
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={page.rules}
        columns={[
          {
            title: t('catalog.columns.id'),
            dataIndex: 'id',
            width: 150,
            render: (id: string) => <span style={{ fontFamily: MONO_FONT }}>{id}</span>
          },
          { title: t('catalog.columns.title'), dataIndex: 'title' },
          { title: t('catalog.columns.status'), dataIndex: 'status', width: 130 },
          { title: t('catalog.columns.validation'), dataIndex: 'validation', width: 130 },
          {
            title: t('catalog.columns.updated'),
            dataIndex: 'updated',
            width: 110,
            render: (date: string | null) => (
              <span style={{ fontFamily: MONO_FONT }}>{date ?? ''}</span>
            )
          }
        ]}
      />
    )
  }
}
