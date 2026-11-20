import type {
  AnticipatedShare,
  ManualPlanningItem,
  PlanningItem,
  PlanningLookupItem
} from '@shared/dashboards'

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

/**
 * Capacidade de uma Squad (RN-PLN-22). O que a Squad gravou vale primeiro.
 * Sem isso, a capacidade única de antes das Squads continua valendo — a não ser
 * que a Configuração dê à Squad valores próprios, que então são o ponto de
 * partida dela.
 */
export function resolveSquadCapacity(
  defaults: CapacityConfig,
  squadDefaults: CapacityConfig | undefined,
  savedSquad: StoredCapacity | null,
  savedProfile: StoredCapacity | null
): CapacityConfig {
  if (savedSquad) return resolveCapacity(squadDefaults ?? defaults, savedSquad)
  if (squadDefaults) return squadDefaults
  return resolveCapacity(defaults, savedProfile ?? {})
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

// ─── Rateio por disciplina: remanescente e antecipado ───────────────────────

export type SharePercent = 0 | 25 | 50 | 75 | 100

export const SHARE_PERCENTS: SharePercent[] = [0, 25, 50, 75, 100]

function share(value: number | null, percent: number): number | null {
  return value !== null ? Math.round(value * (percent / 100)) : null
}

/** O total é a soma das partes, nunca o do Azure (RN-PLN-09, RN-PLN-24). */
function sumParts(
  frontend: number | null,
  backend: number | null,
  qa: number | null
): number | null {
  if (frontend === null && backend === null && qa === null) return null
  return (frontend ?? 0) + (backend ?? 0) + (qa ?? 0)
}

/**
 * Remanescente (RN-PLN-09): o percentual é o que **falta** de frontend e de
 * backend. QA entra sempre integral.
 */
export function applyLeftover(
  source: PlanningLookupItem,
  frontendPercent: number,
  backendPercent: number
): ManualPlanningItem {
  const frontend = share(source.frontend, frontendPercent)
  const backend = share(source.backend, backendPercent)
  return {
    id: source.id,
    title: source.title,
    state: source.state,
    product: source.product,
    priority: source.priority,
    frontend,
    backend,
    qa: source.qa,
    total: sumParts(frontend, backend, source.qa),
    frontendPercent,
    backendPercent
  }
}

/**
 * Antecipado (RN-PLN-24): o percentual é o que **já foi feito** numa sprint
 * anterior, e sai do planejamento desta. É o inverso do remanescente: fica o
 * complemento, arredondado. QA entra sempre integral.
 */
export function applyAnticipation(
  source: PlanningItem,
  frontendPercent: number,
  backendPercent: number
): PlanningItem {
  const frontend = share(source.frontend, 100 - frontendPercent)
  const backend = share(source.backend, 100 - backendPercent)
  return { ...source, frontend, backend, total: sumParts(frontend, backend, source.qa) }
}

/** Uma linha do Planning: o item como entra nas somas, e de onde veio o rateio. */
export interface PlanningRow extends PlanningItem {
  /** Remanescente: o percentual que falta (RN-PLN-11). */
  leftover?: { frontendPercent: number; backendPercent: number }
  /** Antecipado: o percentual já feito e os pontos do Azure antes do desconto (RN-PLN-25). */
  anticipated?: {
    frontendPercent: number
    backendPercent: number
    original: Pick<PlanningItem, 'frontend' | 'backend' | 'total'>
  }
}

/**
 * Junta os itens do Azure, os remanescentes e os antecipados na ordem do backlog.
 *
 * O remanescente guarda os pontos do momento em que foi adicionado; quando o
 * item foi relido do Azure (`live`), o percentual é reaplicado sobre os pontos
 * de agora (RN-PLN-09). O antecipado guarda só o percentual e vale para item do
 * Azure: remanescente já tem o próprio rateio (RN-PLN-23).
 */
export function buildPlanningRows(
  azureItems: PlanningItem[],
  manualItems: ManualPlanningItem[],
  anticipations: AnticipatedShare[],
  live: ReadonlyMap<number, PlanningLookupItem> = new Map()
): PlanningRow[] {
  const manualIds = new Set(manualItems.map((item) => item.id))
  const anticipatedById = new Map(anticipations.map((a) => [a.id, a]))

  const fromAzure = azureItems.map((item): PlanningRow => {
    const a = anticipatedById.get(item.id)
    if (!a || manualIds.has(item.id) || (a.frontendPercent === 0 && a.backendPercent === 0)) {
      return item
    }
    return {
      ...applyAnticipation(item, a.frontendPercent, a.backendPercent),
      anticipated: {
        frontendPercent: a.frontendPercent,
        backendPercent: a.backendPercent,
        original: { frontend: item.frontend, backend: item.backend, total: item.total }
      }
    }
  })

  const leftovers = manualItems.map((stored): PlanningRow => {
    const fresh = live.get(stored.id)
    const { frontendPercent, backendPercent, ...item } = fresh
      ? applyLeftover(fresh, stored.frontendPercent, stored.backendPercent)
      : stored
    return { ...item, leftover: { frontendPercent, backendPercent } }
  })

  return [...fromAzure, ...leftovers].sort(comparePlanningItems)
}

/** Pontos antecipados que saíram das somas, por disciplina (RN-PLN-25). */
export function anticipatedDiscount(rows: PlanningRow[]): {
  frontend: number
  backend: number
  total: number
} {
  const result = { frontend: 0, backend: 0, total: 0 }
  for (const row of rows) {
    if (!row.anticipated) continue
    result.frontend += (row.anticipated.original.frontend ?? 0) - (row.frontend ?? 0)
    result.backend += (row.anticipated.original.backend ?? 0) - (row.backend ?? 0)
  }
  result.total = result.frontend + result.backend
  return result
}
