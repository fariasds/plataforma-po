import { theme } from 'antd'
import type { DailyItem, DailyRisk, DailyStatus } from '@shared/dashboards'
import { NEUTRA, STATUS } from '../../theme'

export interface RiskPalette {
  /** Trecho já consumido. */
  consumed: string
  /** Trecho que a estimativa ainda prevê. */
  remaining: string
  /** Cor do rótulo ao lado da barra. */
  label: string
}

/** Tons de destaque da Configuração, lidos do tema em uso. */
export interface AccentTones {
  /** A própria cor de destaque. */
  base: string
  /** Fundo claríssimo, para o item ativo. */
  bg: string
  /** Fundo claro, para o trecho restante da barra. */
  soft: string
  /** Borda do item ativo. */
  border: string
}

export function useAccent(): AccentTones {
  const { token } = theme.useToken()
  return {
    base: token.colorPrimary,
    bg: token.colorPrimaryBg,
    soft: token.colorPrimaryBgHover,
    border: token.colorPrimaryBorder
  }
}

/**
 * Cor por situação. Vermelho é constatação — já passou do estimado. Âmbar é
 * projeção — ainda vai passar. Cinza é ausência de dado, e não julgamento.
 *
 * O item que só aguarda teste (`awaiting-test`) recebe a paleta do "no limite":
 * destaque no consumido, âmbar no restante. O destaque diz "vai entregar"; o
 * âmbar preservado evita fingir que não há aperto nenhum (RN-DLY-19).
 */
export function useRiskColors(): Record<DailyRisk, RiskPalette> {
  const accent = useAccent()
  const atLimit = { consumed: accent.base, remaining: '#FDE9C8', label: '#B45309' }
  return {
    'on-track': { consumed: accent.base, remaining: accent.soft, label: NEUTRA[600] },
    'at-limit': atLimit,
    'awaiting-test': atLimit,
    'over-sprint': { consumed: '#F59E0B', remaining: '#FDE9C8', label: '#B45309' },
    'over-estimate': { consumed: '#CC293D', remaining: '#F8C9CF', label: '#B91C1C' },
    unknown: { consumed: NEUTRA[300], remaining: NEUTRA[200], label: NEUTRA[500] }
  }
}

/**
 * Como o item é lido pela legenda, que também é o filtro (RN-DLY-20).
 *
 * `awaiting-test` conta como "termina dentro da sprint": a projeção fura, mas o
 * desenvolvimento já terminou e o item só aguarda validação. Tratar isso como
 * estouro daria um alarme que a realidade desmente quase sempre.
 */
export type RiskGroup = 'optimistic' | 'over-sprint' | 'over-estimate' | 'unknown'

export function groupOf(item: DailyItem): RiskGroup {
  switch (item.risk) {
    case 'on-track':
    case 'at-limit':
    case 'awaiting-test':
      return 'optimistic'
    case 'over-sprint':
      return 'over-sprint'
    case 'over-estimate':
      return 'over-estimate'
    default:
      return 'unknown'
  }
}

/**
 * Feriado na régua. Ocupa a casa como qualquer outro dia, mas não entrega
 * trabalho — por isso é neutro-escuro e não uma cor de risco: não é problema do
 * item, é um dia que a sprint não tem.
 */
export const HOLIDAY = {
  fill: NEUTRA[200],
  text: NEUTRA[600],
  /** Hachura sobre a faixa, para a coluna morta se ler por trás das barras. */
  stripe: `repeating-linear-gradient(
    45deg,
    ${NEUTRA[200]} 0px,
    ${NEUTRA[200]} 3px,
    transparent 3px,
    transparent 7px
  )`
} as const

/** Marca do dia de hoje na régua: a mesma cor na faixa e na legenda. */
export const TODAY_MARKER = '#CC293D'

/** Cor do marcador de cada bloco; `null` usa o destaque do tema. */
export const BLOCKS: Array<{
  status: DailyStatus
  title: string
  hint: string
  dot: string | null
}> = [
  {
    status: 'in-progress',
    title: 'Em andamento',
    hint: 'do início do desenvolvimento até hoje',
    dot: null
  },
  {
    status: 'not-started',
    title: 'Não iniciados',
    hint: 'projeção a partir de hoje',
    dot: NEUTRA[300]
  },
  {
    status: 'done',
    title: 'Concluídos',
    hint: 'real contra estimado',
    dot: STATUS.ok.solid
  }
]
