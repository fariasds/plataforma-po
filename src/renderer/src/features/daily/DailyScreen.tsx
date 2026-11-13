import { useState } from 'react'
import { Card, Empty, Flex, Skeleton, Space, Tag, Tooltip, Typography } from 'antd'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import type { DailyAssignee, DailyItem, DailyStatus } from '@shared/dashboards'
import { ErrorState } from '../../components/ErrorState'
import { compareText, t, tPlural } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { HelpTip } from '../../components/HelpTip'
import { ProductFilter } from '../../components/ProductFilter'
import { StateTag } from '../../components/StateTag'
import { useConfiguration, useDaily, useSelection, useSprints } from '../../ipc/useAzure'
import { MONO_FONT, NEUTRA, STATUS, productColors } from '../../theme'
import {
  BLOCKS,
  groupOf,
  HOLIDAY,
  TODAY_MARKER,
  useAccent,
  useRiskColors,
  type RiskGroup
} from './constants'
import { holidayNamesOf } from './holidays'
import { AssigneeAvatar } from './AssigneeAvatar'
import { AssigneeFilter } from './AssigneeFilter'
import { TaskBadge } from './TaskBadge'
import { TimelineBar } from './TimelineBar'

const { Text } = Typography

/**
 * Um terço para identificar o item, dois terços para a linha do tempo. Proporção
 * em vez de largura fixa: em tela larga o título respira, e a régua continua
 * sendo a maior parte — é ela que responde a pergunta da tela.
 */
const LAYOUT_COLUMNS = '1fr 2fr'

/**
 * Respiro à direita da faixa, para a barra que vai até o fim da sprint não colar
 * na borda do card.
 *
 * **Precisa ser idêntico nos dois lugares** — cabeçalho e faixa. Quando só a
 * faixa tinha esse recuo, as colunas do cabeçalho ficavam 16px mais largas e o
 * desencontro crescia para a direita, até a marca de hoje apontar o dia errado.
 */
const TIMELINE_PAD_RIGHT = 16

function DayScale({
  sprintDays,
  weekBreakDay,
  holidayDays,
  holidayNames
}: {
  sprintDays: number
  weekBreakDay: number
  holidayDays: number[]
  holidayNames: Map<number, string>
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: LAYOUT_COLUMNS,
        background: NEUTRA[75],
        borderTop: `1px solid ${NEUTRA[100]}`
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: NEUTRA[500]
        }}
      >
        {t('daily.item')}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${sprintDays}, 1fr)`,
          paddingRight: TIMELINE_PAD_RIGHT
        }}
      >
        {Array.from({ length: sprintDays }, (_, i) => {
          const holiday = holidayDays.includes(i + 1)
          return (
            <Tooltip
              key={i}
              title={
                holiday
                  ? t('daily.holidayTooltip', {
                      day: i + 1,
                      holiday: holidayNames.get(i + 1) ?? t('daily.holidayFallback')
                    })
                  : null
              }
            >
              <span
                style={{
                  fontSize: 10.5,
                  color: holiday ? HOLIDAY.text : NEUTRA[500],
                  fontWeight: holiday ? 700 : 400,
                  textAlign: 'center',
                  padding: '7px 0',
                  fontVariantNumeric: 'tabular-nums',
                  background: holiday ? HOLIDAY.fill : undefined,
                  borderLeft:
                    i === 0
                      ? 'none'
                      : i === weekBreakDay
                        ? `2px solid ${NEUTRA[300]}`
                        : `1px dashed ${NEUTRA[200]}`
                }}
              >
                {holiday ? `${i + 1}★` : i + 1}
              </span>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  sprintDays,
  currentDay,
  weekBreakDay,
  holidayDays,
  showProduct
}: {
  item: DailyItem
  sprintDays: number
  currentDay: number
  weekBreakDay: number
  holidayDays: number[]
  showProduct: boolean
}): React.JSX.Element {
  const { products } = useConfiguration()
  const workItemHref = useWorkItemHref()
  // O item vem do main com o ID de um Produto da Configuração em uso.
  const productOf = (id: string): { name: string; color: string } =>
    products.find((p) => p.id === id) ?? { name: id, color: NEUTRA[500] }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: LAYOUT_COLUMNS,
        alignItems: 'center',
        borderTop: `1px solid ${NEUTRA[100]}`
      }}
    >
      <div style={{ padding: '12px 16px', minWidth: 0 }}>
        <Flex align="center" gap={7} wrap>
          {/*
            Produto na frente do ID: na visão Ambos ele é o primeiro corte que a
            leitura faz, antes de qualquer número.
          */}
          {showProduct && (
            <Tag
              style={{
                marginInlineEnd: 0,
                fontSize: 10,
                lineHeight: '16px',
                background: productColors(productOf(item.product).color).bg,
                color: productColors(productOf(item.product).color).text,
                border: 'none'
              }}
            >
              {productOf(item.product).name}
            </Tag>
          )}
          <Typography.Link
            href={workItemHref(item.id)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12.5, fontFamily: MONO_FONT, fontWeight: 500 }}
          >
            #{item.id}
          </Typography.Link>
          {/*
            O bloco diz a fase (em andamento, não iniciado, concluído); o estado
            diz onde exatamente o item parou dentro dela — aguardando teste e
            retrabalho são situações bem diferentes de "em andamento".
          */}
          <StateTag state={item.state} />
          {/* Só aparece quando houve retrabalho: zero não é informação. */}
          {item.reworkTimes > 0 && (
            <Tooltip title={tPlural('daily.reworkTooltip', item.reworkTimes)}>
              <Tag color="error" style={{ marginInlineEnd: 0 }}>
                {tPlural('daily.reworkTag', item.reworkTimes)}
              </Tag>
            </Tooltip>
          )}
        </Flex>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, margin: '4px 0 2px' }}>
          {item.title}
        </div>
        <Flex align="center" gap={7} wrap>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {item.storyPoints
              ? t('daily.estimate', {
                  points: item.storyPoints,
                  days: String(item.estimateDays)
                })
              : t('daily.noEstimate')}
            {item.startDay !== null && t('daily.startedDay', { day: item.startDay })}
          </Text>
          <TaskBadge tasks={item.tasks} />
        </Flex>
        <Flex align="center" gap={6} style={{ marginTop: 3 }}>
          <AssigneeAvatar assignee={item.assignee} />
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            {item.assignee?.displayName ?? t('common.unassigned')}
          </Text>
        </Flex>
      </div>

      <div style={{ paddingRight: TIMELINE_PAD_RIGHT }}>
        <TimelineBar
          item={item}
          sprintDays={sprintDays}
          currentDay={currentDay}
          weekBreakDay={weekBreakDay}
          holidayDays={holidayDays}
        />
      </div>
    </div>
  )
}

function Block({
  status,
  items,
  sprintDays,
  currentDay,
  weekBreakDay,
  holidayDays,
  holidayNames,
  showProduct
}: {
  status: DailyStatus
  items: DailyItem[]
  sprintDays: number
  currentDay: number
  weekBreakDay: number
  holidayDays: number[]
  holidayNames: Map<number, string>
  showProduct: boolean
}): React.JSX.Element {
  const meta = BLOCKS.find((b) => b.status === status)!
  const accent = useAccent()

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Flex align="center" gap={10} wrap style={{ padding: '14px 16px' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: meta.dot ?? accent.base,
            flex: 'none'
          }}
        />
        <Text strong style={{ fontSize: 15 }}>
          {meta.title}
        </Text>
        <Tag style={{ marginInlineEnd: 0, borderRadius: 999, fontWeight: 600 }}>
          {tPlural('common.itemCount', items.length)}
        </Tag>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {meta.hint}
        </Text>
      </Flex>

      {items.length === 0 ? (
        <div style={{ padding: '8px 16px 20px' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('daily.emptyBlock')} />
        </div>
      ) : (
        <>
          <DayScale
            sprintDays={sprintDays}
            weekBreakDay={weekBreakDay}
            holidayDays={holidayDays}
            holidayNames={holidayNames}
          />
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              sprintDays={sprintDays}
              currentDay={currentDay}
              weekBreakDay={weekBreakDay}
              holidayDays={holidayDays}
              showProduct={showProduct}
            />
          ))}
        </>
      )}
    </Card>
  )
}

/**
 * Item da legenda que também filtra.
 *
 * Legenda e filtro dizem a mesma coisa — "estas são as barras assim" — e separá-los
 * obrigaria a pessoa a traduzir de uma lista para a outra. Clicar filtra; clicar de
 * novo remove, igual ao filtro de responsável (`RN-DLY-15`).
 */
function LegendFilter({
  colors,
  label,
  count,
  active,
  dimmed,
  onClick
}: {
  colors: string[]
  label: string
  count: number
  active: boolean
  dimmed: boolean
  onClick: () => void
}): React.JSX.Element {
  const accent = useAccent()
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        font: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 34,
        cursor: 'pointer',
        padding: '0 12px',
        borderRadius: 9,
        border: `1px solid ${active ? accent.border : NEUTRA[200]}`,
        background: active ? accent.bg : '#FFFFFF',
        // Quem não é o filtro ativo recua, em vez de sumir: a legenda continua
        // legível como legenda mesmo com um filtro ligado.
        opacity: dimmed ? 0.45 : 1
      }}
    >
      <Flex align="center" gap={2}>
        {colors.map((color) => (
          <span
            key={color}
            style={{
              width: 26 / colors.length,
              height: 11,
              borderRadius: 3,
              background: color
            }}
          />
        ))}
      </Flex>
      <Text style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</Text>
      <Text type="secondary" style={{ fontSize: 12, fontFamily: MONO_FONT }}>
        {count}
      </Text>
    </button>
  )
}

export function DailyScreen(): React.JSX.Element {
  const selection = useSelection('planning')
  const product = selection.value
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<RiskGroup | null>(null)

  const config = useConfiguration()
  const riskColors = useRiskColors()
  const sprints = useSprints(1)
  const sprint = sprints.data?.[0]
  const daily = useDaily(product, sprint)

  const data = daily.data
  const items = data?.items ?? []
  const holidayNames = sprint ? holidayNamesOf(config, sprint) : new Map<number, string>()
  const holidayLabel = (data?.holidayDays ?? [])
    .map((day) => (holidayNames.has(day) ? `${day} (${holidayNames.get(day)})` : String(day)))
    .join(', ')
  // Só com item abrandado na tela: em processo sem estado de teste ele nunca
  // existe, e explicar um abrandamento que não acontece seria mobília.
  const hasAwaitingTest = items.some((i) => i.risk === 'awaiting-test')

  // Quem aparece no filtro: responsáveis de itens E de tasks, de todos os blocos.
  const assignees = [
    ...new Map(
      items
        .flatMap((i) => [i.assignee, ...i.tasks.map((t) => t.assignee)])
        .filter((a): a is DailyAssignee => a !== null)
        .map((a) => [a.displayName, a] as const)
    ).values()
  ].sort((a, b) => compareText(a.displayName, b.displayName))

  /**
   * Um item pertence à pessoa quando ela é a responsável **ou** quando tem
   * alguma task dele. Sem a segunda condição, quem só pega tasks — comum em
   * front, back e QA no mesmo item — sumiria do próprio filtro.
   */
  function belongsTo(item: DailyItem, name: string): boolean {
    if (item.assignee?.displayName === name) return true
    return item.tasks.some((task) => task.assignee?.displayName === name)
  }

  function itemsOf(status: DailyStatus): DailyItem[] {
    return items.filter(
      (i) =>
        i.status === status &&
        (assigneeFilter === null || belongsTo(i, assigneeFilter)) &&
        (riskFilter === null || groupOf(i) === riskFilter)
    )
  }

  /**
   * Contagem da legenda: respeita o responsável selecionado, mas ignora o próprio
   * filtro de risco. Do contrário, ligar um filtro zeraria os outros números e a
   * legenda deixaria de servir para escolher o próximo.
   */
  const visibleForCount = items.filter(
    (i) => assigneeFilter === null || belongsTo(i, assigneeFilter)
  )
  const countOf = (group: RiskGroup): number =>
    visibleForCount.filter((i) => groupOf(i) === group).length

  const toggleRisk = (group: RiskGroup): void =>
    setRiskFilter((current) => (current === group ? null : group))

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <ProductFilter
          options={selection.options}
          value={selection.value}
          onChange={selection.onChange}
        />

        <Flex align="center" gap={10} wrap>
          {sprint && (
            <Tag style={{ fontFamily: MONO_FONT, fontWeight: 500, marginInlineEnd: 0 }}>
              {sprint.label}
            </Tag>
          )}
          {data && (
            <>
              <Text type="secondary" style={{ fontSize: 13.5 }}>
                {tRich('daily.dayOf', {
                  current: data.currentDay,
                  total: data.sprintDays,
                  remaining: data.remainingDays
                })}
              </Text>
              {data.holidayDays.length > 0 && (
                <Tooltip
                  title={tPlural('daily.holidayNotice', data.holidayDays.length, {
                    days: holidayLabel,
                    sprintDays: data.sprintDays,
                    workingDays: data.workingDays
                  })}
                >
                  <Tag style={{ marginInlineEnd: 0 }}>
                    {t('daily.workingDays', {
                      workingDays: data.workingDays,
                      holidays: tPlural('daily.holidayCount', data.holidayDays.length)
                    })}
                  </Tag>
                </Tooltip>
              )}
              {/* Só quando há feriado: o ajuste na projeção é contraintuitivo, mas
                  explicá-lo em sprint sem feriado seria mobília. */}
              {data.holidayDays.length > 0 && <HelpTip rule="RN-DLY-17" />}
              <Tag
                variant="filled"
                style={{
                  marginInlineEnd: 0,
                  fontWeight: 600,
                  background: STATUS.warning.bg,
                  color: STATUS.warning.text
                }}
              >
                {t('daily.inProgressCount', { count: data.inProgressCount })}
              </Tag>
              <HelpTip rule="RN-DLY-05" />
            </>
          )}
        </Flex>
      </Flex>

      {sprints.isError && <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />}
      {daily.isError && <ErrorState error={daily.error} onRetry={() => daily.refetch()} />}

      {daily.isPending || daily.isFetching ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <>
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex align="center" gap={6} wrap>
              {/*
                Consumido e restante são um botão só: os dois desenham a mesma
                barra na cor de destaque, e o que ela diz é uma coisa só — este item termina
                dentro da sprint.
              */}
              <LegendFilter
                colors={[riskColors['on-track'].consumed, riskColors['on-track'].remaining]}
                label={t('daily.legendOnTrack')}
                count={countOf('optimistic')}
                active={riskFilter === 'optimistic'}
                dimmed={riskFilter !== null && riskFilter !== 'optimistic'}
                onClick={() => toggleRisk('optimistic')}
              />
              <LegendFilter
                colors={[riskColors['over-sprint'].consumed]}
                label={t('daily.legendOverSprint')}
                count={countOf('over-sprint')}
                active={riskFilter === 'over-sprint'}
                dimmed={riskFilter !== null && riskFilter !== 'over-sprint'}
                onClick={() => toggleRisk('over-sprint')}
              />
              <LegendFilter
                colors={[riskColors['over-estimate'].consumed]}
                label={t('daily.legendOverEstimate')}
                count={countOf('over-estimate')}
                active={riskFilter === 'over-estimate'}
                dimmed={riskFilter !== null && riskFilter !== 'over-estimate'}
                onClick={() => toggleRisk('over-estimate')}
              />
              <LegendFilter
                colors={[riskColors.unknown.consumed]}
                label={t('daily.legendUnknown')}
                count={countOf('unknown')}
                active={riskFilter === 'unknown'}
                dimmed={riskFilter !== null && riskFilter !== 'unknown'}
                onClick={() => toggleRisk('unknown')}
              />
              <Flex align="center" gap={7} style={{ paddingLeft: 4 }}>
                <span style={{ width: 2, height: 14, background: TODAY_MARKER, opacity: 0.55 }} />
                <Text style={{ fontSize: 12 }}>{t('daily.today')}</Text>
              </Flex>
              <HelpTip rule="RN-DLY-02" />
              {hasAwaitingTest && <HelpTip rule="RN-DLY-19" />}
            </Flex>

            {assignees.length > 0 && (
              <Flex align="center" gap={10} wrap>
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  {t('daily.assignee')}
                </Text>
                <AssigneeFilter
                  assignees={assignees}
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                />
              </Flex>
            )}
          </Flex>

          {BLOCKS.map((block) => (
            <Block
              key={block.status}
              status={block.status}
              items={itemsOf(block.status)}
              sprintDays={data?.sprintDays ?? 10}
              currentDay={data?.currentDay ?? 1}
              weekBreakDay={data?.weekBreakDay ?? 5}
              holidayDays={data?.holidayDays ?? []}
              holidayNames={holidayNames}
              showProduct={selection.selected?.isGroup ?? false}
            />
          ))}
        </>
      )}
    </Space>
  )
}
