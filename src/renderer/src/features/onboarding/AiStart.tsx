import { useState } from 'react'
import { Alert, Button, Flex, Form, Input, Typography } from 'antd'
import { PatField, PatInstructions } from '../../auth/PatSetupScreen'
import { useCreateProfile } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { parseOrganizationInput } from './organization'

const { Title, Paragraph } = Typography

/** Onde a primeira execução termina quando o PO escolhe configurar com a IA. */
export const CONNECT_AI_HASH = '#/configuracao/conectar-ia'

/**
 * Quarta porta da primeira execução (RN-CFG-13): o Perfil nasce como em qualquer
 * outra, com a organização e o token, sem nenhum Produto. Depois, a tela "Conectar
 * à sua IA" mostra o que colar na IA, e a IA propõe a Configuração (RN-CFG-12).
 */
export function AiStart({
  profileExists,
  onFinished,
  onCancel
}: {
  profileExists: boolean
  onFinished: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [organizationText, setOrganizationText] = useState('')
  const createProfile = useCreateProfile()
  const typed = parseOrganizationInput(organizationText)
  const organization = typed.ok ? typed.organization : null

  const finish = (): void => {
    // O roteador ainda não está montado: ele lê o endereço ao entrar no app.
    window.location.hash = CONNECT_AI_HASH
    onFinished()
  }

  const submit = async (pat: string): Promise<void> => {
    if (!organization) return
    try {
      await createProfile.mutateAsync({ name: organization, organization, pat })
      finish()
    } catch {
      // O erro já está na mutação e aparece abaixo.
    }
  }

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          {t('onboarding.ai.title')}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('onboarding.ai.intro')}
        </Paragraph>
      </div>

      {profileExists ? (
        <div>
          <Button type="primary" onClick={finish}>
            {t('onboarding.ai.continue')}
          </Button>
        </div>
      ) : (
        <>
          <Form.Item
            label={t('onboarding.organization.label')}
            validateStatus={organizationText && !typed.ok ? 'error' : undefined}
            help={organizationText && !typed.ok ? typed.message : undefined}
            style={{ marginBottom: 0 }}
          >
            <Input
              autoFocus
              value={organizationText}
              placeholder={t('onboarding.organization.placeholder')}
              onChange={(event) => setOrganizationText(event.target.value)}
            />
          </Form.Item>
          <PatInstructions organization={organization ?? undefined} />
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={(values: { pat: string }) => void submit(values.pat)}
          >
            <PatField />
            <Button
              type="primary"
              htmlType="submit"
              loading={createProfile.isPending}
              disabled={!organization}
            >
              {t('onboarding.ai.validateAndContinue')}
            </Button>
          </Form>
        </>
      )}

      {createProfile.error && (
        <Alert
          type="error"
          showIcon
          title={t('onboarding.import.failed')}
          description={createProfile.error.message}
        />
      )}

      <div>
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={onCancel}
          disabled={createProfile.isPending}
        >
          {t('actions.backToStart')}
        </Button>
      </div>
    </Flex>
  )
}
