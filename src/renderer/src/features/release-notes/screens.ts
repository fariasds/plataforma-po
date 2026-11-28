import type { ReleaseNoteScreen } from '@shared/release-notes'
import { t } from '../../i18n'

/** A rota de cada tela que uma novidade pode abrir. O arquivo só escolhe a chave. */
export const SCREEN_ROUTE: Record<ReleaseNoteScreen, string> = {
  home: '/home',
  planning: '/planning',
  daily: '/daily',
  'sprint-delivery': '/dashboard/sprint-delivery',
  'bug-analysis': '/dashboard/bug-analysis',
  settings: '/configuracao',
  'connect-ai': '/configuracao/conectar-ia',
  security: '/seguranca',
  features: '/features',
  opportunities: '/oportunidades',
  'follow-up': '/acompanhamento',
  roadmap: '/roadmap',
  catalog: '/catalogo'
}

export function screenLabel(screen: ReleaseNoteScreen): string {
  switch (screen) {
    case 'home':
      return t('nav.home')
    case 'planning':
      return t('nav.planning')
    case 'daily':
      return t('nav.daily')
    case 'sprint-delivery':
      return t('nav.sprintDelivery')
    case 'bug-analysis':
      return t('nav.bugAnalysis')
    case 'settings':
      return t('nav.settings')
    case 'connect-ai':
      return t('nav.connectAi')
    case 'security':
      return t('nav.security')
    case 'features':
      return t('nav.features')
    case 'opportunities':
      return t('nav.opportunities')
    case 'follow-up':
      return t('nav.followUp')
    case 'roadmap':
      return t('nav.roadmap')
    case 'catalog':
      return t('nav.catalog')
  }
}

export const RELEASE_ROUTE = '/novidades'

/** "2026-11-20" → "20/11/2026". A data do arquivo é um dia, sem fuso. */
export function formatReleaseDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function versionLabel(version: string): string {
  return t('home.version', { version })
}
