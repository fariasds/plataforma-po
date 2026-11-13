import { Alert, Button, Card, Descriptions, Flex, Tag, Typography, theme } from 'antd'
import {
  ExportOutlined,
  FolderOpenOutlined,
  KeyOutlined,
  LockOutlined,
  RedoOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ErrorState } from '../../components/ErrorState'
import { useClearPat } from '../../ipc/usePat'
import { useOpenProfileFolder, useProfileState } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { MONO_FONT, NEUTRA, SIDER, STATUS } from '../../theme'
import { IssueList } from '../onboarding/IssueList'
import { exportConfiguration } from './exportConfig'

const { Paragraph, Text, Title } = Typography

/** O caminho vem do main com o separador do SO; o arquivo novo segue o mesmo. */
function inFolder(dir: string, file: string): string {
  const separator = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith(separator) ? dir + file : dir + separator + file
}

/**
 * A Configuração do Perfil ativo, e as portas para mudá-la: o assistente, o
 * arquivo (a pasta que o PO aponta para a IA dele) e a exportação.
 */
export function SettingsScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { data: state } = useProfileState()
  const openFolder = useOpenProfileFolder()
  const clearPat = useClearPat()
  const { token } = theme.useToken()

  const profile = state?.profile
  const config = state?.config
  if (!profile || !config) {
    return (
      <ErrorState
        title={t('settings.noProfileTitle')}
        error={new Error(t('settings.noProfileText'))}
      />
    )
  }

  const copyable = (text: string): React.ReactNode => (
    <Text code copyable={{ text, tooltips: [t('settings.copyPath'), t('settings.copied')] }}>
      {text}
    </Text>
  )

  return (
    <Flex vertical gap={20} style={{ maxWidth: 1180 }}>
      {state.errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={t('settings.diskErrors')}
          description={<IssueList issues={state.errors} />}
        />
      )}

      <Flex gap={20} wrap align="flex-start">
        <Card
          title={t('settings.profile')}
          style={{ flex: '2 1 520px', minWidth: 0 }}
          styles={{ body: { paddingBlock: 8 } }}
        >
          <Descriptions
            size="middle"
            column={1}
            styles={{ label: { width: 180, color: NEUTRA[500] } }}
            items={[
              { key: 'name', label: t('common.name'), children: profile.name },
              {
                key: 'org',
                label: t('common.organization'),
                children: <Text style={{ fontFamily: MONO_FONT }}>{config.organization}</Text>
              },
              {
                key: 'products',
                label: t('common.products'),
                children: config.products.length ? (
                  <Flex gap={8} wrap>
                    {config.products.map((p) => (
                      <Tag key={p.id} variant="outlined" style={{ marginInlineEnd: 0 }}>
                        <Flex align="center" gap={7}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: p.color
                            }}
                          />
                          {p.name}
                          <Text type="secondary" style={{ fontFamily: MONO_FONT, fontSize: 11.5 }}>
                            {p.id}
                          </Text>
                        </Flex>
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  t('settings.noProducts')
                )
              },
              {
                key: 'groups',
                label: t('common.groups'),
                children: config.groups.map((g) => g.name).join(', ') || '—'
              },
              {
                key: 'process',
                label: t('common.processProfiles'),
                children: Object.keys(config.processProfiles).join(', ')
              },
              {
                key: 'accent',
                label: t('settings.accentColor'),
                children: (
                  <Flex align="center" gap={10}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        background: token.colorPrimary
                      }}
                    />
                    <Text style={{ fontFamily: MONO_FONT }}>{token.colorPrimary}</Text>
                  </Flex>
                )
              },
              { key: 'dir', label: t('settings.folder'), children: copyable(profile.dir) }
            ]}
          />
        </Card>

        <Flex vertical gap={20} style={{ flex: '1 1 340px', minWidth: 0 }}>
          {/* A porta principal é o arquivo: é por ele que o PO (ou a IA dele) muda tudo. */}
          <Card style={{ background: SIDER.bg, borderColor: SIDER.bg }}>
            <Flex vertical gap={14}>
              <Title level={4} style={{ margin: 0, color: SIDER.textStrong, fontSize: 16 }}>
                {t('settings.editTitle')}
              </Title>
              <Paragraph style={{ margin: 0, color: SIDER.text }}>
                {tRich('settings.editIntro')}
              </Paragraph>
              <Paragraph style={{ margin: 0, color: SIDER.text }}>
                {tRich('settings.aiInstructions', {
                  path: copyable(inFolder(profile.dir, 'AGENTS.md'))
                })}
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<FolderOpenOutlined />}
                loading={openFolder.isPending}
                onClick={() => openFolder.mutate()}
              >
                {t('settings.openProfileFolder')}
              </Button>
              <Flex gap={8}>
                <Button
                  ghost
                  icon={<RedoOutlined />}
                  style={{ flex: 1 }}
                  onClick={() => navigate('/configuracao/assistente')}
                >
                  {t('settings.redoWizard')}
                </Button>
                <Button
                  ghost
                  icon={<ExportOutlined />}
                  style={{ flex: 1 }}
                  onClick={() => exportConfiguration(config)}
                >
                  {t('settings.exportConfig')}
                </Button>
              </Flex>
              {openFolder.isError && (
                <Alert type="error" showIcon title={openFolder.error.message} />
              )}
            </Flex>
          </Card>

          {/* A demonstração não tem token (RN-SEC-27). */}
          {profile.kind !== 'demo' && (
            <Card>
              <Flex vertical gap={12}>
                <Flex align="center" gap={12}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 17,
                      background: STATUS.ok.bg,
                      color: STATUS.ok.text
                    }}
                  >
                    <LockOutlined />
                  </span>
                  <Flex vertical>
                    <Text strong style={{ fontSize: 15 }}>
                      {t('settings.tokenTitle')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12.5 }}>
                      {t('settings.tokenText')}
                    </Text>
                  </Flex>
                </Flex>
                <div>
                  <Button
                    icon={<KeyOutlined />}
                    loading={clearPat.isPending}
                    onClick={() => clearPat.mutate()}
                  >
                    {t('userMenu.changeToken')}
                  </Button>
                </div>
              </Flex>
            </Card>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}
