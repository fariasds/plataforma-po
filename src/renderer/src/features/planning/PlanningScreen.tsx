import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from 'antd'
import { DeleteOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import type { PlanningItem } from '@shared/dashboards'
import { spToHours } from '@shared/story-points'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { t } from '../../i18n'
import { ProductFilter } from '../../components/ProductFilter'
import { StateTag } from '../../components/StateTag'
import { DISCIPLINE_COLORS, MONO_FONT, NEUTRA, SIDER, STATUS } from '../../theme'
import { useConfiguration, usePlanning, useSelection, useSprints } from '../../ipc/useAzure'
import { AddManualItemForm, type EffortAvailability } from './AddManualItemForm'
import { CapacityPanel } from './CapacityPanel'
import { comparePlanningItems } from './planning-rules'
import { planningKeys, useManualItems, useStoredValues } from './planning-work-data'
import { ShareSummaryModal } from './ShareSummaryModal'

const { Text } = Typography

/** Cor por disciplina; o total não tem cor própria — é o card escuro da fileira. */
const KPI_CONFIG = [
  { key: 'frontend', label: t('disciplines.frontend'), color: DISCIPLINE_COLORS.frontend },
  { key: 'backend', label: t('disciplines.backend'), color: DISCIPLINE_COLORS.backend },
  { key: 'qa', label: t('disciplines.qa'), color: DISCIPLINE_COLORS.qa },
  { key: 'geral', label: t('planning.totalAll'), color: null }
] as const

/** Parte de um Produto num indicador, na visão de Grupo. */
interface ProductShare {
  id: string
  name: string
  color: string
  value: number
}

/** Prioridade do Azure vai de 1 (mais urgente) a 4. */
const PRIORITY_TONES: Record<number, (typeof STATUS)[keyof typeof STATUS]> = {
  1: STATUS.danger,
  2: STATUS.warning,
  3: STATUS.info,
  4: STATUS.neutral
}

function fmtComplexity(value: number | null): string {
  return value === null ? '—' : String(value)
}

type EffortKey = 'frontend' | 'backend' | 'qa'

/** A sprint da âncora e as quatro seguintes (RN-PLN-01). */
const PLANNABLE_SPRINTS = 5

export function PlanningScreen(): React.JSX.Element {
  const { products, groups, customFields, storyPoints } = useConfiguration()
  const workItemHref = useWorkItemHref()
  const selection = useSelection('planning')
  const product = selection.value

  // Campo de esforço ausente na Configuração: a disciplina some da tela (RN-PLN-03).
  const effort: EffortAvailability = {
    frontend: customFields.effortFrontend !== null,
    backend: customFields.effortBackend !== null,
    qa: customFields.effortQa !== null
  }
  const hasEffort = effort.frontend || effort.backend || effort.qa

  // Planning looks ahead: the current sprint (or the next one on a gap day) plus the
  // following ones, so the PO can plan ahead (RN-PLN-01).
  const sprints = useSprints(PLANNABLE_SPRINTS, true)
  const [sprintKey, setSprintKey] = useState<string>()
  const sprint = sprints.data?.find((s) => s.key === sprintKey) ?? sprints.data?.[0]
  const sprintLabel = sprint?.label ?? ''

  const planning = usePlanning(product, sprint)
  const items = useMemo(() => planning.data?.items ?? [], [planning.data])

  // Produtos da seleção: o próprio, ou os do Grupo na ordem da Configuração.
  const group = groups.find((g) => g.id === product)
  const scopeIds = group ? group.products : [product]
  const scopeProducts = scopeIds.map((id) => ({
    id,
    name: products.find((p) => p.id === id)?.name ?? id
  }))

  /**
   * IDs de work item são únicos na organização inteira, então os desmarcados são
   * guardados só por sprint: desmarcar num Produto vale também na visão do Grupo
   * que o contém (RN-PLN-07).
   */
  const uncheckedStore = useStoredValues<number[]>(
    sprint ? [planningKeys.unchecked(sprint.key)] : [],
    sprint !== undefined
  )
  const uncheckedList = uncheckedStore.values[0]
  const uncheckedIds = useMemo(() => new Set(uncheckedList ?? []), [uncheckedList])

  const manual = useManualItems(scopeIds, sprint?.key)
  const manualItems = manual.items

  function toggleItem(id: number): void {
    const next = new Set(uncheckedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    uncheckedStore.save([[...next]])
  }

  const workDataError = uncheckedStore.error ?? manual.error

  const allItems = useMemo<PlanningItem[]>(
    () => [...items, ...manualItems].sort(comparePlanningItems),
    [items, manualItems]
  )

  // Only checked items feed the effort and capacity numbers.
  const checkedItems = useMemo(
    () => allItems.filter((i) => !uncheckedIds.has(i.id)),
    [allItems, uncheckedIds]
  )

  // Split per product behind each KPI — only meaningful in a group view.
  const breakdown = useMemo(() => {
    if (!group) return null
    const sum = (id: string, key: 'frontend' | 'backend' | 'qa' | 'total'): number =>
      checkedItems.filter((i) => i.product === id).reduce((s, i) => s + (i[key] ?? 0), 0)
    const members = group.products.map((id) => {
      const member = products.find((p) => p.id === id)
      return { id, name: member?.name ?? id, color: member?.color ?? NEUTRA[500] }
    })
    const split = (key: 'frontend' | 'backend' | 'qa' | 'total'): ProductShare[] =>
      members.map((m) => ({ ...m, value: sum(m.id, key) }))
    return {
      frontend: split('frontend'),
      backend: split('backend'),
      qa: split('qa'),
      geral: split('total')
    }
  }, [checkedItems, group, products])

  const allocatedFrontHours = checkedItems.reduce(
    (sum, i) => sum + spToHours(i.frontend, storyPoints),
    0
  )
  const allocatedBackHours = checkedItems.reduce(
    (sum, i) => sum + spToHours(i.backend, storyPoints),
    0
  )

  const totals = {
    frontend: checkedItems.reduce((s, i) => s + (i.frontend ?? 0), 0),
    backend: checkedItems.reduce((s, i) => s + (i.backend ?? 0), 0),
    qa: checkedItems.reduce((s, i) => s + (i.qa ?? 0), 0),
    geral: checkedItems.reduce((s, i) => s + (i.total ?? 0), 0)
  }

  const kpis = KPI_CONFIG.filter(({ key }) => key === 'geral' || effort[key as EffortKey])
  const effortColumns = (
    [
      { key: 'frontend', title: t('disciplines.front') },
      { key: 'backend', title: t('disciplines.back') },
      { key: 'qa', title: t('disciplines.qa') }
    ] as const
  )
    .filter(({ key }) => effort[key])
    .map(({ key, title }) => ({
      title,
      width: 80,
      align: 'center' as const,
      render: (_: unknown, item: PlanningItem) => fmtComplexity(item[key])
    }))

  const showProduct = selection.selected?.isGroup ?? false
  // Only manually added rows can be removed; Azure items come from the sprint.
  const manualIds = new Set(manualItems.map((i) => i.id))
  const manualPercents = new Map(manualItems.map((i) => [i.id, i]))

  const [sharing, setSharing] = useState(false)
  const loading =
    planning.isPending || planning.isFetching || uncheckedStore.isPending || manual.isPending

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" gap={12} wrap>
        <ProductFilter
          options={selection.options}
          value={selection.value}
          onChange={selection.onChange}
        />
        {sprints.data && sprints.data.length > 0 && (
          <Select
            style={{ minWidth: 240, fontFamily: MONO_FONT }}
            value={sprint?.key}
            onChange={setSprintKey}
            options={sprints.data.map((s) => ({ value: s.key, label: s.label }))}
          />
        )}
        {/* O resumo sai do que está na tela: sem os dados carregados não há o que copiar. */}
        <Button
          icon={<ShareAltOutlined />}
          style={{ marginInlineStart: 'auto' }}
          disabled={loading || planning.isError || !sprint}
          onClick={() => setSharing(true)}
        >
          {t('planning.summary.shareButton')}
        </Button>
      </Flex>

      {sharing && sprint && (
        <ShareSummaryModal
          onClose={() => setSharing(false)}
          selectionId={product}
          sprint={sprint}
          selectionName={selection.selected?.name ?? product}
          sprintLabel={sprintLabel}
          products={scopeProducts}
          isGroup={showProduct}
          items={allItems}
          uncheckedIds={uncheckedIds}
          manualIds={manualIds}
          effort={effort}
        />
      )}

      {sprints.isError && <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />}
      {planning.isError && <ErrorState error={planning.error} onRetry={() => planning.refetch()} />}
      {workDataError && <ErrorState title={t('planning.workDataFailed')} error={workDataError} />}

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <>
          {effort.frontend || effort.backend ? (
            <CapacityPanel
              allocatedFrontHours={allocatedFrontHours}
              allocatedBackHours={allocatedBackHours}
              showFront={effort.frontend}
              showBack={effort.backend}
            />
          ) : (
            <Alert
              type="info"
              showIcon
              title={
                hasEffort ? t('planning.capacityUnavailableTitle') : t('planning.effortOffTitle')
              }
              description={
                hasEffort ? t('planning.capacityUnavailableText') : t('planning.effortOffText')
              }
            />
          )}

          <Row gutter={[16, 16]}>
            {kpis.map(({ key, label, color }) => {
              const total = totals[key]
              const split = breakdown?.[key]
              const shares = (split ?? []).map((share) => ({
                ...share,
                pct: total > 0 ? Math.round((share.value / total) * 100) : 0
              }))
              // O total é o número da sprint: card escuro, para ser lido primeiro.
              const dark = color === null

              return (
                <Col xs={12} lg={24 / kpis.length} key={key}>
                  <Card
                    style={{
                      height: '100%',
                      ...(dark ? { background: SIDER.bg, borderColor: SIDER.bg } : {})
                    }}
                  >
                    <Statistic
                      title={
                        <Flex align="center" justify="space-between" gap={8}>
                          <Flex
                            align="center"
                            gap={8}
                            style={{ color: dark ? SIDER.text : undefined }}
                          >
                            {color && (
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 3,
                                  background: color
                                }}
                              />
                            )}
                            {label}
                          </Flex>
                          <HelpTip rule="RN-PLN-13" />
                        </Flex>
                      }
                      value={total}
                      styles={{
                        content: {
                          fontSize: 36,
                          fontWeight: 600,
                          letterSpacing: '-0.03em',
                          color: dark ? SIDER.textStrong : undefined
                        }
                      }}
                    />
                    <Text type="secondary" style={{ color: dark ? SIDER.subtle : undefined }}>
                      {t('planning.complexityPoints')}
                    </Text>

                    {split && total > 0 && (
                      <>
                        <Flex
                          gap={2}
                          style={{ height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 }}
                        >
                          {shares.map((share) => (
                            <div
                              key={share.id}
                              style={{ width: `${share.pct}%`, background: share.color }}
                            />
                          ))}
                        </Flex>
                        <Flex justify="space-between" style={{ marginTop: 4 }}>
                          {shares.map((share) => (
                            <Text
                              key={share.id}
                              type="secondary"
                              style={{ fontSize: 12, color: dark ? SIDER.subtle : undefined }}
                            >
                              {share.name} {share.pct}%
                            </Text>
                          ))}
                        </Flex>
                      </>
                    )}
                  </Card>
                </Col>
              )
            })}
          </Row>

          <Card
            title={t('planning.sprintItems')}
            extra={
              <Flex align="center" gap={8}>
                <Text type="secondary">
                  {t('planning.inCalculation', {
                    checked: checkedItems.length,
                    total: allItems.length
                  })}
                </Text>
                <HelpTip rule="RN-PLN-04" />
              </Flex>
            }
          >
            <Flex align="center" gap={6} style={{ marginBottom: 12 }}>
              <AddManualItemForm
                existingIds={allItems.map((i) => i.id)}
                products={scopeProducts}
                effort={effort}
                onAdd={(item) => manual.save([...manualItems, item])}
              />
              <HelpTip rule="RN-PLN-09" />
            </Flex>

            <Table<PlanningItem>
              size="small"
              rowKey="id"
              dataSource={allItems}
              pagination={{ pageSize: 30, hideOnSinglePage: true }}
              locale={{ emptyText: t('planning.empty') }}
              columns={[
                {
                  title: '',
                  width: 40,
                  render: (_, item) => (
                    <Checkbox
                      checked={!uncheckedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  )
                },
                {
                  title: t('common.id'),
                  width: 90,
                  render: (_, item) => (
                    <Typography.Link
                      style={{ fontFamily: MONO_FONT }}
                      href={workItemHref(item.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{item.id}
                    </Typography.Link>
                  )
                },
                {
                  title: t('common.title'),
                  render: (_, item) => (
                    <Flex align="center" gap={8} wrap>
                      <span>{item.title}</span>
                      {manualIds.has(item.id) && (
                        <Tag color="warning" style={{ marginInlineEnd: 0 }}>
                          {t('planning.leftover')}
                        </Tag>
                      )}
                      {manualPercents.get(item.id) && (effort.frontend || effort.backend) && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {[
                            effort.frontend &&
                              t('planning.frontShare', {
                                percent: manualPercents.get(item.id)?.frontendPercent ?? 0
                              }),
                            effort.backend &&
                              t('planning.backShare', {
                                percent: manualPercents.get(item.id)?.backendPercent ?? 0
                              })
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </Flex>
                  )
                },
                ...(showProduct
                  ? [
                      {
                        title: t('common.product'),
                        width: 100,
                        render: (_: unknown, item: PlanningItem) => (
                          <Flex align="center" gap={7}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                flex: 'none',
                                background:
                                  products.find((p) => p.id === item.product)?.color ?? NEUTRA[400]
                              }}
                            />
                            <Text>
                              {products.find((p) => p.id === item.product)?.name ?? item.product}
                            </Text>
                          </Flex>
                        )
                      }
                    ]
                  : []),
                {
                  title: t('common.status'),
                  width: 130,
                  render: (_, item) => <StateTag state={item.state} />
                },
                {
                  title: t('planning.priority'),
                  width: 105,
                  align: 'center',
                  render: (_, item) =>
                    item.priority === null ? (
                      <Text type="secondary">—</Text>
                    ) : (
                      <Tag
                        variant="filled"
                        style={{
                          fontFamily: MONO_FONT,
                          fontWeight: 600,
                          marginInlineEnd: 0,
                          background: (PRIORITY_TONES[item.priority] ?? STATUS.neutral).bg,
                          color: (PRIORITY_TONES[item.priority] ?? STATUS.neutral).text
                        }}
                      >
                        {t('planning.priorityShort', { priority: item.priority })}
                      </Tag>
                    )
                },
                ...effortColumns,
                {
                  title: t('common.total'),
                  width: 80,
                  align: 'center',
                  render: (_, item) => <Text strong>{fmtComplexity(item.total)}</Text>
                },
                {
                  title: '',
                  width: 40,
                  render: (_, item) =>
                    manualIds.has(item.id) ? (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => manual.save(manualItems.filter((i) => i.id !== item.id))}
                      />
                    ) : null
                }
              ]}
            />
          </Card>
        </>
      )}
    </Space>
  )
}
