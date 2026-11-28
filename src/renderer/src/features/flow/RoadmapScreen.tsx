import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme
} from 'antd'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cascadePlan,
  suggestStart,
  TRAILS,
  WINDOW_KINDS,
  type FeaturePlan,
  type RoadmapFeature,
  type RoadmapSettings,
  type RoadmapView,
  type TrailLoad,
  type WindowKind
} from '@shared/roadmap'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { ProductFilter } from '../../components/ProductFilter'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import { t } from '../../i18n'
import { ipc } from '../../ipc/client'
import { useSelection } from '../../ipc/useAzure'
import { MONO_FONT, STATUS } from '../../theme'

const { Text } = Typography

const ALL = '__todos__'
/** Sprints antes da corrente que a linha do tempo mostra. */
const PAST_SHOWN = 3

function fmtWeight(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/**
 * Roadmap: quando cada Feature cabe sem sobrecarregar ninguém, e se o que foi
 * planejado para a sprint aconteceu (RN-RDM-01 a RN-RDM-21). A Janela é o plano; a
 * Fase, o fato. A carga soma todos os Produtos; o filtro só escolhe as linhas.
 */
export function RoadmapScreen(): React.JSX.Element {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const href = useWorkItemHref()
  const selection = useSelection('flow')
  const [filter, setFilter] = useState(ALL)
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [milestone, setMilestone] = useState<string | null>(null)

  // O retrato de cada Produto é refeito ao abrir a tela (RN-FLX-02).
  const snapshots = useQueries({
    queries: selection.options.map((o) => ({
      queryKey: ['flow-snapshot', o.id],
      queryFn: () => ipc.refreshFlowSnapshot(o.id)
    }))
  })
  const ready = snapshots.every((s) => !s.isPending)
  const stamp = snapshots.map((s) => s.data?.takenAt ?? '').join('|')
  const view = useQuery({
    queryKey: ['roadmap', stamp],
    enabled: ready && selection.options.length > 0,
    staleTime: 0,
    queryFn: () => ipc.getRoadmap()
  })
  const refresh = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['roadmap'] })
  const update = useMutation({
    mutationFn: (input: { productId: string; change: Parameters<typeof ipc.updateRoadmap>[1] }) =>
      ipc.updateRoadmap(input.productId, input.change),
    onSuccess: refresh,
    onError: (error: Error) => message.error(error.message)
  })

  if (selection.options.length === 0) return <Empty description={t('flow.noProducts')} />

  const data = view.data
  const filterOptions = [
    { id: ALL, name: t('roadmap.allProducts'), color: undefined, isGroup: true },
    ...selection.options
  ]
  const colorOf = new Map(selection.options.map((o) => [o.id, o.color]))
  const rows = (data?.features ?? []).filter(
    (f) => (filter === ALL || f.productId === filter) && (showArchived || !f.archived)
  )
  const first = data ? Math.max(0, data.current - PAST_SHOWN) : 0
  const columns = data ? data.timeline.slice(first).map((s, i) => ({ ...s, index: first + i })) : []
  const editingFeature = data?.features.find((f) => f.key === editing) ?? null

  const toneOf = (status: TrailLoad['status']): { bg: string; text: string } =>
    status === 'dentro' ? STATUS.ok : status === 'limite' ? STATUS.warning : STATUS.danger
  const windowBg: Record<WindowKind, string> = {
    discovery: token.colorFillTertiary,
    quebra: token.colorFillSecondary,
    delivery: token.colorFill
  }

  const id = (value: number | null): React.ReactNode => {
    if (value === null) return null
    const link = href(value)
    const label = <span style={{ fontFamily: MONO_FONT, fontSize: 12 }}>#{value}</span>
    return link ? (
      <a href={link} target="_blank" rel="noreferrer">
        {label}
      </a>
    ) : (
      label
    )
  }

  const cellStyle = (index: number): React.CSSProperties => ({
    minWidth: 76,
    padding: '6px 4px',
    textAlign: 'center',
    borderInlineStart: `1px solid ${token.colorBorderSecondary}`,
    background: data && index === data.current ? token.colorPrimaryBg : undefined
  })

  const selectedMilestone = data?.milestones.find((m) => `${m.takenAt}|${m.name}` === milestone)
  const titleOf = new Map((data?.features ?? []).map((f) => [`${f.productId}|${f.key}`, f.title]))
  const sprintLabel = (start: string): string =>
    data?.timeline.find((s) => s.start === start)?.label ?? start

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <ProductFilter options={filterOptions} value={filter} onChange={setFilter} />
        <Flex gap={8} wrap align="center">
          <Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}>
            {t('roadmap.showArchived')}
          </Checkbox>
          <Button onClick={() => setSettingsOpen(true)} disabled={!data}>
            {t('roadmap.settings.button')}
          </Button>
          <Button onClick={() => setMilestoneOpen(true)} disabled={!data}>
            {t('roadmap.milestone.button')}
          </Button>
        </Flex>
      </Flex>

      {view.isError && <ErrorState error={view.error} onRetry={() => view.refetch()} />}
      {data?.products.some((p) => p.workFolder !== 'ok') && (
        <Alert type="info" showIcon title={t('roadmap.noFolder')} />
      )}
      {data?.products
        .filter((p) => p.error !== null)
        .map((p) => (
          <Alert
            key={p.productId}
            type="warning"
            showIcon
            title={t('roadmap.fileError', {
              product: selection.options.find((o) => o.id === p.productId)?.name ?? p.productId,
              error: p.error ?? ''
            })}
          />
        ))}

      {!data ? (
        view.isError ? null : (
          <Skeleton active paragraph={{ rows: 8 }} />
        )
      ) : data.timeline.length === 0 ? (
        <Empty description={t('roadmap.noSprints')} />
      ) : (
        <>
          <MySprint view={data} filter={filter} onOpen={setEditing} />

          <Card size="small" styles={{ body: { padding: 0, overflowX: 'auto' } }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, minWidth: 260 }}>
                    <Flex gap={6} align="center">
                      {t('roadmap.feature')}
                      <HelpTip rule="RN-RDM-17" />
                    </Flex>
                  </th>
                  {columns.map((s) => (
                    <th key={s.start} style={{ ...cellStyle(s.index), fontWeight: 500 }}>
                      <div style={{ fontFamily: MONO_FONT, fontSize: 11 }}>{s.label}</div>
                      {s.projected && (
                        <Text type="secondary" style={{ fontSize: 10.5 }}>
                          {t('roadmap.projected')}
                        </Text>
                      )}
                    </th>
                  ))}
                </tr>
                {TRAILS.map((trail) => (
                  <tr key={trail} style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                    <td style={{ padding: '4px 8px' }}>
                      <Flex gap={6} align="center">
                        <Text type="secondary">{t(`roadmap.trails.${trail}`)}</Text>
                        {trail === 'produto' ? (
                          <HelpTip rule="RN-RDM-12" />
                        ) : (
                          <HelpTip rule="RN-RDM-10" />
                        )}
                      </Flex>
                    </td>
                    {columns.map((s) => {
                      const load = data.load[s.index][trail]
                      const tone = toneOf(load.status)
                      const limit = fmtWeight(data.settings.limits[trail])
                      return (
                        <td key={s.start} style={cellStyle(s.index)}>
                          <Tooltip
                            title={t('roadmap.loadTitle', {
                              trail: t(`roadmap.trails.${trail}`),
                              count: load.features,
                              weight: fmtWeight(load.weight),
                              limit
                            })}
                          >
                            <Tag
                              variant="filled"
                              style={{
                                marginInlineEnd: 0,
                                background: tone.bg,
                                color: tone.text,
                                fontFamily: MONO_FONT
                              }}
                            >
                              {t('roadmap.loadCell', { weight: fmtWeight(load.weight), limit })}
                            </Tag>
                          </Tooltip>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <Empty description={t('roadmap.empty')} />
                    </td>
                  </tr>
                )}
                {rows.map((f) => (
                  <tr
                    key={`${f.productId}|${f.key}`}
                    style={{
                      borderTop: `1px solid ${token.colorBorderSecondary}`,
                      opacity: f.archived ? 0.5 : 1
                    }}
                  >
                    <td style={{ padding: '6px 8px' }}>
                      <Flex vertical gap={2}>
                        <Flex gap={6} align="baseline">
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              display: 'inline-block',
                              background: colorOf.get(f.productId) ?? token.colorTextQuaternary
                            }}
                          />
                          {id(f.featureId)}
                          <a onClick={() => setEditing(f.key)} style={{ fontWeight: 500 }}>
                            {f.title}
                          </a>
                        </Flex>
                        <Flex gap={6} wrap>
                          {f.draft && (
                            <Tag style={{ marginInlineEnd: 0 }}>{t('roadmap.draft')}</Tag>
                          )}
                          {f.archived && (
                            <Tag style={{ marginInlineEnd: 0 }}>{t('roadmap.archived')}</Tag>
                          )}
                          {f.opportunities > 0 && (
                            <Text type="secondary" style={{ fontSize: 11.5 }}>
                              {t('roadmap.opportunities', { count: f.opportunities })}
                            </Text>
                          )}
                          {f.delivery && (
                            <Text
                              type="secondary"
                              style={{ fontSize: 11.5, fontFamily: MONO_FONT }}
                            >
                              {t('roadmap.delivery', f.delivery)}
                            </Text>
                          )}
                          {f.divergence && (
                            <Tooltip title={t('roadmap.divergence')}>
                              <Tag
                                variant="filled"
                                style={{
                                  marginInlineEnd: 0,
                                  background: STATUS.neutral.bg,
                                  color: STATUS.neutral.text
                                }}
                              >
                                {f.azureState}
                              </Tag>
                            </Tooltip>
                          )}
                          {!f.plan && (
                            <Text type="secondary" style={{ fontSize: 11.5 }}>
                              {t('roadmap.noPlan')}
                            </Text>
                          )}
                        </Flex>
                      </Flex>
                    </td>
                    {columns.map((s) => {
                      const w = f.windows.find(
                        (x) => x.length > 0 && x.from <= s.index && s.index <= x.end
                      )
                      const isCurrent = s.index === data.current
                      return (
                        <td key={s.start} style={cellStyle(s.index)}>
                          <Flex vertical gap={2} align="center">
                            {w && (
                              <Tooltip
                                title={`${t(`roadmap.windows.${w.kind}`)}${w.outOfWindow ? ` · ${t('roadmap.outOfWindow')}` : ''}`}
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    borderRadius: 4,
                                    padding: '2px 0',
                                    background: windowBg[w.kind],
                                    outline: w.outOfWindow
                                      ? `2px solid ${STATUS.warning.solid}`
                                      : undefined,
                                    fontWeight: 500
                                  }}
                                >
                                  {t(`roadmap.windowShort.${w.kind}`)}
                                </div>
                              </Tooltip>
                            )}
                            {/* RN-RDM-18: a Fase sobre a Janela, na sprint corrente. */}
                            {isCurrent && (
                              <Text style={{ fontSize: 10.5 }} type="secondary">
                                {f.phase}
                              </Text>
                            )}
                          </Flex>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {data.milestones.length > 0 && (
            <Card size="small" title={t('roadmap.milestone.compare')}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Select
                  style={{ minWidth: 280 }}
                  value={milestone}
                  onChange={setMilestone}
                  options={data.milestones.map((m) => ({
                    value: `${m.takenAt}|${m.name}`,
                    label: `${m.name} · ${m.takenAt.slice(0, 10)}`
                  }))}
                />
                {selectedMilestone &&
                  (selectedMilestone.changes.length === 0 ? (
                    <Text type="secondary">{t('roadmap.milestone.none')}</Text>
                  ) : (
                    selectedMilestone.changes.map((c, i) => (
                      <Flex key={i} gap={8}>
                        <Text style={{ fontWeight: 500 }}>
                          {titleOf.get(`${c.productId}|${c.key}`) ?? c.key}
                        </Text>
                        <Text type="secondary">
                          {c.kind === 'movida'
                            ? t('roadmap.milestone.movida', {
                                window: t(`roadmap.windows.${c.window}`),
                                from: `${sprintLabel(c.from.start)} (${c.from.length})`,
                                to: `${sprintLabel(c.to.start)} (${c.to.length})`
                              })
                            : t(`roadmap.milestone.${c.kind}`)}
                        </Text>
                      </Flex>
                    ))
                  ))}
              </Space>
            </Card>
          )}
        </>
      )}

      {data && editingFeature && (
        <PlanDrawer
          key={editingFeature.key}
          view={data}
          feature={editingFeature}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(plan) =>
            update.mutate(
              {
                productId: editingFeature.productId,
                change: { kind: 'plan', key: editingFeature.key, plan }
              },
              { onSuccess: () => message.success(t('roadmap.edit.saved')) }
            )
          }
          onArchive={(archived) =>
            update.mutate({
              productId: editingFeature.productId,
              change: { kind: 'archive', key: editingFeature.key, archived }
            })
          }
        />
      )}
      {data && settingsOpen && (
        <SettingsModal
          settings={data.settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            void refresh()
          }}
        />
      )}
      {milestoneOpen && (
        <MilestoneModal
          onClose={() => setMilestoneOpen(false)}
          onSaved={(count) => {
            setMilestoneOpen(false)
            message.success(t('roadmap.milestone.saved', { count }))
            void refresh()
          }}
        />
      )}
    </Space>
  )
}

/** RN-RDM-16: as Janelas ativas agora, com a Fase e as pendências de cada Feature. */
function MySprint(props: {
  view: RoadmapView
  filter: string
  onOpen: (key: string) => void
}): React.JSX.Element {
  const active = props.view.features.filter(
    (f) =>
      !f.archived &&
      f.currentWindow !== null &&
      (props.filter === ALL || f.productId === props.filter)
  )
  const load = props.view.load[props.view.current]
  return (
    <Card
      size="small"
      title={t('roadmap.mySprint.title')}
      extra={
        <Flex gap={12}>
          {TRAILS.map((trail) => (
            <Text key={trail} type="secondary" style={{ fontSize: 12 }}>
              {t('roadmap.loadTitle', {
                trail: t(`roadmap.trails.${trail}`),
                count: load[trail].features,
                weight: fmtWeight(load[trail].weight),
                limit: fmtWeight(props.view.settings.limits[trail])
              })}
            </Text>
          ))}
        </Flex>
      }
    >
      {active.length === 0 ? (
        <Text type="secondary">{t('roadmap.mySprint.empty')}</Text>
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }}>
          {active.map((f) => (
            <Flex key={`${f.productId}|${f.key}`} gap={8} align="baseline" wrap>
              <Tag style={{ marginInlineEnd: 0 }}>{t(`roadmap.windows.${f.currentWindow!}`)}</Tag>
              <a onClick={() => props.onOpen(f.key)} style={{ fontWeight: 500 }}>
                {f.title}
              </a>
              <Text type="secondary">{f.phase}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {f.pendencies.length > 0
                  ? t('roadmap.mySprint.pendencies', { count: f.pendencies.length })
                  : t('roadmap.mySprint.none')}
              </Text>
            </Flex>
          ))}
        </Space>
      )}
    </Card>
  )
}

function PlanDrawer(props: {
  view: RoadmapView
  feature: RoadmapFeature
  saving: boolean
  onClose: () => void
  onSave: (plan: FeaturePlan) => void
  onArchive: (archived: boolean) => void
}): React.JSX.Element {
  const { view, feature } = props
  const [plan, setPlan] = useState<FeaturePlan | null>(feature.plan)
  const options = view.timeline.map((s) => ({ value: s.start, label: s.label }))

  const suggestions = !plan
    ? null
    : (Object.fromEntries(
        WINDOW_KINDS.map((kind) => [
          kind,
          suggestStart({
            features: view.features.filter((f) => !f.archived),
            key: feature.key,
            kind,
            length: plan[kind].length,
            from: view.current,
            sprints: view.timeline.length,
            settings: view.settings
          })
        ])
      ) as Record<WindowKind, number | null>)

  return (
    <Drawer
      open
      size="large"
      title={t('roadmap.edit.title', { title: feature.title })}
      onClose={props.onClose}
      destroyOnHidden
      extra={
        <Button
          type="primary"
          disabled={!plan}
          loading={props.saving}
          onClick={() => plan && props.onSave(plan)}
        >
          {t('roadmap.edit.save')}
        </Button>
      }
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Text type="secondary">{t('roadmap.edit.phase', { phase: feature.phase })}</Text>
        {!plan ? (
          <Button onClick={() => setPlan(cascadePlan(view.timeline, view.current))}>
            {t('roadmap.edit.create')}
          </Button>
        ) : (
          WINDOW_KINDS.map((kind) => {
            const suggestion = suggestions?.[kind] ?? null
            return (
              <Flex key={kind} vertical gap={4}>
                <Text style={{ fontWeight: 500 }}>{t(`roadmap.windows.${kind}`)}</Text>
                <Flex gap={8} align="center" wrap>
                  <Text type="secondary">{t('roadmap.edit.start')}</Text>
                  <Select
                    style={{ minWidth: 160 }}
                    value={plan[kind].start}
                    options={options}
                    onChange={(start: string) =>
                      setPlan({ ...plan, [kind]: { ...plan[kind], start } })
                    }
                  />
                  <Text type="secondary">{t('roadmap.edit.length')}</Text>
                  <InputNumber
                    min={0}
                    max={26}
                    value={plan[kind].length}
                    onChange={(length) =>
                      setPlan({ ...plan, [kind]: { ...plan[kind], length: Number(length ?? 0) } })
                    }
                  />
                  {plan[kind].length === 0 && (
                    <Text type="secondary">{t('roadmap.edit.skipped')}</Text>
                  )}
                </Flex>
                {plan[kind].length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {suggestion === null
                      ? t('roadmap.edit.noSuggestion')
                      : t('roadmap.edit.suggestion', { sprint: view.timeline[suggestion].label })}
                  </Text>
                )}
              </Flex>
            )
          })
        )}
        {feature.plan && (
          <Button onClick={() => props.onArchive(!feature.archived)}>
            {feature.archived ? t('roadmap.edit.unarchive') : t('roadmap.edit.archive')}
          </Button>
        )}
        {feature.pendencies.length > 0 && (
          <Space orientation="vertical" size={2}>
            {feature.pendencies.map((p, i) => (
              <Text key={i} style={{ fontSize: 12.5 }}>
                {p.message}
              </Text>
            ))}
          </Space>
        )}
      </Space>
    </Drawer>
  )
}

function SettingsModal(props: {
  settings: RoadmapSettings
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const { message } = App.useApp()
  const [settings, setSettings] = useState(props.settings)
  const save = useMutation({
    mutationFn: () => ipc.setRoadmapSettings(settings),
    onSuccess: props.onSaved,
    onError: (error: Error) => message.error(error.message)
  })
  return (
    <Modal
      open
      title={t('roadmap.settings.title')}
      onCancel={props.onClose}
      onOk={() => save.mutate()}
      okText={t('roadmap.settings.save')}
      confirmLoading={save.isPending}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {WINDOW_KINDS.map((kind) => (
          <Flex key={kind} vertical gap={4}>
            <Text style={{ fontWeight: 500 }}>{t(`roadmap.windows.${kind}`)}</Text>
            <Flex gap={12} wrap>
              {TRAILS.map((trail) => (
                <Flex key={trail} gap={6} align="center">
                  <Text type="secondary">
                    {t('roadmap.settings.weight', { trail: t(`roadmap.trails.${trail}`) })}
                  </Text>
                  <InputNumber
                    min={0}
                    max={5}
                    step={0.5}
                    value={settings.weights[kind][trail]}
                    onChange={(v) =>
                      setSettings({
                        ...settings,
                        weights: {
                          ...settings.weights,
                          [kind]: { ...settings.weights[kind], [trail]: Number(v ?? 0) }
                        }
                      })
                    }
                  />
                </Flex>
              ))}
            </Flex>
          </Flex>
        ))}
        {TRAILS.map((trail) => (
          <Flex key={trail} gap={6} align="center">
            <Text type="secondary">
              {t('roadmap.settings.limit', { trail: t(`roadmap.trails.${trail}`) })}
            </Text>
            <InputNumber
              min={0.5}
              max={20}
              step={0.5}
              value={settings.limits[trail]}
              onChange={(v) =>
                setSettings({
                  ...settings,
                  limits: { ...settings.limits, [trail]: Number(v ?? 1) }
                })
              }
            />
          </Flex>
        ))}
      </Space>
    </Modal>
  )
}

function MilestoneModal(props: {
  onClose: () => void
  onSaved: (count: number) => void
}): React.JSX.Element {
  const { message } = App.useApp()
  const [name, setName] = useState('')
  const save = useMutation({
    mutationFn: () => ipc.createRoadmapMilestone(name),
    onSuccess: props.onSaved,
    onError: (error: Error) => message.error(error.message)
  })
  return (
    <Modal
      open
      title={t('roadmap.milestone.button')}
      onCancel={props.onClose}
      onOk={() => save.mutate()}
      okText={t('roadmap.milestone.save')}
      okButtonProps={{ disabled: name.trim() === '' }}
      confirmLoading={save.isPending}
    >
      <Input
        placeholder={t('roadmap.milestone.name')}
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </Modal>
  )
}
