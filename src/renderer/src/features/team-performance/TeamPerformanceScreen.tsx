import { useMemo, useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography
} from 'antd'
import { Area, Column, DualAxes, Line } from '@ant-design/plots'
import type {
  BugStateSlot,
  CriticalityLevelInfo,
  DevFocusSlot,
  ReworkSlot,
  SlaSlot
} from '@shared/dashboards'
import { DashboardFilters } from '../../components/DashboardFilters'
import { ErrorState } from '../../components/ErrorState'
import { formatHours, formatPercent, t } from '../../i18n'
import { useSelection, useSprints, useTeamPerformance } from '../../ipc/useAzure'
import {
  DEV_FOCUS_COLOR,
  REFERENCE_LINE_COLOR,
  REWORK_BAR_COLOR,
  REWORK_LINE_COLOR,
  VISIBLE_PERIODS,
  seriesColor
} from './constants'

const { Text } = Typography

type ViewMode = 'sprint' | 'month'

/** History depth fetched; the charts plot the last five of it. */
const HISTORY_SPRINTS = 12

interface ChartCardProps {
  title: string
  hint: string
  extra?: React.ReactNode
  empty: boolean
  emptyText: string
  children: React.ReactNode
}

function ChartCard({
  title,
  hint,
  extra,
  empty,
  emptyText,
  children
}: ChartCardProps): React.JSX.Element {
  return (
    <Card title={title} extra={extra}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {hint}
      </Text>
      {empty ? <Empty description={emptyText} /> : children}
    </Card>
  )
}

function levelColor(level: CriticalityLevelInfo, index: number): string {
  return level.color ?? seriesColor(index)
}

/** % of bugs with a due date closed on time, one line per criticality level. */
function SlaChart({
  slots,
  levels
}: {
  slots: SlaSlot[]
  levels: CriticalityLevelInfo[]
}): React.JSX.Element {
  // Long format: one row per (period, level). Nulls are dropped so the line
  // connects across periods without data, matching `connectNulls`.
  const data = slots.flatMap((slot) =>
    levels.flatMap(({ name }) => {
      const percent = slot.levels[name]?.percent ?? null
      return percent !== null ? [{ label: slot.label, criticidade: name, valor: percent }] : []
    })
  )

  return (
    <Line
      height={280}
      data={data}
      xField="label"
      yField="valor"
      colorField="criticidade"
      scale={{
        y: { domain: [0, 100] },
        color: {
          domain: levels.map((l) => l.name),
          range: levels.map((l, i) => levelColor(l, i))
        }
      }}
      axis={{ y: { labelFormatter: (v: number) => formatPercent(v) } }}
      point={{ sizeField: 4 }}
      tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatPercent(v) }] }}
    />
  )
}

/** Delivered items (bars) against the share that went through rework (line). */
function ReworkChart({ slots }: { slots: ReworkSlot[] }): React.JSX.Element {
  const data = slots.map((slot) => ({
    label: slot.label,
    total: slot.total,
    reworkRate: slot.reworkRate ?? 0
  }))

  return (
    <DualAxes
      height={280}
      legend={false}
      // eslint-disable-next-line react/no-children-prop
      children={[
        {
          type: 'interval',
          data,
          xField: 'label',
          yField: 'total',
          style: { fill: REWORK_BAR_COLOR }
        },
        {
          type: 'line',
          data,
          xField: 'label',
          yField: 'reworkRate',
          style: { stroke: REWORK_LINE_COLOR, lineWidth: 2 },
          axis: { y: { position: 'right', labelFormatter: (v: number) => formatPercent(v) } }
        }
      ]}
    />
  )
}

// Os tipos de estado e criticidade do bug são da Análise de Bugs; aqui eles só
// são lidos pelo nome que veio da Configuração.
type HoursByState = Partial<Record<string, number>>

/** Average business hours a closed bug spent in each lifecycle state. */
function BugStateTimeChart({
  slots,
  stateOrder,
  levels
}: {
  slots: BugStateSlot[]
  stateOrder: string[]
  levels: CriticalityLevelInfo[]
}): React.JSX.Element {
  const [critFilter, setCritFilter] = useState<string | null>(null)

  const data = slots.flatMap((slot) => {
    const byLevel = slot.byCategory as Partial<Record<string, { states: HoursByState }>>
    const states: HoursByState = critFilter
      ? (byLevel[critFilter]?.states ?? {})
      : (slot.states as HoursByState)
    return stateOrder.flatMap((state) => {
      const hours = states[state]
      return hours ? [{ label: slot.label, state, hours }] : []
    })
  })

  // A cor segue a posição do estado no fluxo, não a lista dos que aparecem.
  const activeStates = stateOrder.filter((state) => data.some((row) => row.state === state))

  return (
    <>
      {levels.length > 0 && (
        <Flex gap={4} justify="flex-end" style={{ marginBottom: 8 }}>
          {levels.map((level, index) => {
            const color = levelColor(level, index)
            const active = critFilter === level.name
            return (
              <Tag
                key={level.name}
                style={{
                  cursor: 'pointer',
                  borderColor: color,
                  background: active ? color : 'transparent',
                  color: active ? '#FFFFFF' : color
                }}
                onClick={() => setCritFilter(active ? null : level.name)}
              >
                {level.name}
              </Tag>
            )
          })}
        </Flex>
      )}

      {data.length === 0 ? (
        <Empty description={t('team.stateTimeEmptyForCriticality')} />
      ) : (
        <Column
          height={280}
          data={data}
          xField="label"
          yField="hours"
          colorField="state"
          stack
          scale={{
            color: {
              domain: activeStates,
              range: activeStates.map((state) => seriesColor(stateOrder.indexOf(state)))
            }
          }}
          axis={{ y: { labelFormatter: (v: number) => formatHours(v) } }}
          tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatHours(v) }] }}
        />
      )}
    </>
  )
}

/** Share of in-progress hours spent on the process profile's development types. */
function DevFocusChart({ slots }: { slots: DevFocusSlot[] }): React.JSX.Element {
  const data = slots.map((slot) => ({
    label: slot.label,
    devFocusPercent: slot.devFocusPercent ?? 0
  }))

  return (
    <Area
      height={280}
      data={data}
      xField="label"
      yField="devFocusPercent"
      scale={{ y: { domain: [0, 100] } }}
      axis={{ y: { labelFormatter: (v: number) => formatPercent(v) } }}
      style={{
        fill: `l(90) 0:${DEV_FOCUS_COLOR}80 1:${DEV_FOCUS_COLOR}10`,
        stroke: DEV_FOCUS_COLOR
      }}
      line={{ style: { stroke: DEV_FOCUS_COLOR, lineWidth: 2.5 } }}
      // The 50% mark is the reference the team reads against.
      annotations={[
        {
          type: 'lineY',
          data: [50],
          style: { stroke: REFERENCE_LINE_COLOR, strokeOpacity: 0.5, lineDash: [4, 3] }
        }
      ]}
      tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatPercent(v) }] }}
    />
  )
}

export function TeamPerformanceScreen(): React.JSX.Element {
  const selection = useSelection('review')
  const product = selection.value
  const [viewMode, setViewMode] = useState<ViewMode>('sprint')

  const sprints = useSprints(HISTORY_SPRINTS)
  const performance = useTeamPerformance(product, sprints.data)

  const data = performance.data
  const pick = useMemo(() => {
    return <T,>(sprintSlots: T[] | undefined, monthSlots: T[] | undefined): T[] =>
      (viewMode === 'sprint' ? (sprintSlots ?? []) : (monthSlots ?? [])).slice(-VISIBLE_PERIODS)
  }, [viewMode])

  const slaSlots = pick(data?.slaSprintStats, data?.slaMonthStats)
  const reworkSlots = pick(data?.reworkSprintSlots, data?.reworkMonthSlots)
  const bugStateSlots = pick(data?.bugStateSprintSlots, data?.bugStateMonthSlots)
  const devFocusSlots = pick(data?.devFocusSprintSlots, data?.devFocusMonthSlots)
  const levels = data?.criticalityLevels ?? []

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <DashboardFilters selection={selection} />
        <Segmented
          options={[
            { label: t('common.sprint'), value: 'sprint' },
            { label: t('common.month'), value: 'month' }
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
        />
      </Flex>

      {sprints.isError && <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />}
      {performance.isError && (
        <ErrorState error={performance.error} onRetry={() => performance.refetch()} />
      )}

      {data && data.partialFailures.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={t('team.partialTitle')}
          description={t('team.partialText', { charts: data.partialFailures.join(', ') })}
        />
      )}

      {performance.isPending || performance.isFetching ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <ChartCard
              title={t('team.slaTitle')}
              hint={t('team.slaHint')}
              empty={levels.length === 0 || slaSlots.length === 0}
              emptyText={levels.length === 0 ? t('team.slaNoLevels') : t('team.slaEmpty')}
            >
              <SlaChart slots={slaSlots} levels={levels} />
            </ChartCard>
          </Col>

          <Col xs={24} xl={12}>
            <ChartCard
              title={t('team.reworkTitle')}
              hint={t('team.reworkHint')}
              empty={data?.reworkUnavailable != null || reworkSlots.length === 0}
              emptyText={
                data?.reworkUnavailable
                  ? t('team.reworkUnavailable', { field: data.reworkUnavailable })
                  : t('team.reworkEmpty')
              }
            >
              <ReworkChart slots={reworkSlots} />
            </ChartCard>
          </Col>

          <Col xs={24} xl={12}>
            <ChartCard
              title={t('team.stateTimeTitle')}
              hint={t('team.stateTimeHint')}
              empty={bugStateSlots.length === 0}
              emptyText={t('team.stateTimeEmpty')}
            >
              <BugStateTimeChart
                slots={bugStateSlots}
                stateOrder={data?.bugStateOrder ?? []}
                levels={levels}
              />
            </ChartCard>
          </Col>

          <Col xs={24} xl={12}>
            <ChartCard
              title={t('team.devFocusTitle')}
              hint={t('team.devFocusHint')}
              empty={devFocusSlots.length === 0}
              emptyText={t('team.devFocusEmpty')}
            >
              <DevFocusChart slots={devFocusSlots} />
            </ChartCard>
          </Col>
        </Row>
      )}
    </Space>
  )
}
