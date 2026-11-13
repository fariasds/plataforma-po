import { presetPalettes } from '@ant-design/colors'
import type { Configuration } from '@shared/config/schema'

export const BUG_RED = '#CC293D'
export const BUG_RED_DIM = '#CC293D40'
export const RECURRENCE_ORANGE = '#F2891A'

/** Cor do que não tem nível: criticidade não informada ou fora de `criticality[]`. */
export const UNCLASSIFIED_COLOR = '#94A3B8'

/**
 * Tons do mais para o menos grave, pela posição do nível em `criticality[]`
 * (RN-BUG-05). Só vale quando o nível não traz `color` na Configuração.
 */
const SEVERITY_RAMP = [
  presetPalettes.red[6],
  presetPalettes.orange[6],
  presetPalettes.gold[6],
  presetPalettes.blue[6],
  presetPalettes.green[6],
  presetPalettes.cyan[6]
]

/**
 * Cores dos estados pela posição no `bugStateOrder` (RN-BUG-13). Estado fora da
 * ordem segue depois dela, na ordem em que aparece.
 */
const STATE_RAMP = [
  presetPalettes.grey[6],
  presetPalettes.geekblue[6],
  presetPalettes.volcano[6],
  presetPalettes.gold[7],
  presetPalettes.purple[5],
  presetPalettes.cyan[7],
  presetPalettes.magenta[6],
  presetPalettes.lime[7],
  presetPalettes.green[7],
  presetPalettes.blue[4]
]

type CriticalityLevel = Configuration['criticality'][number]

/** Nível do valor do campo pelo prefixo em `matches`, sem diferenciar maiúsculas. */
function levelIndex(value: string, levels: readonly CriticalityLevel[]): number {
  const lower = value.toLowerCase()
  return levels.findIndex((l) => l.matches.some((m) => lower.startsWith(m.toLowerCase())))
}

/** Cor de um valor de criticidade (ex.: "Alta SLA - 16h"), montada a partir da Configuração. */
export function getCriticalityColor(value: string, levels: readonly CriticalityLevel[]): string {
  const index = levelIndex(value, levels)
  if (index < 0) return UNCLASSIFIED_COLOR
  return levels[index].color ?? SEVERITY_RAMP[index % SEVERITY_RAMP.length]
}

/** Cor de cada estado, pela posição na ordem do fluxo. */
export function stateColors(
  stateOrder: readonly string[],
  states: readonly string[]
): Map<string, string> {
  const ordered = [...stateOrder, ...states.filter((s) => !stateOrder.includes(s))]
  return new Map(ordered.map((state, i) => [state, STATE_RAMP[i % STATE_RAMP.length]]))
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}
