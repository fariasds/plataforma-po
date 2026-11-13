import { useState } from 'react'
import { Alert, Button, Descriptions, Flex, Form, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration, type ConfigurationIssue } from '@shared/config/validate'
import { PatField, PatInstructions } from '../../auth/PatSetupScreen'
import { useCreateProfile, useImportConfig } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { IssueList } from './IssueList'

const { Title, Paragraph, Text } = Typography

/** O mesmo teto do main: arquivo maior nem é lido. */
const MAX_BYTES = 1024 * 1024

type Checked =
  { ok: true; text: string; config: Configuration } | { ok: false; issues: ConfigurationIssue[] }

/**
 * Checa o arquivo antes de pedir o token. A mensagem de JSON quebrado não
 * repete o texto: se houver um token colado no arquivo, ele não vai para a tela
 * (RN-CFG-05). O main valida de novo ao gravar.
 */
function check(text: string): Checked {
  if (new Blob([text]).size > MAX_BYTES) {
    return { ok: false, issues: [{ path: '', message: t('onboarding.import.tooBig') }] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return { ok: false, issues: [{ path: '', message: t('onboarding.import.invalidJson') }] }
  }
  const result = validateConfiguration(raw)
  return result.ok ? { ok: true, text, config: result.config } : result
}

/**
 * Segunda porta da primeira execução: uma Configuração pronta (de um colega ou
 * de outra máquina). Ela nunca traz o PAT, então o token é pedido aqui.
 */
export function ImportConfig({
  profileExists,
  onFinished,
  onCancel
}: {
  /** O Perfil já foi criado (numa tentativa anterior): só falta gravar o arquivo. */
  profileExists: boolean
  onFinished: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [refused, setRefused] = useState<ConfigurationIssue[] | null>(null)
  const createProfile = useCreateProfile()
  const importConfig = useImportConfig()
  const busy = createProfile.isPending || importConfig.isPending
  const failure = createProfile.error ?? importConfig.error

  const submit = async (pat: string | null): Promise<void> => {
    if (!checked?.ok) return
    setRefused(null)
    const organization = checked.config.organization
    try {
      if (pat !== null) await createProfile.mutateAsync({ name: organization, organization, pat })
      const result = await importConfig.mutateAsync(checked.text)
      if (result.saved) onFinished()
      else setRefused(result.issues)
    } catch {
      // O erro já está na mutação e aparece abaixo.
    }
  }

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          {t('onboarding.import.title')}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {tRich('onboarding.import.intro')}
        </Paragraph>
      </div>

      <div>
        <Upload
          accept=".json,application/json"
          maxCount={1}
          showUploadList={false}
          disabled={busy}
          beforeUpload={(file) => {
            setFileName(file.name)
            setRefused(null)
            void file.text().then((text) => setChecked(check(text)))
            // Nada sobe para lugar nenhum: o arquivo só é lido aqui.
            return false
          }}
        >
          <Button icon={<UploadOutlined />}>
            {fileName ? t('onboarding.import.chooseAnother') : t('onboarding.import.chooseFile')}
          </Button>
        </Upload>
        {fileName && (
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {fileName}
          </Text>
        )}
      </div>

      {checked && !checked.ok && (
        <Alert
          type="error"
          showIcon
          title={t('onboarding.import.hasErrors')}
          description={<IssueList issues={checked.issues} />}
        />
      )}

      {checked?.ok && (
        <>
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: 'org',
                label: t('common.organization'),
                children: checked.config.organization
              },
              {
                key: 'products',
                label: t('common.products'),
                children: checked.config.products.map((p) => p.name).join(', ') || '—'
              }
            ]}
          />
          {profileExists ? (
            <div>
              <Button type="primary" loading={busy} onClick={() => void submit(null)}>
                {t('onboarding.import.importAndEnter')}
              </Button>
            </div>
          ) : (
            <>
              <PatInstructions organization={checked.config.organization} />
              <Form
                layout="vertical"
                requiredMark={false}
                onFinish={(values: { pat: string }) => void submit(values.pat)}
              >
                <PatField autoFocus />
                <Button type="primary" htmlType="submit" loading={busy}>
                  {t('onboarding.import.validateAndEnter')}
                </Button>
              </Form>
            </>
          )}
        </>
      )}

      {failure && (
        <Alert
          type="error"
          showIcon
          title={t('onboarding.import.failed')}
          description={failure.message}
        />
      )}
      {refused && (
        <Alert
          type="error"
          showIcon
          title={t('onboarding.wizard.refused')}
          description={<IssueList issues={refused} />}
        />
      )}

      <div>
        <Button type="link" style={{ padding: 0 }} onClick={onCancel} disabled={busy}>
          {t('actions.backToStart')}
        </Button>
      </div>
    </Flex>
  )
}
