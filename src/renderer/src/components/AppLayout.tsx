import { useEffect, useState } from 'react'
import { Button, Dropdown, Flex, Layout, Tooltip, Typography, theme } from 'antd'
import {
  AuditOutlined,
  BookOutlined,
  BugOutlined,
  BulbOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DownOutlined,
  FieldTimeOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
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
import { RefreshButton } from './RefreshButton'
import { SquadTabs } from './SquadTabs'
import { ProposalBanner } from './ProposalBanner'
import { UpdateBanner } from './UpdateBanner'
import { UserMenu } from './UserMenu'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

interface NavEntry {
  key: string
  icon: React.ReactNode
  label: string
  /** Rótulo do grupo, mostrado acima do título da tela. */
  group?: string
  /** A tela lê o Azure e ganha o botão Atualizar no cabeçalho (RN-GLB-19). */
  refresh?: boolean
}

const HOME: NavEntry = { key: '/home', icon: <HomeOutlined />, label: t('nav.home') }

const MAIN: NavEntry[] = [
  HOME,
  { key: '/planning', icon: <CalendarOutlined />, label: t('nav.planning'), refresh: true },
  { key: '/daily', icon: <FieldTimeOutlined />, label: t('nav.daily'), refresh: true }
]

/** O fluxo do PO (docs/fluxo-po/): o trabalho do PO antes e depois da sprint. */
const FLOW: NavEntry[] = [
  {
    key: '/features',
    icon: <NodeIndexOutlined />,
    label: t('nav.features'),
    group: t('nav.flow'),
    refresh: true
  },
  {
    key: '/oportunidades',
    icon: <BulbOutlined />,
    label: t('nav.opportunities'),
    group: t('nav.flow'),
    refresh: true
  },
  {
    key: '/acompanhamento',
    icon: <AuditOutlined />,
    label: t('nav.followUp'),
    group: t('nav.flow'),
    refresh: true
  },
  {
    key: '/roadmap',
    icon: <ScheduleOutlined />,
    label: t('nav.roadmap'),
    group: t('nav.flow'),
    refresh: true
  },
  {
    key: '/catalogo',
    icon: <BookOutlined />,
    label: t('nav.catalog'),
    group: t('nav.flow')
  }
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
    group: t('nav.review'),
    refresh: true
  },
  {
    key: '/dashboard/bug-analysis',
    icon: <BugOutlined />,
    label: t('nav.bugAnalysis'),
    group: t('nav.review'),
    refresh: true
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

/**
 * Histórico de novidades (RN-HOM-05). Tem cabeçalho próprio, mas não entra no
 * menu: é consulta eventual, e chega-se a ele pela Home.
 */
const RELEASE_NOTES_ENTRY: NavEntry = {
  key: '/novidades',
  icon: null,
  label: t('nav.releaseNotes'),
  group: t('nav.home')
}

/**
 * Conectar a IA do PO (RN-CFG-13). Mora dentro da Configuração e não entra no
 * menu: chega-se pela tela de Configuração e pela primeira execução. Vem antes
 * de SETTINGS na busca, porque o caminho começa igual.
 */
const CONNECT_AI_ENTRY: NavEntry = {
  key: '/configuracao/conectar-ia',
  icon: null,
  label: t('nav.connectAi'),
  group: t('nav.settings')
}

const ALL = [...MAIN, ...FLOW, ...REVIEW, CONNECT_AI_ENTRY, SETTINGS, SECURITY, RELEASE_NOTES_ENTRY]

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
  const listId = `nav-group-${entries[0]?.key.replace(/\W+/g, '') ?? 'grupo'}`

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
                label={t('nav.flow')}
                icon={<PartitionOutlined />}
                entries={FLOW}
                activeKey={current.key}
                collapsed={collapsed}
                onNavigate={navigate}
              />
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
        {/* As faixas sobem junto com o cabeçalho: ficam todos presos ao topo. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, flex: '0 0 auto' }}>
          <UpdateBanner />
          <DemoBanner />
          <ProposalBanner />
          {/* A Home não mostra dado de Squad, então não tem abas (RN-GLB-17). */}
          {current !== HOME && <SquadTabs />}
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
              {/* A versão aparece só na Home, que é onde o PO olha o que mudou no app,
                  e abre o histórico de novidades (RN-HOM-05). */}
              {current === HOME && (
                <Button
                  size="small"
                  color="default"
                  variant="filled"
                  shape="round"
                  onClick={() => navigate(RELEASE_NOTES_ENTRY.key)}
                  style={{ fontFamily: MONO_FONT, fontSize: 12.5 }}
                  aria-label={t('releaseNotes.versionButton', { version: __APP_VERSION__ })}
                  title={t('releaseNotes.versionButton', { version: __APP_VERSION__ })}
                >
                  {t('home.version', { version: __APP_VERSION__ })}
                </Button>
              )}
              {current.refresh && <RefreshButton />}
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
