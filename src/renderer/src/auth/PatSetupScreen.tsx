import type { ReactNode } from 'react'
import { Alert, Button, Card, Flex, Form, Input, Typography } from 'antd'
import { KeyOutlined } from '@ant-design/icons'
import { AppLogo } from '../components/AppLogo'
import { useActiveConfig } from '../ipc/useAzure'
import { useSavePat } from '../ipc/usePat'
import { t } from '../i18n'
import { tRich } from '../i18n/rich'

const { Title, Paragraph, Text } = Typography

export function SetupCard({
  children,
  width = 560
}: {
  children: ReactNode
  width?: number
}): React.JSX.Element {
  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={24}
      style={{ minHeight: '100vh', padding: 24 }}
    >
      <AppLogo size={36} fontSize={17} />
      <Card style={{ maxWidth: width, width: '100%' }}>{children}</Card>
    </Flex>
  )
}

/**
 * Como criar o PAT, com os escopos só de leitura — a mesma lista do README.
 *
 * O endereço da página de tokens aparece para **copiar**, não como link: antes
 * de o Perfil existir não há organização configurada, e a janela só abre links
 * da organização configurada (RN-SEC-21).
 */
export function PatInstructions({ organization }: { organization?: string }): React.JSX.Element {
  const tokensUrl = organization
    ? `https://dev.azure.com/${organization}/_usersSettings/tokens`
    : null

  return (
    <>
      <Paragraph type="secondary">{tRich('pat.intro')}</Paragraph>

      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            {tokensUrl
              ? tRich('pat.stepOpenUrl', {
                  url: (
                    <Text code copyable>
                      {tokensUrl}
                    </Text>
                  )
                })
              : tRich('pat.stepOpenMenu')}
          </li>
          <li>{tRich('pat.stepNewToken')}</li>
          <li>{tRich('pat.stepScopes')}</li>
          <li>{tRich('pat.stepGraph')}</li>
          <li>{tRich('pat.stepCopy')}</li>
        </ol>
      </Paragraph>
    </>
  )
}

export function PatField({ autoFocus }: { autoFocus?: boolean }): React.JSX.Element {
  return (
    <Form.Item
      label={t('pat.fieldLabel')}
      name="pat"
      rules={[{ required: true, message: t('pat.required') }]}
      extra={<Text type="secondary">{t('pat.validatedHint')}</Text>}
    >
      <Input.Password
        autoFocus={autoFocus}
        prefix={<KeyOutlined />}
        placeholder={t('pat.placeholder')}
      />
    </Form.Item>
  )
}

/**
 * The profile exists but has no PAT: collects the person's read-only PAT. The
 * main process validates it against Azure and stores it encrypted — it never
 * goes to any other server.
 */
export function PatSetupScreen(): React.JSX.Element {
  const savePat = useSavePat()
  const organization = useActiveConfig()?.organization

  return (
    <SetupCard>
      <Title level={4} style={{ marginBottom: 4 }}>
        {t('pat.setupTitle')}
      </Title>
      <PatInstructions organization={organization} />

      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={(values: { pat: string }) => savePat.mutate(values.pat)}
      >
        <PatField autoFocus />

        <Button type="primary" htmlType="submit" block loading={savePat.isPending}>
          {t('pat.saveAndContinue')}
        </Button>

        {savePat.isError && (
          <Alert
            type="error"
            showIcon
            title={t('pat.saveFailed')}
            description={savePat.error.message}
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </SetupCard>
  )
}
