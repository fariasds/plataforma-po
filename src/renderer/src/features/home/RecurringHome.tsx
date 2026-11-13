import { Button, Card, Flex, Skeleton, Tag, Typography, theme } from 'antd'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  ExportOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { sprintShortName, type UnifiedSprint } from '@shared/azure'
import { createCalendar } from '@shared/calendar'
import { dayPeriod, sprintMoment, type SprintMoment, type SprintPhase } from '@shared/home'
import { HelpTip } from '../../components/HelpTip'
import { useConfiguration, useCurrentUser, useSprints } from '../../ipc/useAzure'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { accentTones, MONO_FONT, NEUTRA, SIDER } from '../../theme'
import { PHASE_ROUTE, PHASES } from './phase'

const { Title, Text, Paragraph } = Typography

/** "Daniel Farias" → "Daniel": é como se cumprimenta. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0]
}

function Mono({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span style={{ fontFamily: MONO_FONT }}>{children}</span>
}

function sprintContext(sprint: UnifiedSprint | undefined, moment: SprintMoment): React.ReactNode {
  if (!sprint) return t('home.noSprint')
  const name = sprintShortName(sprint) ?? sprint.label
  if (moment.day !== null && moment.totalDays !== null) {
    return tRich('home.sprintDay', {
      sprint: name,
      day: <Mono>{moment.day}</Mono>,
      total: <Mono>{moment.totalDays}</Mono>
    })
  }
  return moment.phase === 'planning'
    ? t('home.sprintBefore', { sprint: name })
    : t('home.sprintEnded', { sprint: name })
}

function suggestionCopy(phase: SprintPhase): { title: string; text: string; action: string } {
  switch (phase) {
    case 'planning':
      return {
        title: t('home.suggestion.planningTitle'),
        text: t('home.suggestion.planningText'),
        action: t('home.suggestion.planningAction')
      }
    case 'daily':
      return {
        title: t('home.suggestion.dailyTitle'),
        text: t('home.suggestion.dailyText'),
        action: t('home.suggestion.dailyAction')
      }
    case 'review':
      return {
        title: t('home.suggestion.reviewTitle'),
        text: t('home.suggestion.reviewText'),
        action: t('home.suggestion.reviewAction')
      }
  }
}

/** Card escuro com a tela do momento atual (`RN-HOM-02`). */
function SuggestionCard({ phase }: { phase: SprintPhase }): React.JSX.Element {
  const navigate = useNavigate()
  const copy = suggestionCopy(phase)
  return (
    <Card
      style={{ flex: '1 1 420px', background: SIDER.bg, borderColor: SIDER.bg }}
      styles={{ body: { padding: '18px 20px' } }}
    >
      <Flex align="center" justify="space-between" gap={16} wrap>
        <Flex vertical gap={4} style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Flex align="center" gap={8}>
            <Text
              style={{
                fontSize: 12.5,
                color: SIDER.subtle,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              {t('home.suggestion.label')}
            </Text>
            <HelpTip rule="RN-HOM-02" />
          </Flex>
          <Text strong style={{ color: SIDER.textStrong, fontSize: 15 }}>
            {copy.title}
          </Text>
          <Text style={{ color: SIDER.text, fontSize: 13 }}>{copy.text}</Text>
        </Flex>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          iconPlacement="end"
          onClick={() => navigate(PHASE_ROUTE[phase])}
        >
          {copy.action}
        </Button>
      </Flex>
    </Card>
  )
}

function cycleCopy(phase: SprintPhase): {
  step: string
  title: string
  text: string
  link: string
} {
  switch (phase) {
    case 'planning':
      return {
        step: t('home.cycle.planningStep'),
        title: t('nav.planning'),
        text: t('home.cycle.planningText'),
        link: t('home.cycle.planningLink')
      }
    case 'daily':
      return {
        step: t('home.cycle.dailyStep'),
        title: t('nav.daily'),
        text: t('home.cycle.dailyText'),
        link: t('home.cycle.dailyLink')
      }
    case 'review':
      return {
        step: t('home.cycle.reviewStep'),
        title: t('nav.review'),
        text: t('home.cycle.reviewText'),
        link: t('home.cycle.reviewLink')
      }
  }
}

function CycleStep({
  phase,
  current
}: {
  phase: SprintPhase
  current: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const tones = accentTones(token.colorPrimary)
  const copy = cycleCopy(phase)

  return (
    <article
      aria-current={current ? 'step' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: current ? 15 : 16,
        borderRadius: 12,
        border: current ? `2px solid ${tones.base}` : `1px solid ${token.colorBorder}`,
        background: current ? tones.soft : undefined
      }}
    >
      <Flex align="center" justify="space-between" gap={10} style={{ minHeight: 22 }}>
        <Text
          type="secondary"
          style={{ fontFamily: MONO_FONT, fontSize: 12, textTransform: 'uppercase' }}
        >
          {copy.step}
        </Text>
        {current && (
          <Tag
            variant="filled"
            style={{
              marginInlineEnd: 0,
              fontWeight: 600,
              color: tones.softText,
              background: token.colorBgContainer
            }}
          >
            {t('home.cycle.youAreHere')}
          </Tag>
        )}
      </Flex>
      <Title level={3} style={{ margin: 0, fontSize: 16 }}>
        {copy.title}
      </Title>
      <Paragraph type="secondary" style={{ margin: 0, lineHeight: 1.5 }}>
        {copy.text}
      </Paragraph>
      <Button
        type="link"
        icon={<ArrowRightOutlined />}
        iconPlacement="end"
        onClick={() => navigate(PHASE_ROUTE[phase])}
        style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: 0, fontWeight: 500 }}
      >
        {copy.link}
      </Button>
    </article>
  )
}

function Tip({
  icon,
  children
}: {
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card style={{ flex: '1 1 240px' }} styles={{ body: { padding: '14px 16px' } }}>
      <Flex gap={12}>
        <span aria-hidden="true" style={{ color: NEUTRA[500], fontSize: 17, lineHeight: 1.4 }}>
          {icon}
        </span>
        <Text style={{ color: NEUTRA[600], lineHeight: 1.5 }}>{children}</Text>
      </Flex>
    </Card>
  )
}

/** Quadro A do desenho: a Home de quem já conhece o app. */
export function RecurringHome({
  onReviewFirstSteps
}: {
  onReviewFirstSteps: () => void
}): React.JSX.Element {
  const config = useConfiguration()
  const sprints = useSprints(1)
  const user = useCurrentUser()

  const now = new Date()
  const sprint = sprints.data?.[0]
  // Falha ao buscar sprints não derruba a Home: ela segue como se não houvesse sprint.
  const moment = sprintMoment(sprint, createCalendar(config.calendar), now)
  const greeting = t(`home.greeting.${dayPeriod(now)}`)
  const name = user.data?.displayName
  const loading = sprints.isLoading

  return (
    <Flex vertical gap={24} style={{ maxWidth: 1240 }}>
      <Flex gap={16} wrap align="stretch">
        <Flex vertical justify="center" gap={6} style={{ flex: '1 1 380px', minWidth: 0 }}>
          <Title level={2} style={{ margin: 0, fontSize: 22, letterSpacing: '-0.01em' }}>
            {name ? t('home.greetingName', { greeting, name: firstNameOf(name) }) : greeting}
          </Title>
          {loading ? (
            <Skeleton.Input active size="small" style={{ width: 240 }} />
          ) : (
            <Text type="secondary">{sprintContext(sprint, moment)}</Text>
          )}
        </Flex>
        {loading ? (
          <Skeleton.Node active style={{ flex: '1 1 420px', width: '100%', height: 96 }} />
        ) : (
          <SuggestionCard phase={moment.phase} />
        )}
      </Flex>

      <Card>
        <Flex vertical gap={16}>
          <Flex align="baseline" justify="space-between" gap={8} wrap>
            <Title level={2} style={{ margin: 0, fontSize: 15 }}>
              {t('home.cycle.title')}
            </Title>
            <Button type="link" onClick={onReviewFirstSteps} style={{ padding: 0, fontSize: 13 }}>
              {t('home.cycle.reviewFirstSteps')}
            </Button>
          </Flex>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16
            }}
          >
            {PHASES.map((phase) => (
              <CycleStep key={phase} phase={phase} current={!loading && moment.phase === phase} />
            ))}
          </div>
        </Flex>
      </Card>

      <Flex vertical gap={12} component="section" aria-labelledby="home-tips">
        <Title id="home-tips" level={2} style={{ margin: 0, fontSize: 15 }}>
          {t('home.tips.title')}
        </Title>
        <Flex gap={16} wrap>
          <Tip icon={<QuestionCircleOutlined />}>{tRich('home.tips.helpTip')}</Tip>
          <Tip icon={<AppstoreOutlined />}>{t('home.tips.collapseMenu')}</Tip>
          <Tip icon={<ExportOutlined />}>{t('home.tips.exportConfig')}</Tip>
        </Flex>
      </Flex>
    </Flex>
  )
}
