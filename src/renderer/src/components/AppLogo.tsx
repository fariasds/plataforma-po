import { Flex, theme } from 'antd'
import { APP_NAME } from '@shared/app-info'
import { BRAND_SPARK } from '../theme'

/**
 * Símbolo "Prioridade": um backlog ordenado, com o ponto de foco no item do topo.
 *
 * Abaixo de 28 px o ponto vira ruído, então o desenho troca para barras mais
 * grossas e sem ponto — a mesma geometria do favicon.
 */
export function AppMark({
  size = 32,
  color
}: {
  size?: number
  /** Fundo do símbolo; sem ele, a cor de destaque do tema. */
  color?: string
}): React.JSX.Element {
  const { token } = theme.useToken()
  const fill = color ?? token.colorPrimary
  const compact = size < 28

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <rect width="48" height="48" rx={compact ? 11 : 12} fill={fill} />
      {compact ? (
        <>
          <rect x="10" y="11" width="22" height="7" rx="3.5" fill="#FFFFFF" />
          <rect x="10" y="21" width="17" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.72" />
          <rect x="10" y="31" width="11" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.45" />
        </>
      ) : (
        <>
          <rect x="11" y="12.5" width="20" height="5.5" rx="2.75" fill="#FFFFFF" />
          <circle cx="35.5" cy="15.25" r="2.9" fill={BRAND_SPARK} />
          <rect
            x="11"
            y="21.25"
            width="16"
            height="5.5"
            rx="2.75"
            fill="#FFFFFF"
            fillOpacity="0.72"
          />
          <rect x="11" y="30" width="10" height="5.5" rx="2.75" fill="#FFFFFF" fillOpacity="0.45" />
        </>
      )}
    </svg>
  )
}

/**
 * Símbolo e nome lado a lado. "PO" vai em negrito: é a palavra que diz para quem
 * o app é.
 */
export function AppLogo({
  size = 30,
  fontSize = 15,
  onDark = false
}: {
  size?: number
  fontSize?: number
  /** Sobre a moldura escura o nome fica branco. */
  onDark?: boolean
}): React.JSX.Element {
  const { token } = theme.useToken()
  const [lead, last] = splitName(APP_NAME)

  return (
    <Flex align="center" gap={10} role="img" aria-label={APP_NAME}>
      <AppMark size={size} />
      <span
        aria-hidden="true"
        style={{
          fontSize,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          color: onDark ? '#FFFFFF' : token.colorText
        }}
      >
        {lead} <span style={{ fontWeight: 700 }}>{last}</span>
      </span>
    </Flex>
  )
}

/** "Plataforma do PO" → ["Plataforma do", "PO"]. */
function splitName(name: string): [string, string] {
  const index = name.lastIndexOf(' ')
  return index < 0 ? ['', name] : [name.slice(0, index), name.slice(index + 1)]
}
