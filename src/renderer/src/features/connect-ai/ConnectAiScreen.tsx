import { useState } from 'react'
import { Alert, Button, Card, Flex, Segmented, Typography, theme } from 'antd'
import { ImportOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { MCP_CLIENTS, clientSnippet, type McpClient } from '@shared/mcp-clients'
import { ErrorState } from '../../components/ErrorState'
import { useMcpLaunch } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { MONO_FONT, NEUTRA, STATUS } from '../../theme'

const { Paragraph, Text, Title } = Typography

/** Um passo numerado: o número é a ordem em que o PO faz, não enfeite. */
function Step({
  number,
  title,
  children
}: {
  number: number
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  const { token } = theme.useToken()
  return (
    <Flex gap={14} align="flex-start">
      <span
        style={{
          flex: '0 0 26px',
          height: 26,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 13,
          background: token.colorPrimaryBg,
          color: token.colorPrimary
        }}
      >
        {number}
      </span>
      <Flex vertical gap={8} style={{ minWidth: 0, flex: 1 }}>
        <Text strong style={{ fontSize: 15 }}>
          {title}
        </Text>
        {children}
      </Flex>
    </Flex>
  )
}

/**
 * Conectar a IA do PO ao app pelo servidor MCP (RN-CFG-13, ADR 0010). A tela só
 * mostra o trecho pronto, com o caminho do executável e o Perfil: quem cola na IA
 * é o PO. O app não mexe na configuração da IA de ninguém.
 */
export function ConnectAiScreen(): React.JSX.Element {
  const launch = useMcpLaunch()
  const navigate = useNavigate()
  const [client, setClient] = useState<McpClient>('claude-desktop')

  if (launch.isError) {
    return <ErrorState title={t('connectAi.loadFailed')} error={launch.error} />
  }

  const snippet = launch.data ? clientSnippet(client, launch.data) : null

  return (
    <Flex vertical gap={20} style={{ maxWidth: 900 }}>
      <Paragraph type="secondary" style={{ margin: 0, fontSize: 15 }}>
        {t('connectAi.intro')}
      </Paragraph>

      <Card>
        <Flex vertical gap={24}>
          <Step number={1} title={t('connectAi.chooseTitle')}>
            <Segmented<McpClient>
              value={client}
              onChange={setClient}
              options={MCP_CLIENTS.map((value) => ({
                value,
                label: t(`connectAi.clients.${value}.label`)
              }))}
            />
          </Step>

          <Step number={2} title={t('connectAi.pasteTitle')}>
            {client === 'other' ? (
              <Flex vertical gap={10}>
                <Alert type="info" showIcon title={t('connectAi.clients.other.where')} />
                <Flex gap={8} wrap>
                  <Button
                    icon={<RocketOutlined />}
                    onClick={() => navigate('/configuracao/assistente')}
                  >
                    {t('connectAi.openWizard')}
                  </Button>
                  <Button icon={<ImportOutlined />} onClick={() => navigate('/configuracao')}>
                    {t('settings.importConfig')}
                  </Button>
                </Flex>
              </Flex>
            ) : (
              <Flex vertical gap={8}>
                <Text type="secondary">{tRich(`connectAi.clients.${client}.where`)}</Text>
                <div
                  style={{
                    background: NEUTRA[800],
                    borderRadius: 8,
                    padding: '12px 14px',
                    overflowX: 'auto'
                  }}
                >
                  <Paragraph
                    copyable={
                      snippet
                        ? { text: snippet, tooltips: [t('connectAi.copy'), t('connectAi.copied')] }
                        : false
                    }
                    style={{
                      margin: 0,
                      fontFamily: MONO_FONT,
                      fontSize: 12.5,
                      whiteSpace: 'pre',
                      color: NEUTRA[100]
                    }}
                  >
                    {snippet ?? t('connectAi.loading')}
                  </Paragraph>
                </div>
                {client === 'claude-desktop' && (
                  <Text type="secondary">{t('connectAi.mergeHint')}</Text>
                )}
              </Flex>
            )}
          </Step>

          {client !== 'other' && (
            <Step number={3} title={t('connectAi.askTitle')}>
              <Text>{tRich('connectAi.askText')}</Text>
            </Step>
          )}
        </Flex>
      </Card>

      <Card>
        <Flex gap={12} align="flex-start">
          <LockOutlined style={{ color: STATUS.ok.solid, fontSize: 18, marginTop: 3 }} />
          <Flex vertical gap={4}>
            <Title level={5} style={{ margin: 0 }}>
              {t('connectAi.safetyTitle')}
            </Title>
            <Text type="secondary">{t('connectAi.safetyText')}</Text>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  )
}
