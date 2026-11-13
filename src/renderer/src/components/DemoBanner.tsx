import { Button, Flex, Popconfirm, Typography, theme } from 'antd'
import { ApiOutlined, ArrowLeftOutlined, ExperimentOutlined, UndoOutlined } from '@ant-design/icons'
import { useStartOnboarding } from '../auth/onboarding-context'
import { useHasAzureProfile, useIsDemo, useLeaveDemo, useRestoreDemo } from '../ipc/useProfile'
import { t } from '../i18n'

const { Text } = Typography

/**
 * Faixa do Perfil de demonstração (RN-GLB-15): sempre visível, presa ao topo com
 * o cabeçalho, dizendo que os dados são fictícios e com as duas saídas. Com o
 * Perfil do Azure já criado, a saída é voltar para ele: a v1 tem um só (ADR 0002),
 * e criar outro deixaria o primeiro sem caminho de volta. Usa o
 * destaque do tema, e não as cores de situação: não é alerta nem estado de item.
 */
export function DemoBanner(): React.JSX.Element | null {
  const isDemo = useIsDemo()
  const startOnboarding = useStartOnboarding()
  const restore = useRestoreDemo()
  const leave = useLeaveDemo()
  const hasAzureProfile = useHasAzureProfile()
  const { token } = theme.useToken()

  if (!isDemo) return null

  return (
    <Flex
      role="status"
      align="center"
      justify="space-between"
      gap={12}
      wrap
      style={{
        padding: '8px 32px',
        background: token.colorPrimaryBg,
        borderBottom: `1px solid ${token.colorPrimaryBorder}`
      }}
    >
      <Flex align="center" gap={10} style={{ minWidth: 0 }}>
        <ExperimentOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
        <Text strong>{t('demo.bannerTitle')}</Text>
        <Text type="secondary">{t('demo.bannerText')}</Text>
      </Flex>
      <Flex align="center" gap={8}>
        {restore.isError && <Text type="danger">{restore.error.message}</Text>}
        {leave.isError && <Text type="danger">{leave.error.message}</Text>}
        <Popconfirm
          title={t('demo.restoreConfirmTitle')}
          description={<div style={{ maxWidth: 320 }}>{t('demo.restoreConfirmText')}</div>}
          okText={t('demo.restore')}
          onConfirm={() => restore.mutate()}
        >
          <Button size="small" icon={<UndoOutlined />} loading={restore.isPending}>
            {t('demo.restore')}
          </Button>
        </Popconfirm>
        {hasAzureProfile ? (
          <Button
            size="small"
            type="primary"
            icon={<ArrowLeftOutlined />}
            loading={leave.isPending}
            onClick={() => leave.mutate()}
          >
            {t('demo.backToProfile')}
          </Button>
        ) : (
          <Button size="small" type="primary" icon={<ApiOutlined />} onClick={startOnboarding}>
            {t('demo.connect')}
          </Button>
        )}
      </Flex>
    </Flex>
  )
}
