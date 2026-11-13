import { Avatar, Divider, Dropdown, Flex, Typography } from 'antd'
import { ExperimentOutlined, KeyOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useConfiguration, useCurrentUser } from '../ipc/useAzure'
import { useClearPat } from '../ipc/usePat'
import { useIsDemo, useStartDemo } from '../ipc/useProfile'
import { t } from '../i18n'
import { AVATAR_COLORS, SIDER } from '../theme'

const { Text } = Typography

/** Fallback avatar colour, picked from the identifier so the same person always
 *  gets the same colour instead of a new one each session. */
function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** "Daniel Farias" → "DF". */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "Daniel Farias" → "Daniel"; usa o primeiro nome, que é como se cumprimenta. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0]
}

/**
 * Cartão do dono do PAT no pé do menu lateral; abre as ações da conta.
 *
 * Nome e foto são os do **dono do PAT**, como o Azure DevOps o conhece
 * (`RN-SEC-16`). Não há login: o token é a única identidade que o app tem.
 *
 * Sem foto — ou sem o escopo Graph para buscá-la — nada quebra: a tela cai para
 * as iniciais; sem nome, para o ícone genérico.
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }): React.JSX.Element {
  const clearPat = useClearPat()
  const profile = useCurrentUser()
  const navigate = useNavigate()
  const { organization } = useConfiguration()
  // A demonstração não tem token para trocar (RN-SEC-27).
  const isDemo = useIsDemo()
  const startDemo = useStartDemo()

  const name = profile.data?.displayName ?? null
  const photo = profile.data?.avatar ?? null
  const seed = name ?? ''

  return (
    <Dropdown
      trigger={['click']}
      placement="topLeft"
      menu={{
        items: [
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: t('nav.settings'),
            onClick: () => navigate('/configuracao')
          },
          ...(isDemo
            ? []
            : [
                {
                  key: 'pat',
                  icon: <KeyOutlined />,
                  label: t('userMenu.changeToken'),
                  disabled: clearPat.isPending,
                  onClick: () => clearPat.mutate()
                },
                // Do Perfil real para a demonstração; a faixa traz de volta (RN-GLB-15).
                {
                  key: 'demo',
                  icon: <ExperimentOutlined />,
                  label: t('userMenu.exploreDemo'),
                  disabled: startDemo.isPending,
                  onClick: () => startDemo.mutate()
                }
              ])
        ]
      }}
      popupRender={(menu) => (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.14)',
            minWidth: 232,
            overflow: 'hidden'
          }}
        >
          <Flex align="center" gap={10} style={{ padding: '12px 14px' }}>
            <Avatar
              size={38}
              src={photo || undefined}
              icon={!name ? <UserOutlined /> : undefined}
              style={{ background: colorFor(seed), flex: 'none' }}
            >
              {name ? initialsFor(name) : null}
            </Avatar>
            <Flex vertical style={{ minWidth: 0 }}>
              <Text strong ellipsis>
                {name ? t('userMenu.helloName', { name: firstNameOf(name) }) : t('userMenu.hello')}
              </Text>
              {name && (
                <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                  {name}
                </Text>
              )}
            </Flex>
          </Flex>
          <Divider style={{ margin: 0 }} />
          {menu}
        </div>
      )}
    >
      <button
        type="button"
        aria-label={t('userMenu.open')}
        style={{
          font: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          width: '100%',
          padding: collapsed ? '8px 0' : 10,
          border: 0,
          borderRadius: 12,
          background: SIDER.cardBg,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <Avatar
          size={32}
          src={photo || undefined}
          icon={!name ? <UserOutlined /> : undefined}
          style={{ background: colorFor(seed), flex: 'none' }}
        >
          {name ? initialsFor(name) : null}
        </Avatar>
        {/* Recolhido, o menu lateral mostra só o avatar; nome e organização ficam no menu. */}
        {!collapsed && (
          <Flex vertical style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ fontSize: 13, color: SIDER.textStrong }}>
              {name ?? t('userMenu.hello')}
            </Text>
            <Text ellipsis style={{ fontSize: 12, color: SIDER.subtle }}>
              {organization}
            </Text>
          </Flex>
        )}
      </button>
    </Dropdown>
  )
}
