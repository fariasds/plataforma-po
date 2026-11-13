import type { PlanningItem } from '@shared/dashboards'

/**
 * Regras do Planning que a tela e o resumo compartilhado aplicam do mesmo jeito:
 * se cada um tivesse a sua cópia, a ordem ou a situação do resumo poderiam
 * divergir do que o PO vê na tela antes de copiar.
 */

/**
 * Ordem de leitura do backlog (RN-PLN-04). Item sem prioridade vai para o fim;
 * ponto não estimado empata com zero. O ID fecha a cascata para a ordem nunca
 * oscilar entre renderizações.
 */
export function comparePlanningItems(a: PlanningItem, b: PlanningItem): number {
  const priority = (item: PlanningItem): number => item.priority ?? Number.POSITIVE_INFINITY

  if (priority(a) !== priority(b)) return priority(a) - priority(b)
  for (const key of ['total', 'frontend', 'backend', 'qa'] as const) {
    const diff = (b[key] ?? 0) - (a[key] ?? 0)
    if (diff !== 0) return diff
  }
  return a.id - b.id
}

export type CapacityStatus = 'ok' | 'warning' | 'over'

/** A partir desta fração da capacidade a sprint está "no limite" (RN-PLN-17). */
export const CAPACITY_LIMIT_RATIO = 0.95

/** Alocado sobre capacidade; sem capacidade não há o que medir, e a razão é zero. */
export function capacityRatio(allocated: number, capacity: number): number {
  return capacity > 0 ? allocated / capacity : 0
}

export function capacityStatus(ratio: number): CapacityStatus {
  if (ratio > 1) return 'over'
  return ratio >= CAPACITY_LIMIT_RATIO ? 'warning' : 'ok'
}

export interface CapacityConfig {
  frontDevs: number
  backDevs: number
  sprintDays: number
  frontBugPercent: number
  backBugPercent: number
}

/** O que ficou gravado nos Dados de trabalho, inclusive o percentual único de antes. */
export type StoredCapacity = Partial<CapacityConfig> & { bugPercent?: number }

/**
 * Parâmetros em vigor (RN-PLN-16). Um `bugPercent` gravado antes da separação
 * por disciplina foi uma edição do PO e vale para as duas, até ele editar cada uma.
 */
export function resolveCapacity(defaults: CapacityConfig, saved: StoredCapacity): CapacityConfig {
  const { bugPercent, ...rest } = saved
  return {
    ...defaults,
    ...(bugPercent === undefined
      ? {}
      : { frontBugPercent: bugPercent, backBugPercent: bugPercent }),
    ...rest
  }
}

/** Horas que cada disciplina tem na sprint (RN-PLN-15). */
export function capacityHours(
  config: CapacityConfig,
  productiveHoursPerDay: number
): { frontend: number; backend: number } {
  const perDev = (bugPercent: number): number =>
    productiveHoursPerDay * config.sprintDays * (1 - bugPercent / 100)
  return {
    frontend: config.frontDevs * perDev(config.frontBugPercent),
    backend: config.backDevs * perDev(config.backBugPercent)
  }
}
