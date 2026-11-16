import { useState } from 'react'
import { Tooltip, theme } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useActiveConfig } from '../ipc/useAzure'
import { setActiveSquad, useActiveSquad } from '../ipc/useActiveSquad'
import { t, tPlural } from '../i18n'
import { MONO_FONT, NEUTRA } from '../theme'

/** Cor de Squad é opcional na Configuração; sem ela, um cinza neutro. */
const SQUAD_FALLBACK_COLOR = NEUTRA[500]

/** Raio do canto em que a aba ativa se funde com o cabeçalho. */
const CURVE = 10

/**
 * Abas de Squad no topo da janela (RN-GLB-17), como as de um navegador: a ativa
 * tem o fundo do cabeçalho e se funde com ele, as outras ficam no trilho. Vale
 * para todas as telas — trocar de menu não troca de Squad.
 *
 * Sem Squads na Configuração, não aparece nada e o app fica como sempre foi.
 */
export function SquadTabs(): React.JSX.Element | null {
  const config = useActiveConfig()
  const active = useActiveSquad()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [hovered, setHovered] = useState<string | null>(null)

  const squads = config?.squads ?? []
  if (squads.length === 0 || !active) return null
  const surface = token.colorBgContainer

  return (
    <div
      role="tablist"
      aria-label={t('squads.tabsLabel')}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        padding: '8px 24px 0',
        background: NEUTRA[200],
        overflowX: 'auto'
      }}
    >
      {squads.map((squad, i) => {
        const isActive = squad.id === active.id
        const isHovered = hovered === squad.id
        // O separador some ao lado da aba ativa, como num navegador.
        const showDivider = i > 0 && !isActive && squads[i - 1].id !== active.id
        return (
          <button
            key={squad.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveSquad(squad.id)}
            onMouseEnter={() => setHovered(squad.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              font: 'inherit',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              height: 38,
              minWidth: 170,
              maxWidth: 240,
              padding: '0 16px',
              border: 0,
              borderRadius: `${CURVE}px ${CURVE}px 0 0`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? NEUTRA[800] : NEUTRA[600],
              background: isActive ? surface : isHovered ? NEUTRA[100] : 'transparent',
              transition: 'background 0.15s'
            }}
          >
            {showDivider && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: -1,
                  top: 11,
                  height: 16,
                  width: 1,
                  background: NEUTRA[300]
                }}
              />
            )}
            {isActive && <TabCurve side="left" color={surface} />}
            {isActive && <TabCurve side="right" color={surface} />}
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flex: 'none',
                background: squad.color ?? SQUAD_FALLBACK_COLOR
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t('squads.tabLabel', { name: squad.name })}
            </span>
            <span
              style={{
                marginInlineStart: 'auto',
                fontFamily: MONO_FONT,
                fontSize: 11,
                fontWeight: 500,
                color: NEUTRA[500]
              }}
            >
              {tPlural('squads.productCount', squad.products.length)}
            </span>
          </button>
        )
      })}
      <Tooltip title={t('squads.create')}>
        <button
          type="button"
          aria-label={t('squads.create')}
          onClick={() => navigate('/configuracao')}
          style={{
            font: 'inherit',
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 28,
            margin: '0 0 5px 6px',
            border: 0,
            borderRadius: 8,
            cursor: 'pointer',
            color: NEUTRA[500],
            background: hovered === '+' ? NEUTRA[100] : 'transparent'
          }}
          onMouseEnter={() => setHovered('+')}
          onMouseLeave={() => setHovered(null)}
        >
          <PlusOutlined />
        </button>
      </Tooltip>
    </div>
  )
}

/** O canto côncavo que liga a aba ativa ao cabeçalho. */
function TabCurve({ side, color }: { side: 'left' | 'right'; color: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: 0,
        [side]: -CURVE,
        width: CURVE,
        height: CURVE,
        background: `radial-gradient(circle at ${side === 'left' ? '0' : '100%'} 0, transparent ${CURVE}px, ${color} ${CURVE + 0.5}px)`
      }}
    />
  )
}
