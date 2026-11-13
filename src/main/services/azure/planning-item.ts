import { AppError } from '@shared/errors'
import type { PlanningLookupItem } from '@shared/dashboards'
import { fetchAzure } from './client'
import { effortFields } from './planning'
import { requireActiveConfig, sprintProducts, type ResolvedProduct } from './scope'

const PRIORITY_FIELD = 'Microsoft.VSTS.Common.Priority'

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

/** `UNDER` do WIQL: a própria área ou qualquer filha. O Azure não diferencia caixa. */
function isUnder(path: string, area: string): boolean {
  const p = path.toLowerCase()
  const a = area.toLowerCase()
  return p === a || p.startsWith(`${a}\\`)
}

/**
 * O Produto do item, pelo projeto e pela área — a mesma fronteira da consulta da
 * sprint (RN-PLN-10). Só Produtos com sprint: é para eles que o Planning puxa
 * item. Se ainda assim dois Produtos casam, vale o primeiro da Configuração.
 */
export function resolveItemProduct(
  products: ResolvedProduct[],
  teamProject: string,
  areaPath: string
): ResolvedProduct | null {
  return (
    products.find(
      (p) =>
        p.project.toLowerCase() === teamProject.toLowerCase() &&
        (p.areaPaths.length === 0 || p.areaPaths.some((area) => isUnder(areaPath, area))) &&
        !p.excludedAreaPaths.some((area) => isUnder(areaPath, area))
    ) ?? null
  )
}

/**
 * Looks up a single work item so the PO can pull a leftover from a previous
 * sprint into the current plan.
 */
export async function getPlanningItem(id: number): Promise<PlanningLookupItem> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('UNEXPECTED', 'Informe um ID numérico válido.')
  }

  const config = requireActiveConfig()
  const effort = effortFields(config)
  const fields = [
    'System.Id',
    'System.Title',
    'System.State',
    'System.TeamProject',
    'System.AreaPath',
    effort.frontend,
    effort.backend,
    effort.qa,
    PRIORITY_FIELD
  ].filter((field): field is string => field !== null)

  const item = await fetchAzure<{ id: number; fields: Record<string, unknown> }>(
    `/_apis/wit/workitems/${id}?fields=${[...new Set(fields)].join(',')}&api-version=7.1`
  )

  const products = sprintProducts(config)
  const teamProject = String(item.fields['System.TeamProject'] ?? '')
  const areaPath = String(item.fields['System.AreaPath'] ?? '')
  const product = resolveItemProduct(products, teamProject, areaPath)

  if (!product) {
    const names = products.map((p) => p.name).join(', ')
    throw new AppError(
      'UNEXPECTED',
      `O item #${item.id} (área "${areaPath}") não pertence a nenhum Produto com sprint na Configuração: ${names}.`
    )
  }

  return {
    id: item.id,
    title: String(item.fields['System.Title'] ?? ''),
    state: String(item.fields['System.State'] ?? ''),
    product: product.id,
    frontend: effort.frontend ? toNullableNumber(item.fields[effort.frontend]) : null,
    backend: effort.backend ? toNullableNumber(item.fields[effort.backend]) : null,
    qa: effort.qa ? toNullableNumber(item.fields[effort.qa]) : null,
    priority: toNullableNumber(item.fields[PRIORITY_FIELD])
  }
}
