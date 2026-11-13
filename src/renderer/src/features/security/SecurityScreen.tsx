import { Card, Flex, Tag, Typography, theme } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import { t } from '../../i18n'
import { MONO_FONT } from '../../theme'
import { GUARANTEES, LIMITS, VERIFY_HASH_COMMAND, VERIFY_TESTS_COMMAND } from './guarantees'

const { Paragraph, Text, Title } = Typography

/**
 * O que o app promete sobre o token e os dados, com a prova de cada promessa.
 * A tela não roda teste nenhum: aponta para a regra, para o teste e para o
 * jeito de conferir de fora, que é o que dá valor à promessa.
 */
export function SecurityScreen(): React.JSX.Element {
  const { token } = theme.useToken()

  const command = (text: string): React.ReactNode => (
    <Text
      code
      copyable={{ text, tooltips: [t('security.copy'), t('security.copied')] }}
      style={{ fontFamily: MONO_FONT }}
    >
      {text}
    </Text>
  )

  return (
    <Flex vertical gap={20} style={{ maxWidth: 1180 }}>
      <Card>
        <Flex gap={16} align="flex-start">
          <SafetyCertificateOutlined
            aria-hidden
            style={{ fontSize: 28, color: token.colorPrimary, marginTop: 2 }}
          />
          <Flex vertical gap={4} style={{ flex: 1 }}>
            <Flex align="center" justify="space-between" gap={12} wrap>
              <Title level={2} style={{ margin: 0, fontSize: 18 }}>
                {t('security.introTitle')}
              </Title>
              <Tag bordered={false} style={{ fontFamily: MONO_FONT, marginInlineEnd: 0 }}>
                {t('security.installedVersion')} {__APP_VERSION__}
              </Tag>
            </Flex>
            <Paragraph style={{ margin: 0 }}>{t('security.intro')}</Paragraph>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t('security.introMore')}
            </Paragraph>
          </Flex>
        </Flex>
      </Card>

      <Card title={t('security.guaranteesTitle')}>
        <Flex vertical>
          {GUARANTEES.map((guarantee, index) => (
            <Flex
              key={guarantee.key}
              gap={24}
              justify="space-between"
              wrap
              style={{
                padding: '14px 0',
                borderTop: index === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`
              }}
            >
              <Flex vertical gap={2} style={{ flex: '1 1 420px', minWidth: 0 }}>
                <Text strong>{t(`security.guarantees.${guarantee.key}.title`)}</Text>
                <Text type="secondary">{t(`security.guarantees.${guarantee.key}.detail`)}</Text>
              </Flex>
              <Flex vertical gap={4} align="flex-end" style={{ flex: '0 1 380px', minWidth: 0 }}>
                <Flex gap={4} wrap justify="flex-end">
                  {guarantee.rules.map((rule) => (
                    <Tag
                      key={rule}
                      bordered={false}
                      style={{ fontFamily: MONO_FONT, marginInlineEnd: 0 }}
                    >
                      {rule}
                    </Tag>
                  ))}
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('security.proof')}
                </Text>
                {guarantee.proof.map((path) => (
                  <Text
                    key={path}
                    type="secondary"
                    style={{ fontFamily: MONO_FONT, fontSize: 12, textAlign: 'right' }}
                  >
                    {path}
                  </Text>
                ))}
              </Flex>
            </Flex>
          ))}
        </Flex>
      </Card>

      <Card title={t('security.verifyTitle')}>
        <Flex vertical gap={12}>
          <Paragraph style={{ margin: 0 }}>{t('security.verifyInstaller')}</Paragraph>
          {command(VERIFY_HASH_COMMAND.replace('{version}', __APP_VERSION__))}
          <Paragraph style={{ margin: 0 }}>{t('security.verifyProvenance')}</Paragraph>
          <Paragraph style={{ margin: 0 }}>{t('security.verifyTests')}</Paragraph>
          {command(VERIFY_TESTS_COMMAND)}
        </Flex>
      </Card>

      <Card title={t('security.limitsTitle')}>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          {LIMITS.map((limit) => (
            <li key={limit} style={{ marginBottom: 8 }}>
              <Text>{t(`security.limits.${limit}`)}</Text>
            </li>
          ))}
        </ul>
      </Card>
    </Flex>
  )
}
