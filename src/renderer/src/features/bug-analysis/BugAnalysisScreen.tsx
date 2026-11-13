import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme
} from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { Bar, DualAxes, Pie } from '@ant-design/plots'
import type { BugItem } from '@shared/dashboards'
import { DashboardFilters } from '../../components/DashboardFilters'
import { ErrorState } from '../../components/ErrorState'
import { HelpTip } from '../../components/HelpTip'
import { formatPercent, t, tPlural } from '../../i18n'
import { useBugAnalysis, useConfiguration, useSelection, useSprints } from '../../ipc/useAzure'
import { BugList } from './BugList'
import {
  BUG_RED,
  BUG_RED_DIM,
  RECURRENCE_ORANGE,
  getCriticalityColor,
  stateColors
} from './constants'

const { Text } = Typography

type ViewMode = 'sprint' | 'month'

/** The filter selector shows 5 sprints; the history is fetched deeper for month stats. */
const HISTORY_SPRINTS = 12
const FILTER_SPRINTS = 5
/** Periods plotted in the history chart, most recent on the right. */
const HISTORY_BARS = 5

export function BugAnalysisScreen(): React.JSX.Element {
  const { token } = theme.useToken()
  const { criticality: criticalityLevels, recurrentBugTag } = useConfiguration()
  const criticalityColor = (value: string): string => getCriticalityColor(value, criticalityLevels)
  const selection = useSelection('review')
  const product = selection.value
  const [sprintKey, setSprintKey] = useState<string>()

  const [viewMode, setViewMode] = useState<ViewMode>('sprint')
  const [sprintFilter, setSprintFilter] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  const [criticalityFilter, setCriticalityFilter] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<string | null>(null)

  // One fetch: the 12-sprint history already starts with the 5 the filter needs.
  const sprints = useSprints(HISTORY_SPRINTS)
  const historySprints = sprints.data
  const filterSprints = useMemo(() => historySprints?.slice(0, FILTER_SPRINTS), [historySprints])
  const selectedSprint = filterSprints?.find((s) => s.key === sprintKey) ?? filterSprints?.[0]

  const analysis = useBugAnalysis(product, historySprints, selectedSprint)

  const sprintStats = useMemo(() => analysis.data?.sprintStats ?? [], [analysis.data])
  const monthStats = useMemo(() => analysis.data?.monthStats ?? [], [analysis.data])
  const activeBugsByState = analysis.data?.activeBugsByState ?? []
  const activeBugsCount = analysis.data?.activeBugsCount ?? 0
  const criticalityConfigured = analysis.data?.criticalityConfigured ?? true
  const recurrenceConfigured = analysis.data?.recurrenceConfigured ?? true
  const stateColorOf = useMemo(
    () =>
      stateColors(
        analysis.data?.stateOrder ?? [],
        (analysis.data?.activeBugsByState ?? []).map((entry) => entry.name)
      ),
    [analysis.data]
  )
  const allBugs = useMemo(() => analysis.data?.allBugs ?? [], [analysis.data])
  const activeBugItems = useMemo(() => analysis.data?.activeBugItems ?? [], [analysis.data])
  const selectedSprintKey = selectedSprint?.key ?? ''

  // ── Sprint view: created in the sprint + closed in it (from earlier sprints)
  //    + still-active bugs, without duplicates ────────────────────────────────
  function buildSprintView(key: string): BugItem[] {
    const createdInSprint = allBugs.filter((b) => b.sprintKey === key)
    const closedInSprint = allBugs.filter((b) => b.closedSprintKey === key && b.sprintKey !== key)
    const sprintIds = new Set([...createdInSprint, ...closedInSprint].map((b) => b.id))
    const activeNotInSprint = activeBugItems.filter((b) => !sprintIds.has(b.id))
    return [...createdInSprint, ...closedInSprint, ...activeNotInSprint]
  }

  // ── Cross-filtering ────────────────────────────────────────────────────────
  // A period filter (history click) reads from the full history; without one,
  // the base is the combined sprint view.
  const activePeriodFilter = sprintFilter ?? monthFilter
  const filterBase = activePeriodFilter ? allBugs : buildSprintView(selectedSprintKey)

  const filteredBugs = filterBase.filter((b) => {
    if (sprintFilter && b.sprintKey !== sprintFilter) return false
    if (monthFilter && b.monthKey !== monthFilter) return false
    if (criticalityFilter && b.criticality !== criticalityFilter) return false
    if (stateFilter && b.state !== stateFilter) return false
    return true
  })

  const displayBugs =
    activePeriodFilter || criticalityFilter || stateFilter
      ? filteredBugs
      : buildSprintView(selectedSprintKey)

  const selectedSprintStats = sprintStats.find((s) => s.sprintKey === selectedSprintKey)
  const totalInSelectedSprint = selectedSprintStats?.total ?? 0

  const currentMonthKey = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  const currentMonthStats = monthStats.find((m) => m.monthKey === currentMonthKey)
  const totalInCurrentMonth = currentMonthStats?.total ?? 0
  const recurrenceRateCurrentMonth = currentMonthStats?.recurrenceRate ?? 0
  const recurrentCountCurrentMonth = currentMonthStats?.recurrentCount ?? 0

  // SLA over the combined sprint list (created + closed in the sprint + active)
  const slaSprintBugs = sprintFilter
    ? allBugs.filter((b) => b.sprintKey === sprintFilter || b.closedSprintKey === sprintFilter)
    : monthFilter
      ? allBugs.filter((b) => b.monthKey === monthFilter)
      : buildSprintView(selectedSprintKey)
  const closedWithinSla = slaSprintBugs.filter(
    (b) => b.closedDate && b.dueDate && new Date(b.closedDate) <= new Date(b.dueDate)
  ).length
  const slaTotal = slaSprintBugs.filter((b) => b.closedDate && b.dueDate).length

  const slaMonthBugs = allBugs.filter((b) => b.monthKey === currentMonthKey)
  const closedWithinSlaMonth = slaMonthBugs.filter(
    (b) => b.closedDate && b.dueDate && new Date(b.closedDate) <= new Date(b.dueDate)
  ).length
  const slaTotalMonth = slaMonthBugs.filter((b) => b.closedDate && b.dueDate).length

  // Criticality reflects whichever period is actually on screen
  const critBugs = sprintFilter
    ? allBugs.filter((b) => b.sprintKey === sprintFilter)
    : monthFilter
      ? allBugs.filter((b) => b.monthKey === monthFilter)
      : allBugs.filter((b) => b.sprintKey === selectedSprintKey)
  const activeCritCounts: Record<string, number> = {}
  for (const b of critBugs) {
    const key = b.criticality || t('bugs.unknownCriticality')
    activeCritCounts[key] = (activeCritCounts[key] ?? 0) + 1
  }
  const activeCriticalityBreakdown = Object.entries(activeCritCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // ── Click handlers ─────────────────────────────────────────────────────────

  function handleSprintBarClick(key: string): void {
    const next = key === sprintFilter ? null : key
    setSprintFilter(next)
    if (next !== selectedSprintKey) setCriticalityFilter(null)
  }

  function handleMonthBarClick(key: string): void {
    setMonthFilter(key === monthFilter ? null : key)
    setCriticalityFilter(null)
    setStateFilter(null)
  }

  function handleViewModeChange(next: ViewMode): void {
    setViewMode(next)
    setSprintFilter(null)
    setMonthFilter(null)
    setCriticalityFilter(null)
    setStateFilter(null)
  }

  function handleCriticalityClick(name: string): void {
    setCriticalityFilter(name === criticalityFilter ? null : name)
    setSprintFilter(null)
    setMonthFilter(null)
    setStateFilter(null)
  }

  function handleStateClick(name: string): void {
    // State filter is independent — sprint and criticality filters stay put.
    setStateFilter(name === stateFilter ? null : name)
  }

  function handleClearFilters(): void {
    setViewMode('sprint')
    setSprintFilter(null)
    setMonthFilter(null)
    setCriticalityFilter(null)
    setStateFilter(null)
  }

  const hasActiveFilters =
    viewMode === 'month' ||
    sprintFilter !== null ||
    monthFilter !== null ||
    criticalityFilter !== null ||
    stateFilter !== null

  function resolveListTitle(): string {
    const parts: string[] = []
    if (sprintFilter) {
      const s = sprintStats.find((s) => s.sprintKey === sprintFilter)
      if (s) parts.push(s.sprintName)
    } else if (monthFilter) {
      const m = monthStats.find((m) => m.monthKey === monthFilter)
      if (m) parts.push(m.monthLabel)
    }
    if (criticalityFilter) parts.push(criticalityFilter)
    if (stateFilter) parts.push(stateFilter)
    return parts.length
      ? parts.join(' · ')
      : (selectedSprintStats?.sprintName ?? t('bugs.currentSprint'))
  }

  // ── Chart data ─────────────────────────────────────────────────────────────

  const historyData = useMemo(() => {
    const rows =
      viewMode === 'sprint'
        ? sprintStats.map((s) => ({
            key: s.sprintKey,
            label: s.sprintName,
            total: s.total,
            recurrenceRate: s.recurrenceRate
          }))
        : monthStats.map((m) => ({
            key: m.monthKey,
            label: m.monthLabel,
            total: m.total,
            recurrenceRate: m.recurrenceRate
          }))

    // Stats arrive oldest → newest, so the last N puts the current period on the
    // right and keeps the chart readable in both sprint and month modes.
    return rows.slice(-HISTORY_BARS)
  }, [viewMode, sprintStats, monthStats])

  const activeHistoryKey = viewMode === 'sprint' ? sprintFilter : monthFilter

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <DashboardFilters
          selection={selection}
          sprints={filterSprints}
          selectedSprintKey={selectedSprint?.key}
          onSprintChange={setSprintKey}
        />
        <Flex align="center" gap={8}>
          <HelpTip rule="RN-BUG-10" />
          <Button
            icon={<CloseOutlined />}
            disabled={!hasActiveFilters}
            onClick={handleClearFilters}
          >
            {t('bugs.clearFilters')}
          </Button>
        </Flex>
      </Flex>

      {sprints.isError && <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />}
      {analysis.isError && <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} />}

      {analysis.isPending || analysis.isFetching ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : sprintStats.length === 0 && allBugs.length === 0 ? (
        <Empty description={t('bugs.empty')} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title={
                    viewMode === 'month' ? t('bugs.createdInMonth') : t('bugs.createdInSprint')
                  }
                  value={viewMode === 'month' ? totalInCurrentMonth : totalInSelectedSprint}
                />
                <Text type="secondary">
                  {viewMode === 'month' ? t('bugs.openedInMonth') : t('bugs.openedInSprint')}
                </Text>
              </Card>
            </Col>

            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title={
                    <Flex align="center" justify="space-between" gap={8}>
                      <span>{t('bugs.recurrence')}</span>
                      <HelpTip rule="RN-BUG-06" />
                    </Flex>
                  }
                  value={
                    viewMode === 'month'
                      ? recurrenceRateCurrentMonth
                      : (selectedSprintStats?.recurrenceRate ?? 0)
                  }
                  suffix="%"
                />
                <Text type="secondary">
                  {recurrenceConfigured
                    ? t('bugs.recurrentCount', {
                        count:
                          viewMode === 'month'
                            ? recurrentCountCurrentMonth
                            : (selectedSprintStats?.recurrentCount ?? 0),
                        tag: recurrentBugTag ?? ''
                      })
                    : t('bugs.recurrenceOff')}
                </Text>
              </Card>
            </Col>

            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title={
                    <Flex align="center" justify="space-between" gap={8}>
                      <span>{t('bugs.inTreatment')}</span>
                      <HelpTip rule="RN-BUG-04" />
                    </Flex>
                  }
                  value={activeBugsCount}
                />
                <Text type="secondary">{t('bugs.activeHint')}</Text>
              </Card>
            </Col>

            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title={
                    <Flex align="center" justify="space-between" gap={8}>
                      <span>{t('bugs.closedInSla')}</span>
                      <HelpTip rule="RN-BUG-08" />
                    </Flex>
                  }
                  value={viewMode === 'month' ? closedWithinSlaMonth : closedWithinSla}
                  suffix={
                    (viewMode === 'month' ? slaTotalMonth : slaTotal) > 0 ? (
                      <Text type="secondary">
                        {t('bugs.withDueDate', {
                          total: viewMode === 'month' ? slaTotalMonth : slaTotal
                        })}
                      </Text>
                    ) : undefined
                  }
                />
                <Text type="secondary">
                  {(viewMode === 'month' ? slaTotalMonth : slaTotal) > 0
                    ? t('bugs.closedBeforeDue', {
                        percent: Math.round(
                          ((viewMode === 'month' ? closedWithinSlaMonth : closedWithinSla) /
                            (viewMode === 'month' ? slaTotalMonth : slaTotal)) *
                            100
                        )
                      })
                    : t('bugs.noDueDate')}
                </Text>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card
                title={t('bugs.history')}
                extra={
                  <Segmented
                    size="small"
                    options={[
                      { label: t('common.sprint'), value: 'sprint' },
                      { label: t('common.month'), value: 'month' }
                    ]}
                    value={viewMode}
                    onChange={(value) => handleViewModeChange(value as ViewMode)}
                  />
                }
              >
                <Text type="secondary">{t('bugs.clickBar')}</Text>
                <DualAxes
                  height={260}
                  legend={false}
                  // Each series declares its own data and fields. Relying on the
                  // top-level `data`/`xField` to reach both series left the chart
                  // rendering a single bar.
                  // `children` is the DualAxes series config, not React children.
                  // eslint-disable-next-line react/no-children-prop
                  children={[
                    {
                      type: 'interval',
                      data: historyData,
                      xField: 'label',
                      yField: 'total',
                      style: {
                        fill: (datum: { key: string }) =>
                          activeHistoryKey === null || datum.key === activeHistoryKey
                            ? BUG_RED
                            : BUG_RED_DIM,
                        cursor: 'pointer'
                      }
                    },
                    {
                      type: 'line',
                      data: historyData,
                      xField: 'label',
                      yField: 'recurrenceRate',
                      style: { stroke: RECURRENCE_ORANGE, lineWidth: 2 },
                      axis: {
                        y: { position: 'right', labelFormatter: (v: number) => formatPercent(v) }
                      }
                    }
                  ]}
                  onReady={({ chart }) => {
                    chart.on('interval:click', (event: { data?: { data?: { key?: string } } }) => {
                      const key = event.data?.data?.key
                      if (!key) return
                      if (viewMode === 'sprint') handleSprintBarClick(key)
                      else handleMonthBarClick(key)
                    })
                  }}
                />
              </Card>
            </Col>

            <Col xs={24} lg={6}>
              <Card
                title={t('bugs.criticality')}
                extra={
                  <Flex align="center" gap={8}>
                    {criticalityFilter && (
                      <Tag closable onClose={() => setCriticalityFilter(null)}>
                        {criticalityFilter}
                      </Tag>
                    )}
                    <HelpTip rule="RN-BUG-12" />
                  </Flex>
                }
              >
                {!criticalityConfigured ? (
                  <Empty description={t('bugs.criticalityOff')} />
                ) : activeCriticalityBreakdown.length === 0 ? (
                  <Empty description={t('bugs.noneInSprint')} />
                ) : (
                  <>
                    <Bar
                      height={180}
                      data={activeCriticalityBreakdown}
                      xField="name"
                      yField="value"
                      // Category labels are hidden: the clickable legend right
                      // below already names each bar, and repeating it here eats
                      // the width the bars need to be readable.
                      axis={{ x: false }}
                      style={{
                        fill: (datum: { name: string }) =>
                          criticalityFilter === null || datum.name === criticalityFilter
                            ? criticalityColor(datum.name)
                            : `${criticalityColor(datum.name)}40`,
                        cursor: 'pointer'
                      }}
                      onReady={({ chart }) => {
                        chart.on(
                          'interval:click',
                          (event: { data?: { data?: { name?: string } } }) => {
                            const name = event.data?.data?.name
                            if (name) handleCriticalityClick(name)
                          }
                        )
                      }}
                    />
                    <Space orientation="vertical" size={4} style={{ width: '100%', marginTop: 12 }}>
                      {activeCriticalityBreakdown.map((entry) => (
                        <Flex
                          key={entry.name}
                          align="center"
                          gap={8}
                          onClick={() => handleCriticalityClick(entry.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: criticalityColor(entry.name),
                              opacity:
                                criticalityFilter === null || criticalityFilter === entry.name
                                  ? 1
                                  : 0.3
                            }}
                          />
                          <Text style={{ flex: 1, fontSize: 12 }}>{entry.name}</Text>
                          <Text
                            strong
                            style={{ fontSize: 12, color: criticalityColor(entry.name) }}
                          >
                            {entry.value}
                          </Text>
                        </Flex>
                      ))}
                    </Space>
                  </>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={6}>
              <Card
                title={t('bugs.inTreatment')}
                extra={
                  stateFilter && (
                    <Tag closable onClose={() => setStateFilter(null)}>
                      {stateFilter}
                    </Tag>
                  )
                }
              >
                {activeBugsByState.length === 0 ? (
                  <Empty description={t('bugs.noneInTreatment')} />
                ) : (
                  <>
                    <Pie
                      height={180}
                      data={activeBugsByState}
                      angleField="value"
                      colorField="name"
                      innerRadius={0.6}
                      legend={false}
                      label={false}
                      scale={{
                        color: {
                          palette: activeBugsByState.map((entry) => stateColorOf.get(entry.name)!)
                        }
                      }}
                      onReady={({ chart }) => {
                        chart.on(
                          'element:click',
                          (event: { data?: { data?: { name?: string } } }) => {
                            const name = event.data?.data?.name
                            if (name) handleStateClick(name)
                          }
                        )
                      }}
                    />
                    <Space orientation="vertical" size={4} style={{ width: '100%', marginTop: 12 }}>
                      {activeBugsByState.map((entry) => {
                        const color = stateColorOf.get(entry.name)!
                        const pct =
                          activeBugsCount > 0
                            ? Math.round((entry.value / activeBugsCount) * 100)
                            : 0
                        return (
                          <Flex
                            key={entry.name}
                            align="center"
                            gap={8}
                            onClick={() => handleStateClick(entry.name)}
                            style={{
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: 999,
                              background:
                                stateFilter === entry.name ? token.colorPrimaryBg : 'transparent'
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: color
                              }}
                            />
                            <Text style={{ flex: 1, fontSize: 12 }}>{entry.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {pct}%
                            </Text>
                            <Text strong style={{ fontSize: 12, color }}>
                              {entry.value}
                            </Text>
                          </Flex>
                        )
                      })}
                    </Space>
                  </>
                )}
              </Card>
            </Col>
          </Row>

          <Card
            title={resolveListTitle()}
            extra={
              <Flex align="center" gap={8}>
                <Text type="secondary">{tPlural('bugs.bugCount', displayBugs.length)}</Text>
                <HelpTip rule="RN-BUG-09" />
              </Flex>
            }
          >
            <BugList bugs={displayBugs} />
          </Card>
        </>
      )}
    </Space>
  )
}
