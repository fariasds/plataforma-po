import { SCRUM_PROCESS, project, sprintSeries, workItem, type ItemSpec } from '../builders'
import type { FakeIteration, FakeProject, FakeWorkItem } from '../types'

/**
 * O que vários Cenários repetem: o Produto "Loja Online", Scrum, no projeto
 * `Contoso`, com sprints de duas semanas a partir de 24/08/2026.
 *
 * | Sprint | Período       |
 * |--------|---------------|
 * | 1      | 24/08 – 04/09 |
 * | 2      | 07/09 – 18/09 |
 * | 3      | 21/09 – 02/10 |
 * | 4      | 05/10 – 16/10 |
 * | 5      | 19/10 – 30/10 |
 * | 6      | 02/11 – 13/11 |
 * | 7      | 16/11 – 27/11 |
 */

export const LOJA_PROJECT = 'Contoso'
export const LOJA_AREA = 'Contoso\\Loja'

export const LOJA_SPRINTS = sprintSeries({
  folder: 'Contoso\\Loja',
  idPrefix: 'it-loja',
  firstMonday: '2026-08-24',
  count: 7
})

/** Caminho da sprint N da Loja. */
export function lojaSprint(n: number): string {
  return LOJA_SPRINTS[n - 1].path
}

export const LOJA_PRODUCT = {
  id: 'loja',
  name: 'Loja Online',
  color: '#7b61ff',
  project: LOJA_PROJECT,
  areaPaths: [LOJA_AREA],
  processProfile: 'scrum'
}

export function lojaProject(
  extra: { iterations?: FakeIteration[]; customFields?: FakeProject['customFields'] } = {}
): FakeProject {
  return project({
    id: '00000000-0000-4000-9000-000000000001',
    name: LOJA_PROJECT,
    process: SCRUM_PROCESS,
    areas: [LOJA_AREA, 'Contoso\\Loja\\Checkout', 'Contoso\\Loja\\QA', 'Contoso\\App'],
    iterations: extra.iterations ?? LOJA_SPRINTS,
    customFields: extra.customFields
  })
}

/** Item Scrum da Loja: projeto, área e processo já preenchidos. */
export function lojaItem(
  spec: Omit<ItemSpec, 'project' | 'area' | 'type'> & { type?: string; area?: string }
): FakeWorkItem {
  return workItem(SCRUM_PROCESS, {
    project: LOJA_PROJECT,
    area: LOJA_AREA,
    type: 'Product Backlog Item',
    ...spec
  })
}

export const PBI = 'Product Backlog Item'
export const EFFORT = 'Microsoft.VSTS.Scheduling.Effort'
export const PRIORITY = 'Microsoft.VSTS.Common.Priority'
export const DUE_DATE = 'Microsoft.VSTS.Scheduling.DueDate'
export const DESCRIPTION = 'System.Description'
