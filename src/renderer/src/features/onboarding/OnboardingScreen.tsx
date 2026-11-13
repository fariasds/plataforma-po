import { useState } from 'react'
import { Alert, Button, Card, Flex, Typography, theme } from 'antd'
import {
  ArrowLeftOutlined,
  ControlOutlined,
  ExperimentOutlined,
  EyeOutlined,
  ImportOutlined,
  LockOutlined,
  RocketOutlined
} from '@ant-design/icons'
import { SetupCard } from '../../auth/PatSetupScreen'
import { AppLogo } from '../../components/AppLogo'
import { useProfileState, useStartDemo } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { accentTones, NEUTRA, SIDER } from '../../theme'
import { ConfigWizard } from './ConfigWizard'
import { ImportConfig } from './ImportConfig'

const { Title, Paragraph, Text } = Typography

type Door = 'choose' | 'wizard' | 'import'

function DoorCard({
  icon,
  title,
  text,
  note,
  primary = false,
  onClick
}: {
  icon: React.ReactNode
  title: string
  text: string
  note?: string
  /** A porta recomendada ganha a borda na cor de destaque. */
  primary?: boolean
  onClick: () => void
}): React.JSX.Element {
  const { token } = theme.useToken()
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        flex: '1 1 260px',
        borderWidth: primary ? 2 : 1,
        borderColor: primary ? token.colorPrimary : undefined
      }}
    >
      <Flex vertical gap={14}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            background: primary ? token.colorPrimaryBg : NEUTRA[100],
            color: primary ? token.colorPrimary : NEUTRA[600]
          }}
        >
          {icon}
        </span>
        <Flex vertical gap={6}>
          <Text strong style={{ fontSize: 17 }}>
            {title}
          </Text>
          <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>
            {text}
          </Text>
        </Flex>
        {note && (
          <Text style={{ fontSize: 13, fontWeight: 600, color: token.colorPrimary }}>{note}</Text>
        )}
      </Flex>
    </Card>
  )
}

/** Uma das promessas do app, no painel da marca. */
function PromiseItem({
  icon,
  title,
  text
}: {
  icon: React.ReactNode
  title: string
  text: string
}): React.JSX.Element {
  const { token } = theme.useToken()
  return (
    <Flex gap={14} align="flex-start">
      <span
        style={{
          width: 32,
          height: 32,
          flex: 'none',
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: SIDER.cardBg,
          color: accentTones(token.colorPrimary).onDark
        }}
      >
        {icon}
      </span>
      <Flex vertical gap={2}>
        <Text strong style={{ color: SIDER.textStrong, fontSize: 14.5 }}>
          {title}
        </Text>
        <Text style={{ color: SIDER.text, fontSize: 13.5 }}>{text}</Text>
      </Flex>
    </Flex>
  )
}

/**
 * Primeira execução: nenhum Perfil nesta máquina. Três portas — o assistente,
 * para quem começa do zero, uma Configuração pronta, ou a demonstração com dados
 * fictícios (RN-GLB-15), que não pede token nem organização.
 *
 * Também abre de dentro da demonstração, pela faixa: aí o Perfil criado é um
 * Perfil novo, e a demonstração continua na lista.
 *
 * O `ProfileGate` mantém esta tela montada depois que o Perfil nasce (`onStart`),
 * senão o app entraria no meio do assistente assim que o token fosse aceito.
 */
export function OnboardingScreen({
  onStart,
  onDone,
  onBack
}: {
  onStart: () => void
  onDone: () => void
  /** Volta para a demonstração sem criar nada; só existe quando se veio dela. */
  onBack?: () => void
}): React.JSX.Element {
  const [door, setDoor] = useState<Door>('choose')
  const { data: state } = useProfileState()
  const startDemo = useStartDemo()
  // Um Perfil criado numa tentativa anterior, nesta mesma sessão, não é criado de novo.
  // A demonstração não conta: dela, o PO cria um Perfil novo, com o seu Azure.
  const profileExists = !!state?.profile && state.profile.kind !== 'demo'
  // Fixado ao abrir: o Perfil nasce no meio do assistente e isso não muda o modo dele.
  const [wizardMode, setWizardMode] = useState<'first-run' | 'redo'>('first-run')

  const open = (next: Door): void => {
    onStart()
    setWizardMode(profileExists ? 'redo' : 'first-run')
    setDoor(next)
  }

  if (door === 'wizard') {
    return (
      <SetupCard width={960}>
        <ConfigWizard
          mode={wizardMode}
          current={profileExists ? (state?.config ?? null) : null}
          onFinished={onDone}
          onCancel={() => setDoor('choose')}
        />
      </SetupCard>
    )
  }

  if (door === 'import') {
    return (
      <SetupCard width={640}>
        <ImportConfig
          profileExists={profileExists}
          onFinished={onDone}
          onCancel={() => setDoor('choose')}
        />
      </SetupCard>
    )
  }

  return (
    <Flex wrap style={{ minHeight: '100vh' }}>
      <Flex
        vertical
        justify="space-between"
        gap={48}
        style={{ flex: '1 1 420px', padding: 56, background: SIDER.bg }}
      >
        <AppLogo size={40} fontSize={19} onDark />
        <Flex vertical gap={18} style={{ maxWidth: 460 }}>
          <Title
            level={1}
            style={{
              margin: 0,
              color: SIDER.textStrong,
              fontSize: 38,
              lineHeight: 1.12,
              letterSpacing: '-0.03em'
            }}
          >
            {t('onboarding.heroTitle')}
          </Title>
          <Paragraph style={{ margin: 0, color: SIDER.text, fontSize: 16, lineHeight: 1.55 }}>
            {t('onboarding.heroText')}
          </Paragraph>
        </Flex>
        <Flex vertical gap={16}>
          <PromiseItem
            icon={<EyeOutlined />}
            title={t('onboarding.promises.readOnlyTitle')}
            text={t('onboarding.promises.readOnlyText')}
          />
          <PromiseItem
            icon={<LockOutlined />}
            title={t('onboarding.promises.localTitle')}
            text={t('onboarding.promises.localText')}
          />
          <PromiseItem
            icon={<ControlOutlined />}
            title={t('onboarding.promises.configurableTitle')}
            text={t('onboarding.promises.configurableText')}
          />
        </Flex>
      </Flex>

      <Flex
        vertical
        justify="center"
        gap={28}
        style={{ flex: '999 1 560px', minWidth: 0, padding: '56px 64px' }}
      >
        <Flex vertical gap={10} style={{ maxWidth: 640 }}>
          {onBack && (
            <div>
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                style={{ padding: 0 }}
              >
                {t('demo.back')}
              </Button>
            </div>
          )}
          <Text
            type="secondary"
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase'
            }}
          >
            {t('onboarding.eyebrow')}
          </Text>
          <Title level={2} style={{ margin: 0, letterSpacing: '-0.02em' }}>
            {t('onboarding.chooseTitle')}
          </Title>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 15 }}>
            {t('onboarding.intro')}
          </Paragraph>
        </Flex>
        <Flex gap={16} wrap style={{ maxWidth: 760 }}>
          <DoorCard
            primary
            icon={<RocketOutlined />}
            title={t('onboarding.wizardDoorTitle')}
            text={t('onboarding.wizardDoorText')}
            note={t('onboarding.wizardDoorNote')}
            onClick={() => open('wizard')}
          />
          <DoorCard
            icon={<ImportOutlined />}
            title={t('onboarding.importDoorTitle')}
            text={t('onboarding.importDoorText')}
            onClick={() => open('import')}
          />
          {!onBack && (
            <DoorCard
              icon={<ExperimentOutlined />}
              title={t('onboarding.demoDoorTitle')}
              text={t('onboarding.demoDoorText')}
              onClick={() => {
                if (!startDemo.isPending) startDemo.mutate(undefined, { onSuccess: onDone })
              }}
            />
          )}
        </Flex>
        {startDemo.isError && (
          <Alert type="error" showIcon title={startDemo.error.message} style={{ maxWidth: 760 }} />
        )}
      </Flex>
    </Flex>
  )
}
