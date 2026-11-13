import type { SprintPhase } from '@shared/home'

/** A tela de cada momento do ciclo. Review abre em Entregas, a primeira do grupo. */
export const PHASE_ROUTE: Record<SprintPhase, string> = {
  planning: '/planning',
  daily: '/daily',
  review: '/dashboard/sprint-delivery'
}

export const PHASES: SprintPhase[] = ['planning', 'daily', 'review']
