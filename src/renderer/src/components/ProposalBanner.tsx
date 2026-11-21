import { Button, Flex, Typography, theme } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfileState } from '../ipc/useProfile'
import { formatDateTime, t } from '../i18n'

const { Text } = Typography

/**
 * Faixa da proposta da IA do PO (RN-CFG-12), presa ao topo com o cabeçalho. Ela
 * só avisa e leva à revisão: nada muda até o PO aplicar na tela de Configuração.
 * Fundo do destaque, como a da demonstração: não é alerta nem situação.
 */
export function ProposalBanner(): React.JSX.Element | null {
  const { data: state } = useProfileState()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { token } = theme.useToken()

  const proposal = state?.proposal
  // Na própria tela de Configuração, o cartão da proposta já está à vista.
  if (!proposal || pathname === '/configuracao') return null

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
      <Flex align="center" gap={10} wrap style={{ minWidth: 0 }}>
        <RobotOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
        <Text strong>
          {proposal.ok ? t('proposal.bannerTitle') : t('proposal.bannerInvalidTitle')}
        </Text>
        <Text type="secondary">
          {t('proposal.bannerWhen', { when: formatDateTime(proposal.updatedAt) })}
        </Text>
      </Flex>
      <Button size="small" type="primary" onClick={() => navigate('/configuracao')}>
        {t('proposal.review')}
      </Button>
    </Flex>
  )
}
