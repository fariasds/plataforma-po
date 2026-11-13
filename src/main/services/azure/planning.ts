import type { PlanningItem, PlanningResult } from '@shared/dashboards'
import type { Configuration } from '@shared/config/schema'
import { fetchAzure, postAzure } from './client'
import { activeScope, requireActiveConfig, type ResolvedProduct } from './scope'
import type { WiqlResponse } from '@shared/azure'
import type { UnifiedSprint } from '@shared/azure'
import { sprintIteration } from '@shared/azure'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_FIELD = 'Microsoft.VSTS.Common.Priority'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Literal de texto do WIQL: aspas simples dobradas. */
function wiqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function wiqlList(values: string[]): string {
  return values.map(wiqlString).join(', ')
}

/**
 * Filtro de área do Produto (RN-GLB-01, RN-GLB-03). Sem `areaPaths`, vale o
 * projeto inteiro; as exclusões valem sempre.
 */
export function buildAreaClauses(product: ResolvedProduct): string {
  const clauses = [`AND [System.TeamProject] = ${wiqlString(product.project)}`]
  if (product.areaPaths.length) {
    const included = product.areaPaths
      .map((area) => `[System.AreaPath] UNDER ${wiqlString(area)}`)
      .join(' OR ')
    clauses.push(`AND (${included})`)
  }
  for (const area of product.excludedAreaPaths) {
    clauses.push(`AND NOT [System.AreaPath] UNDER ${wiqlString(area)}`)
  }
  return clauses.join('\n              ')
}

/** Consulta dos itens planejáveis de um Produto numa iteração (RN-PLN-02). */
export function buildPlanningWiql(product: ResolvedProduct, iterationPath: string): string {
  const { plannableTypes, removedStates } = product.processProfile
  const removed = removedStates.length
    ? `AND [System.State] NOT IN (${wiqlList(removedStates)})`
    : ''
  return `SELECT [System.Id] FROM WorkItems
              WHERE [System.WorkItemType] IN (${wiqlList(plannableTypes)})
              AND [System.IterationPath] = ${wiqlString(iterationPath)}
              ${removed}
              ${buildAreaClauses(product)}
              ORDER BY [System.Id] ASC`
}

/**
 * Campos de esforço da Configuração (RN-PLN-03). Cada um é opcional: o que não
 * está configurado não é pedido ao Azure e chega como `null`.
 */
export function effortFields(config: Configuration): {
  frontend: string | null
  backend: string | null
  qa: string | null
} {
  const { effortFrontend, effortBackend, effortQa } = config.customFields
  return { frontend: effortFrontend, backend: effortBackend, qa: effortQa }
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function readField(fields: Record<string, unknown>, ref: string | null): number | null {
  return ref ? toNullableNumber(fields[ref]) : null
}

// ─── Per-product fetcher ──────────────────────────────────────────────────────

async function fetchPlanningForProduct(
  product: ResolvedProduct,
  iterationPath: string,
  config: Configuration
): Promise<PlanningItem[]> {
  const project = encodeURIComponent(product.project)
  const wiql = await postAzure<WiqlResponse>(`/${project}/_apis/wit/wiql?api-version=7.1`, {
    query: buildPlanningWiql(product, iterationPath)
  })

  if (!wiql.workItems.length) return []

  const effort = effortFields(config)
  const estimate = product.processProfile.estimateField
  const fields = [
    'System.Id',
    'System.Title',
    'System.State',
    effort.frontend,
    effort.backend,
    effort.qa,
    estimate,
    PRIORITY_FIELD
  ].filter((field): field is string => field !== null)

  const ids = wiql.workItems.map((w) => w.id).join(',')
  const { value: rawItems } = await fetchAzure<{
    value: Array<{ id: number; fields: Record<string, unknown> }>
  }>(
    `/${project}/_apis/wit/workitems?ids=${ids}&fields=${[...new Set(fields)].join(',')}&api-version=7.1`
  )

  return rawItems.map((item) => ({
    id: item.id,
    title: String(item.fields['System.Title'] ?? ''),
    state: String(item.fields['System.State'] ?? ''),
    product: product.id,
    frontend: readField(item.fields, effort.frontend),
    backend: readField(item.fields, effort.backend),
    qa: readField(item.fields, effort.qa),
    total: readField(item.fields, estimate),
    priority: readField(item.fields, PRIORITY_FIELD)
  }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Itens da sprint para um Produto ou Grupo. No Grupo, cada Produto é consultado
 * na sua própria iteração da Sprint unificada; Produto sem iteração nela não
 * contribui com nada.
 */
export async function getPlanningData(
  selectionId: string,
  sprint: UnifiedSprint
): Promise<PlanningResult> {
  const config = requireActiveConfig()
  const { products } = activeScope(selectionId)

  const perProduct = await Promise.all(
    products.map((product) => {
      const iteration = sprintIteration(sprint, product.id)
      return iteration ? fetchPlanningForProduct(product, iteration.path, config) : []
    })
  )
  const items = perProduct.flat()

  const totals = {
    frontend: items.reduce((s, i) => s + (i.frontend ?? 0), 0),
    backend: items.reduce((s, i) => s + (i.backend ?? 0), 0),
    qa: items.reduce((s, i) => s + (i.qa ?? 0), 0),
    geral: items.reduce((s, i) => s + (i.total ?? 0), 0)
  }

  return { items, totals }
}
