import { useState } from 'react'
import { Button, Flex, Typography, theme } from 'antd'
import { CloseOutlined, CloudDownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { useOpenUpdateLink, useUpdateCheck } from '../ipc/useUpdate'
import { t } from '../i18n'
import { MONO_FONT } from '../theme'

const { Text } = Typography

/**
 * Faixa de versão nova (RN-GLB-18), presa ao topo com o cabeçalho. Fundo neutro:
 * não é alerta nem situação, e o destaque fica só no botão de baixar, que é a
 * ação principal. O app não baixa nada: o botão abre o instalador no navegador
 * (ADR 0008).
 */
export function UpdateBanner(): React.JSX.Element | null {
  const check = useUpdateCheck()
  const open = useOpenUpdateLink()
  const [dismissed, setDismissed] = useState(false)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const { token } = theme.useToken()

  if (dismissed || check?.status !== 'available') return null

  const version = (value: string): React.JSX.Element => (
    <span style={{ fontFamily: MONO_FONT }}>{value}</span>
  )

  return (
    <Flex
      role="status"
      align="center"
      justify="space-between"
      gap={12}
      wrap
      style={{
        padding: '8px 32px',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorder}`
      }}
    >
      <Flex align="center" gap={10} wrap style={{ minWidth: 0 }}>
        <CloudDownloadOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
        <Text strong>
          {t('update.title')} {version(check.latest)}
        </Text>
        <Text type="secondary">
          {downloadStarted ? (
            t('update.afterDownload')
          ) : (
            <>
              {t('update.installed')} {version(check.installed)}
            </>
          )}
        </Text>
      </Flex>
      <Flex align="center" gap={8}>
        {open.isError && <Text type="danger">{open.error.message}</Text>}
        <Button size="small" icon={<FileTextOutlined />} onClick={() => open.mutate('release')}>
          {t('update.releaseNotes')}
        </Button>
        {check.hasInstaller && (
          <Button
            size="small"
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={open.isPending && open.variables === 'installer'}
            onClick={() => open.mutate('installer', { onSuccess: () => setDownloadStarted(true) })}
          >
            {t('update.download', { version: check.latest })}
          </Button>
        )}
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          aria-label={t('update.dismiss')}
          title={t('update.dismiss')}
          onClick={() => setDismissed(true)}
        />
      </Flex>
    </Flex>
  )
}
