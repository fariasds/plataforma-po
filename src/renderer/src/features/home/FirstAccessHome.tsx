import { Button, Card, Flex, Progress, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { FIRST_STEPS, type FirstStep, type FirstStepsState } from '@shared/home'
import { useIsDemo, useStartDemo } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { MONO_FONT, NEUTRA, SIDER, STATUS } from '../../theme'
import { PHASE_ROUTE } from './phase'

const { Title, Text, Paragraph } = Typography

function stepCopy(step: FirstStep): { title: string; text: string | null } {
  switch (step) {
    case 'connect':
      return { title: t('home.firstSteps.connectTitle'), text: null }
    case 'planning':
      return { title: t('home.firstSteps.planningTitle'), text: t('home.firstSteps.planningText') }
    case 'daily':
      return { title: t('home.firstSteps.dailyTitle'), text: t('home.firstSteps.dailyText') }
    case 'review':
      return { title: t('home.firstSteps.reviewTitle'), text: t('home.firstSteps.reviewText') }
  }
}

/** Marca do passo: verde é "concluído" (`STATUS.ok`), o anel cinza é "ainda não". */
function StepMark({ done }: { done: boolean }): React.JSX.Element {
  return done ? (
    <CheckCircleOutlined
      role="img"
      aria-label={t('home.firstSteps.done')}
      style={{ fontSize: 22, color: STATUS.ok.solid }}
    />
  ) : (
    <span
      role="img"
      aria-label={t('home.firstSteps.pending')}
      style={{
        width: 22,
        height: 22,
        flex: 'none',
        borderRadius: '50%',
        border: `2px solid ${NEUTRA[400]}`,
        boxSizing: 'border-box'
      }}
    />
  )
}

function StepRow({
  step,
  done,
  primary,
  last
}: {
  step: FirstStep
  done: boolean
  /** O próximo passo pendente ganha o botão principal. */
  primary: boolean
  last: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const copy = stepCopy(step)
  const route = step === 'connect' ? null : PHASE_ROUTE[step]

  return (
    <Flex
      align="center"
      gap={14}
      wrap
      style={{
        padding: last ? '12px 0 0' : '12px 0',
        borderBottom: last ? undefined : `1px solid ${NEUTRA[100]}`
      }}
    >
      <StepMark done={done} />
      <Flex vertical gap={2} style={{ flex: '1 1 240px', minWidth: 0 }}>
        <Text
          strong
          type={done ? 'secondary' : undefined}
          delete={done}
          style={{ fontWeight: 600 }}
        >
          {copy.title}
        </Text>
        {copy.text && !done && <Text type="secondary">{copy.text}</Text>}
      </Flex>
      {route && !done && (
        <Button type={primary ? 'primary' : 'default'} onClick={() => navigate(route)}>
          {primary ? t('home.firstSteps.start') : t('home.firstSteps.open')}
        </Button>
      )}
    </Flex>
  )
}

/** Card escuro que leva à demonstração. Já dentro dela, não tem o que oferecer. */
function DemoCard(): React.JSX.Element | null {
  const isDemo = useIsDemo()
  const startDemo = useStartDemo()
  if (isDemo) return null

  return (
    <Card style={{ background: SIDER.bg, borderColor: SIDER.bg }}>
      <Flex vertical gap={10} align="flex-start">
        <Title level={2} style={{ margin: 0, fontSize: 15, color: SIDER.textStrong }}>
          {t('home.demo.title')}
        </Title>
        <Paragraph style={{ margin: 0, color: SIDER.text, lineHeight: 1.5 }}>
          {t('home.demo.text')}
        </Paragraph>
        <Button loading={startDemo.isPending} onClick={() => startDemo.mutate()}>
          {t('home.demo.action')}
        </Button>
        {startDemo.isError && (
          <Text style={{ color: SIDER.textStrong }}>{startDemo.error.message}</Text>
        )}
      </Flex>
    </Card>
  )
}

/** Quadro B do desenho: boas-vindas e primeiros passos (`RN-HOM-03`). */
export function FirstAccessHome({
  state,
  onHide
}: {
  state: FirstStepsState
  onHide: () => void
}): React.JSX.Element {
  const total = FIRST_STEPS.length
  const nextStep = FIRST_STEPS.find((step) => !state.done[step])
  const allDone = nextStep === undefined

  return (
    <Flex vertical gap={24} style={{ maxWidth: 1240, paddingTop: 8 }}>
      <Flex vertical gap={6}>
        <Title level={2} style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>
          {t('home.welcome.title')}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
          {t('home.welcome.text')}
        </Paragraph>
      </Flex>

      <Flex gap={24} wrap align="flex-start">
        <Card style={{ flex: '3 1 460px', minWidth: 0 }}>
          <Flex vertical gap={14}>
            <Flex align="center" justify="space-between" gap={8} wrap>
              <Title level={2} style={{ margin: 0, fontSize: 15 }}>
                {t('home.firstSteps.title')}
              </Title>
              <Text type="secondary" style={{ fontFamily: MONO_FONT, fontSize: 12.5 }}>
                {t('home.firstSteps.progress', { done: state.doneCount, total })}
              </Text>
            </Flex>
            <Progress
              percent={(state.doneCount / total) * 100}
              showInfo={false}
              strokeColor={STATUS.ok.solid}
              railColor={NEUTRA[100]}
              size={{ height: 6 }}
              aria-label={t('home.firstSteps.progressLabel')}
            />
            <div>
              {FIRST_STEPS.map((step, i) => (
                <StepRow
                  key={step}
                  step={step}
                  done={state.done[step]}
                  primary={step === nextStep}
                  last={i === total - 1}
                />
              ))}
            </div>
            <Button
              type={allDone ? 'primary' : 'link'}
              onClick={onHide}
              style={
                allDone ? { alignSelf: 'flex-start' } : { alignSelf: 'flex-start', padding: 0 }
              }
            >
              {allDone ? t('home.firstSteps.finish') : t('home.firstSteps.skip')}
            </Button>
          </Flex>
        </Card>

        <Flex vertical gap={16} style={{ flex: '2 1 300px', minWidth: 0 }}>
          <DemoCard />
        </Flex>
      </Flex>
    </Flex>
  )
}
