import type { ThemeConfig } from 'antd'
import { generate, presetPalettes } from '@ant-design/colors'
import { WINDOW_BACKGROUND } from '@shared/app-info'

/**
 * Tema neutro: cinzas frios e **uma** cor de destaque, que o PO escolhe na
 * Configuração (`appearance.accentColor`).
 *
 * Regra: cor, raio, sombra e densidade saem daqui — não de estilo solto nos
 * componentes. Se algo parece precisar de CSS inline, quase sempre falta um token.
 */

/** Destaque padrão, usado enquanto a Configuração não escolhe outro. */
export const DEFAULT_ACCENT = '#4F46E5'

/**
 * Rampa de 10 tons no algoritmo do Ant Design: índice 0 é o mais claro, 5 é a
 * própria cor, 9 o mais escuro. Assim qualquer destaque ganha hover, fundo e
 * anel de foco coerentes sem ninguém escolher tom a tom.
 */
export function accentRamp(accentColor: string = DEFAULT_ACCENT): string[] {
  return generate(accentColor)
}

const ACCENT = accentRamp()

/**
 * Cinzas frios. O 50 é o fundo da janela, compartilhado com o main. Do 500 para
 * cima o texto passa 4.5:1 sobre branco — é o mínimo para texto secundário.
 */
export const NEUTRA = {
  50: WINDOW_BACKGROUND,
  75: '#F7F8FA',
  100: '#EEF0F3',
  200: '#E4E7EC',
  300: '#C4C9D0',
  400: '#9AA1AE',
  500: '#5B6272',
  600: '#4A5163',
  800: '#171A23'
} as const

/**
 * Moldura escura do menu lateral ("tinta"): o destaque e a cor de cada Produto
 * são as únicas cores que aparecem nela.
 */
export const SIDER = {
  bg: '#12141B',
  text: '#C3C8D2',
  textStrong: '#FFFFFF',
  /** Rótulo de grupo ("Review"); passa 4.5:1 sobre o fundo. */
  label: '#7D8494',
  subtle: '#9097A6',
  hoverBg: 'rgba(255, 255, 255, 0.06)',
  activeBg: 'rgba(255, 255, 255, 0.09)',
  cardBg: 'rgba(255, 255, 255, 0.05)'
} as const

/** Faísca da marca: o ponto de foco do logo. Só no logo — não é cor de interface. */
export const BRAND_SPARK = '#FF8A5B'

/**
 * Situações que a interface comunica, cada uma em três tons: o sólido (barra,
 * ponto), o fundo suave da etiqueta e o texto que lê sobre esse fundo.
 * Verde é dentro, âmbar é projeção, vermelho é constatação, cinza é sem dado.
 */
export const STATUS = {
  ok: { solid: '#16A34A', bg: '#ECFDF3', text: '#166534' },
  warning: { solid: '#F59E0B', bg: '#FFF7E6', text: '#92400E' },
  danger: { solid: '#DC2640', bg: '#FEF1F2', text: '#9F1239' },
  info: { solid: '#2563EB', bg: '#EAF2FF', text: '#1D4ED8' },
  neutral: { solid: NEUTRA[400], bg: '#F1F2F5', text: NEUTRA[600] }
} as const

export type StatusKey = keyof typeof STATUS

/** Cor de cada disciplina do Planning; é a mesma no indicador e na capacidade. */
export const DISCIPLINE_COLORS = {
  frontend: '#0284C7',
  backend: '#7C3AED',
  qa: '#059669'
} as const

const SIDER_BG = SIDER.bg

/**
 * Cores do avatar sem foto, tiradas das paletas prontas do Ant Design. O tom 6
 * aguenta texto branco. O destaque entra primeiro, para a paleta conversar com o
 * resto da tela.
 */
export const AVATAR_COLORS = [
  ACCENT[6],
  presetPalettes.geekblue[6],
  presetPalettes.magenta[6],
  presetPalettes.volcano[6],
  presetPalettes.green[6],
  presetPalettes.cyan[6]
] as const

/** Cores derivadas da cor de um Produto ou Grupo, que vem da Configuração. */
export interface ProductColors {
  /** Fundo e texto do botão ativo no filtro e da etiqueta forte. */
  bg: string
  text: string
  /** Hover no filtro: tom claro da mesma cor. */
  hoverBg: string
  hoverText: string
  /** Etiqueta suave (ex.: nome da iteração ao lado do seletor de sprint). */
  softBg: string
  softText: string
  softBorder: string
}

/** Luminância relativa (WCAG) de uma cor "#RRGGBB". */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Cores de um Produto a partir de uma só, escolhida pelo PO. Cor clara (um
 * verde-limão, por exemplo) leva texto escuro: branco não teria contraste.
 */
export function productColors(color: string): ProductColors {
  const ramp = generate(color)
  const light = luminance(color) > 0.35
  return {
    bg: color,
    text: light ? ramp[9] : '#FFFFFF',
    hoverBg: ramp[0],
    hoverText: light ? ramp[7] : ramp[5],
    softBg: ramp[0],
    softText: ramp[7],
    softBorder: ramp[2]
  }
}

/**
 * Cores dos tipos de work item. Não são identidade do app — vêm do Azure DevOps e
 * valem só dentro de gráficos e tabelas de work item (RN-GLB-10).
 */
export const WORK_ITEM_COLORS = {
  bug: '#CC293D',
  pbi: '#009CCC',
  pbiDebt: '#009CCC',
  techDebt: '#009CCC',
  adHoc: '#F2CB1D',
  usability: '#FF007F'
} as const

export type WorkItemColorKey = keyof typeof WORK_ITEM_COLORS

const WORK_ITEM_TYPE_COLORS: Record<string, string> = {
  Bug: WORK_ITEM_COLORS.bug,
  'Product Backlog Item': WORK_ITEM_COLORS.pbi,
  'Débito de PBI': WORK_ITEM_COLORS.pbiDebt,
  'Tech Debt': WORK_ITEM_COLORS.techDebt,
  'Ad Hoc': WORK_ITEM_COLORS.adHoc,
  Usability: WORK_ITEM_COLORS.usability
}

const UNKNOWN_TYPE_COLOR = '#94A3B8'

export function workItemColor(type: string): string {
  return WORK_ITEM_TYPE_COLORS[type] ?? UNKNOWN_TYPE_COLOR
}

/** Ad Hoc é amarelo e precisa de texto escuro; os demais leem sobre branco. */
export function workItemTextColor(type: string): string {
  return type === 'Ad Hoc' ? '#1A1A1A' : '#FFFFFF'
}

// Geist vem embarcada (assets/fonts); a pilha de sistema cobre o instante do carregamento.
const FONT_STACK = [
  "'Geist'",
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  "'Segoe UI'",
  'Roboto',
  "'Helvetica Neue'",
  'Arial',
  'sans-serif'
].join(', ')

/** IDs, horas e datas: algarismos de largura fixa, que alinham em coluna. */
export const MONO_FONT = [
  "'Geist Mono'",
  'ui-monospace',
  "'Cascadia Mono'",
  'Consolas',
  'monospace'
].join(', ')

export const HEADER_HEIGHT = 72

/** Largura do menu lateral, com os nomes das seções visíveis. */
export const SIDER_WIDTH = 240

/** Menu lateral recolhido: só os ícones, com o nome no tooltip. */
export const SIDER_COLLAPSED_WIDTH = 72

/**
 * Cores que a moldura do app deriva do destaque. O ícone ativo do menu usa um tom
 * claro, porque o destaque puro some sobre a tinta.
 */
export function accentTones(accentColor: string = DEFAULT_ACCENT): {
  base: string
  soft: string
  softText: string
  onDark: string
} {
  const ramp = accentRamp(accentColor)
  return { base: ramp[5], soft: ramp[0], softText: ramp[7], onDark: ramp[2] }
}

export function buildTheme(accentColor: string = DEFAULT_ACCENT): ThemeConfig {
  const accent = accentRamp(accentColor)

  return {
    token: {
      colorPrimary: accent[5],
      colorInfo: accent[5],
      colorLink: accent[5],
      colorLinkHover: accent[4],
      colorSuccess: STATUS.ok.solid,
      colorWarning: STATUS.warning.solid,
      colorError: STATUS.danger.solid,

      colorText: NEUTRA[800],
      colorTextSecondary: NEUTRA[500],
      colorTextTertiary: NEUTRA[500],
      colorTextPlaceholder: NEUTRA[300],

      colorBgLayout: NEUTRA[50],
      colorBgContainer: '#FFFFFF',
      colorBorder: NEUTRA[200],
      colorBorderSecondary: NEUTRA[100],

      fontFamily: FONT_STACK,
      fontFamilyCode: MONO_FONT,
      fontSize: 14,
      borderRadius: 10,
      borderRadiusLG: 14,
      borderRadiusSM: 6,
      controlHeight: 36,
      wireframe: false,

      // Cards em repouso com sombra pequena: separa sem pesar.
      boxShadowTertiary: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },

    components: {
      Layout: {
        siderBg: SIDER_BG,
        headerBg: '#FFFFFF',
        bodyBg: NEUTRA[50],
        headerHeight: HEADER_HEIGHT,
        headerPadding: '0 24px'
      },

      // Menu do Sider roda em variante escura sobre o grafite.
      Menu: {
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        darkPopupBg: SIDER_BG,
        darkItemColor: 'rgba(255, 255, 255, 0.72)',
        darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
        darkItemHoverColor: '#FFFFFF',
        darkItemSelectedBg: accent[5],
        darkItemSelectedColor: '#FFFFFF'
      },

      Table: {
        headerBg: NEUTRA[75],
        headerColor: NEUTRA[500],
        headerSplitColor: 'transparent',
        // Hover no tom mais claro do destaque, no lugar do cinza genérico.
        rowHoverBg: accent[0],
        borderColor: NEUTRA[100],
        cellPaddingBlockSM: 10,
        cellPaddingInlineSM: 12
      },

      // O número é o assunto do card: grande e forte sobre um rótulo pequeno.
      Statistic: {
        contentFontSize: 40,
        titleFontSize: 13.5
      },

      // Borda visível em vez de sombra: separa sem pesar, como no restante da moldura.
      Card: {
        borderRadiusLG: 14,
        colorBorderSecondary: NEUTRA[200],
        headerFontSize: 15,
        headerHeight: 52
      },

      Tag: {
        defaultBg: STATUS.neutral.bg,
        defaultColor: STATUS.neutral.text
      },

      Progress: {
        remainingColor: NEUTRA[100]
      },

      Button: {
        fontWeight: 500,
        primaryShadow: 'none',
        defaultShadow: 'none'
      },

      // Anel de foco de 4px num tom claro do destaque.
      Input: {
        activeShadow: `0 0 0 4px ${accent[1]}`
      },

      Segmented: {
        trackBg: NEUTRA[100],
        itemSelectedBg: '#FFFFFF',
        itemSelectedColor: NEUTRA[800],
        itemColor: NEUTRA[600]
      }
    }
  }
}
