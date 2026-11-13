import { useEffect, useState } from 'react'
import { Dropdown, Flex, Layout, Tag, Tooltip, Typography, theme } from 'antd'
import {
  BugOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DownOutlined,
  FieldTimeOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { stepForPath } from '@shared/home'
import { recordVisit } from '../features/home/first-steps-storage'
import { useProfileState } from '../ipc/useProfile'
import { t } from '../i18n'
import { accentTones, MONO_FONT, SIDER, SIDER_COLLAPSED_WIDTH, SIDER_WIDTH } from '../theme'
import { AppLogo, AppMark } from './AppLogo'
import { DemoBanner } from './DemoBanner'
import { UserMenu } from './UserMenu'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

interface NavEntry {
  key: string
  icon: React.ReactNode
  label: string
  /** Rótulo do grupo, mostrado acima do título da tela. */
  group?: string
}

const HOME: NavEntry = { key: '/home', icon: <HomeOutlined />, label: t('nav.home') }

const MAIN: NavEntry[] = [
  HOME,
  { key: '/planning', icon: <CalendarOutlined />, label: t('nav.planning') },
  { key: '/daily', icon: <FieldTimeOutlined />, label: t('nav.daily') }
]

/**
 * "Desempenho da Equipe" e "Relatório IA" seguem fora do menu de propósito — as
 * telas e as rotas existem, então voltar é acrescentar a entrada aqui.
 */
const REVIEW: NavEntry[] = [
  {
    key: '/dashboard/sprint-delivery',
    icon: <CheckCircleOutlined />,
    label: t('nav.sprintDelivery'),
    group: t('nav.review')
  },
  {
    key: '/dashboard/bug-analysis',
    icon: <BugOutlined />,
    label: t('nav.bugAnalysis'),
    group: t('nav.review')
  }
]

const SETTINGS: NavEntry = {
  key: '/configuracao',
  icon: <SettingOutlined />,
  label: t('nav.settings')
}

/** Fica no pé, com a Configuração: não é tela de uso diário, é a que se consulta. */
const SECURITY: NavEntry = {
  key: '/seguranca',
  icon: <SafetyCertificateOutlined />,
  label: t('nav.security')
}

const ALL = [...MAIN, ...REVIEW, SETTINGS, SECURITY]

/**
 * Preferência de interface desta máquina, não do Perfil: é o tamanho da tela de
 * quem usa que decide, e não vale a pena levar isso para os Dados de trabalho.
 * Leitura e escrita protegidas — sem armazenamento, o menu só não lembra.
 */
const COLLAPSED_KEY = 'plataforma-po.menu-recolhido'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Sem armazenamento disponível: a escolha vale só para esta sessão.
  }
}

/** Visual comum dos itens do menu; muda só o que ativo e hover pedem. */
function itemStyle({
  active,
  hovered,
  collapsed,
  indent = false
}: {
  active: boolean
  hovered: boolean
  collapsed: boolean
  indent?: boolean
}): React.CSSProperties {
  return {
    font: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 12,
    width: '100%',
    height: 40,
    padding: collapsed ? 0 : indent ? '0 12px 0 42px' : '0 12px',
    border: 0,
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    color: active || hovered ? SIDER.textStrong : SIDER.text,
    background: active ? SIDER.activeBg : hovered ? SIDER.hoverBg : 'transparent',
    transition: 'background 0.15s, color 0.15s'
  }
}

function NavIcon({ icon, active }: { icon: React.ReactNode; active: boolean }): React.JSX.Element {
  const { token } = theme.useToken()
  return (
    <span
      style={{
        fontSize: 17,
        display: 'inline-flex',
        flex: 'none',
        color: active ? accentTones(token.colorPrimary).onDark : 'inherit'
      }}
    >
      {icon}
    </span>
  )
}

function NavItem({
  entry,
  active,
  collapsed,
  indent,
  onClick
}: {
  entry: NavEntry
  active: boolean
  collapsed: boolean
  /** Subitem de um grupo: recuado para alinhar o texto ao do grupo. */
  indent?: boolean
  onClick: () => void
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  const button = (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? entry.label : undefined}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={itemStyle({ active, hovered, collapsed, indent })}
    >
      {indent && !collapsed ? null : <NavIcon icon={entry.icon} active={active} />}
      {!collapsed && entry.label}
    </button>
  )

  // Recolhido, o nome aparece ao passar o mouse.
  return collapsed ? (
    <Tooltip title={entry.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  )
}

/**
 * Grupo com subitens ("Review"). Expandido, abre e fecha a lista abaixo dele;
 * recolhido, mostra os subitens num menu flutuante ao lado do ícone — abrir a
 * lista dentro de um trilho de 72 px não deixaria ler os nomes.
 */
function NavGroup({
  label,
  icon,
  entries,
  activeKey,
  collapsed,
  onNavigate
}: {
  label: string
  icon: React.ReactNode
  entries: NavEntry[]
  activeKey: string
  collapsed: boolean
  onNavigate: (key: string) => void
}): React.JSX.Element {
  const containsActive = entries.some((entry) => entry.key === activeKey)
  // Começa aberto quando a tela atual é dele: o PO vê onde está sem clicar.
  const [open, setOpen] = useState(containsActive)
  const [hovered, setHovered] = useState(false)
  const listId = 'nav-group-review'

  if (collapsed) {
    return (
      <Dropdown
        placement="bottomLeft"
        trigger={['hover', 'click']}
        menu={{
          selectedKeys: [activeKey],
          items: [
            { key: 'title', type: 'group', label },
            ...entries.map((entry) => ({ key: entry.key, icon: entry.icon, label: entry.label }))
          ],
          onClick: ({ key }) => onNavigate(key)
        }}
        align={{ points: ['tl', 'tr'], offset: [14, 0] }}
      >
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={itemStyle({ active: containsActive, hovered, collapsed })}
        >
          <NavIcon icon={icon} active={containsActive} />
        </button>
      </Dropdown>
    )
  }

  return (
    <Flex vertical gap={2}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // O grupo não é uma tela: com ela aberta, ele fica em destaque só no ícone.
        style={itemStyle({ active: false, hovered, collapsed })}
      >
        <NavIcon icon={icon} active={containsActive} />
        <span style={{ flex: 1, fontWeight: containsActive ? 600 : 500 }}>{label}</span>
        <DownOutlined
          aria-hidden="true"
          style={{
            fontSize: 11,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none'
          }}
        />
      </button>
      {open && (
        <Flex vertical gap={2} id={listId}>
          {entries.map((entry) => (
            <NavItem
              key={entry.key}
              entry={entry}
              indent
              active={entry.key === activeKey}
              collapsed={false}
              onClick={() => onNavigate(entry.key)}
            />
          ))}
        </Flex>
      )}
    </Flex>
  )
}

export function AppLayout(): React.JSX.Element {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const profileId = useProfileState().data?.profile?.id

  // Abrir a tela conclui o passo correspondente da lista da Home (RN-HOM-03).
  useEffect(() => {
    const step = stepForPath(pathname)
    if (step) recordVisit(profileId, step)
  }, [pathname, profileId])

  // Sem rota conhecida, a tela padrão é a Home (a raiz redireciona para ela, RN-HOM-01).
  const current = ALL.find((entry) => pathname.startsWith(entry.key)) ?? HOME
  const isActive = (entry: NavEntry): boolean => entry.key === current.key

  const toggle = (): void => {
    writeCollapsed(!collapsed)
    setCollapsed(!collapsed)
  }
  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        collapsed={collapsed}
        trigger={null}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <Flex
          vertical
          gap={28}
          style={{ height: '100%', padding: collapsed ? '20px 12px' : '20px 14px' }}
        >
          {/* O logo é o botão que recolhe e expande o menu. */}
          <Tooltip title={toggleLabel} placement="right">
            <button
              type="button"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={toggle}
              style={{
                font: 'inherit',
                display: 'flex',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
                padding: collapsed ? '4px 0' : '4px 8px',
                border: 0,
                borderRadius: 10,
                background: 'transparent',
                cursor: 'pointer',
                overflow: 'hidden'
              }}
            >
              {collapsed ? <AppMark size={32} /> : <AppLogo onDark />}
            </button>
          </Tooltip>

          <nav aria-label={t('nav.sections')}>
            <Flex vertical gap={2}>
              {MAIN.map((entry) => (
                <NavItem
                  key={entry.key}
                  entry={entry}
                  active={isActive(entry)}
                  collapsed={collapsed}
                  onClick={() => navigate(entry.key)}
                />
              ))}
              <NavGroup
                label={t('nav.review')}
                icon={<FundProjectionScreenOutlined />}
                entries={REVIEW}
                activeKey={current.key}
                collapsed={collapsed}
                onNavigate={navigate}
              />
            </Flex>
          </nav>

          <Flex vertical gap={8} style={{ marginTop: 'auto' }}>
            <NavItem
              entry={SETTINGS}
              active={isActive(SETTINGS)}
              collapsed={collapsed}
              onClick={() => navigate(SETTINGS.key)}
            />
            <NavItem
              entry={SECURITY}
              active={isActive(SECURITY)}
              collapsed={collapsed}
              onClick={() => navigate(SECURITY.key)}
            />
            <UserMenu collapsed={collapsed} />
          </Flex>
        </Flex>
      </Sider>

      <Layout>
        {/* A faixa da demonstração sobe junto com o cabeçalho: os dois ficam presos ao topo. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, flex: '0 0 auto' }}>
          <DemoBanner />
          <Header
            style={{
              borderBottom: `1px solid ${token.colorBorder}`,
              paddingInline: 32
            }}
          >
            <Flex align="center" justify="space-between" gap={12} style={{ height: '100%' }}>
              <Flex vertical justify="center" style={{ height: '100%' }}>
                {current.group && (
                  <Text type="secondary" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                    {current.group}
                  </Text>
                )}
                <Title
                  level={1}
                  style={{ margin: 0, fontSize: 24, lineHeight: 1.25, letterSpacing: '-0.02em' }}
                >
                  {current.label}
                </Title>
              </Flex>
              {/* A versão aparece só na Home, que é onde o PO olha o que mudou no app. */}
              {current === HOME && (
                <Tag
                  bordered={false}
                  style={{ fontFamily: MONO_FONT, marginInlineEnd: 0 }}
                  aria-label={t('home.versionLabel', { version: __APP_VERSION__ })}
                >
                  {t('home.version', { version: __APP_VERSION__ })}
                </Tag>
              )}
            </Flex>
          </Header>
        </div>

        <Content style={{ padding: '24px 32px 48px' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
