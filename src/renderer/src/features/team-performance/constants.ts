import { presetPalettes } from '@ant-design/colors'

/**
 * Cores por posição, para séries que vêm da Configuração (níveis de criticidade,
 * estados do bug): nenhum nome fica fixo aqui. O nível mais grave e o primeiro
 * estado pegam as primeiras cores.
 */
export const SERIES_PALETTE = [
  presetPalettes.red[6],
  presetPalettes.blue[6],
  presetPalettes.green[6],
  presetPalettes.gold[6],
  presetPalettes.purple[6],
  presetPalettes.cyan[6],
  presetPalettes.volcano[6],
  presetPalettes.geekblue[6],
  presetPalettes.magenta[6],
  presetPalettes.lime[7]
] as const

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length]
}

export const REWORK_BAR_COLOR = '#009CCC'
export const REWORK_LINE_COLOR = '#F2CB1D'
export const DEV_FOCUS_COLOR = '#EAB308'
export const REFERENCE_LINE_COLOR = presetPalettes.red[6]

/** Every chart on this screen plots the last 5 periods, most recent on the right. */
export const VISIBLE_PERIODS = 5
