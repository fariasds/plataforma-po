import { readFileSync } from 'fs'
import { AppError } from '@shared/errors'
import type { ProcessProfile } from '@shared/config/schema'
import type {
  DiscoveredArea,
  DiscoveredField,
  DiscoveredProcess,
  DiscoveredProject,
  DiscoveredState,
  DiscoveredTeam,
  DiscoveredWorkItemType,
  StateCategory
} from '@shared/discovery'
import { getActiveConfig } from '../../profile/config-loader'
import { configPath } from '../../profile/paths'
import { requireActiveProfile } from '../../profile/profile-store'
import { fetchAzure } from './client'

/**
 * Descoberta do que existe na organização, base do assistente de Configuração.
 * Só GET. Cada endpoint foi conferido em 2026-09-29 na documentação da
 * Microsoft (REST 7.1); o link está junto da chamada.
 */

const API = 'api-version=7.1'
/** Tamanho da página nas listagens com `$top`/`$skip`. */
const PAGE = 100
/** Requisições simultâneas ao detalhar vários projetos ou tipos. */
const PARALLEL = 6

const segment = encodeURIComponent
/** Marca de ordem de bytes que alguns editores gravam no começo do JSON. */
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`)

/**
 * Organização da descoberta. Com Configuração em uso, é a dela. Sem nenhuma
 * versão válida, vale o campo `organization` do arquivo como está no disco: o
 * assistente existe justamente para consertar ou completar essa Configuração.
 */
export function discoveryOrganization(): string {
  const fromConfig = getActiveConfig()?.organization
  if (fromConfig) return fromConfig

  const profile = requireActiveProfile()
  let organization: unknown
  try {
    const raw = JSON.parse(readFileSync(configPath(profile.id), 'utf8').replace(BOM, ''))
    organization = (raw as { organization?: unknown }).organization
  } catch {
    organization = undefined
  }
  if (typeof organization !== 'string' || organization.trim() === '') {
    throw new AppError(
      'PROFILE_INVALID',
      'A Configuração não diz qual é a organização do Azure. Preencha "organization" com o nome dela.'
    )
  }
  return organization
}

async function mapLimited<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += PARALLEL) {
    results.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(task))))
  }
  return results
}

/** Percorre uma listagem paginada por `$top`/`$skip` até vir uma página incompleta. */
async function fetchAllPages<T>(pathWithQuery: string): Promise<T[]> {
  const all: T[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { value } = await fetchAzure<{ value: T[] }>(
      `${pathWithQuery}&$top=${PAGE}&$skip=${skip}`
    )
    all.push(...value)
    if (value.length < PAGE) return all
  }
}

// ─── Projetos ────────────────────────────────────────────────────────────────

interface ProjectReference {
  id: string
  name: string
}

interface TeamProject extends ProjectReference {
  capabilities?: { processTemplate?: { templateName?: string } }
  defaultTeam?: { name?: string }
}

/**
 * Projetos que o PAT enxerga, com o processo de cada um. A listagem não traz o
 * processo; ele só vem no detalhe com `includeCapabilities`.
 * - https://learn.microsoft.com/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.1
 * - https://learn.microsoft.com/rest/api/azure/devops/core/projects/get?view=azure-devops-rest-7.1
 */
export async function listProjects(): Promise<DiscoveredProject[]> {
  const projects = await fetchAllPages<ProjectReference>(`/_apis/projects?${API}`)
  const detailed = await mapLimited(projects, (project) =>
    fetchAzure<TeamProject>(
      `/_apis/projects/${segment(project.id)}?includeCapabilities=true&${API}`
    )
  )
  return detailed
    .map((project) => ({
      id: project.id,
      name: project.name,
      process: project.capabilities?.processTemplate?.templateName ?? null,
      defaultTeam: project.defaultTeam?.name ?? null
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Times ───────────────────────────────────────────────────────────────────

/**
 * - https://learn.microsoft.com/rest/api/azure/devops/core/teams/get-teams?view=azure-devops-rest-7.1
 */
export async function listTeams(project: string): Promise<DiscoveredTeam[]> {
  const teams = await fetchAllPages<DiscoveredTeam>(
    `/_apis/projects/${segment(project)}/teams?${API}`
  )
  return teams.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Áreas ───────────────────────────────────────────────────────────────────

interface ClassificationNode {
  name: string
  children?: ClassificationNode[]
}

/** Profundidade da árvore pedida ao Azure. Áreas mais fundas que isso são raras. */
const AREA_DEPTH = 10

/**
 * O `path` do nó vem como `\Projeto\Area\Loja`, com o grupo da estrutura no
 * meio; a Configuração e o WIQL usam `Projeto\Loja`. Por isso o caminho é
 * remontado pelos nomes, a partir da raiz, em vez de copiado.
 */
function toArea(node: ClassificationNode, parentPath: string | null): DiscoveredArea {
  const path = parentPath === null ? node.name : `${parentPath}\\${node.name}`
  return {
    name: node.name,
    path,
    children: (node.children ?? []).map((child) => toArea(child, path))
  }
}

/**
 * - https://learn.microsoft.com/rest/api/azure/devops/wit/classification-nodes/get?view=azure-devops-rest-7.1
 */
export async function getAreaTree(project: string): Promise<DiscoveredArea> {
  const root = await fetchAzure<ClassificationNode>(
    `/${segment(project)}/_apis/wit/classificationnodes/areas?$depth=${AREA_DEPTH}&${API}`
  )
  return toArea(root, null)
}

// ─── Processo ────────────────────────────────────────────────────────────────

interface WorkItemTypeResponse {
  name: string
  referenceName: string
  isDisabled?: boolean
  fields?: Array<{ referenceName: string }>
}

interface TypeCategoryResponse {
  referenceName: string
  defaultWorkItemType?: { name: string } | null
  workItemTypes?: Array<{ name: string }>
}

const STATE_CATEGORIES = new Set<string>([
  'Proposed',
  'InProgress',
  'Resolved',
  'Completed',
  'Removed'
])

/** Campos de estimativa dos processos padrão: Scrum/Básico, Agile e CMMI. */
const ESTIMATE_FIELDS = [
  'Microsoft.VSTS.Scheduling.Effort',
  'Microsoft.VSTS.Scheduling.StoryPoints',
  'Microsoft.VSTS.Scheduling.Size'
]

function categoryTypes(categories: TypeCategoryResponse[], referenceName: string): string[] {
  const category = categories.find((c) => c.referenceName === referenceName)
  return (category?.workItemTypes ?? []).map((type) => type.name)
}

function categoryDefault(categories: TypeCategoryResponse[], referenceName: string): string | null {
  const category = categories.find((c) => c.referenceName === referenceName)
  return category?.defaultWorkItemType?.name ?? categoryTypes(categories, referenceName)[0] ?? null
}

/**
 * Tipos de work item com os estados e a **categoria** de cada estado, mais o
 * papel de cada tipo (requisito, bug, tarefa) segundo as categorias de tipo.
 * - https://learn.microsoft.com/rest/api/azure/devops/wit/work-item-types/list?view=azure-devops-rest-7.1
 * - https://learn.microsoft.com/rest/api/azure/devops/wit/work-item-type-states/list?view=azure-devops-rest-7.1
 * - https://learn.microsoft.com/rest/api/azure/devops/wit/work-item-type-categories/list?view=azure-devops-rest-7.1
 */
export async function getProcessDetails(project: string): Promise<DiscoveredProcess> {
  const base = `/${segment(project)}/_apis/wit`
  const [types, categories] = await Promise.all([
    fetchAzure<{ value: WorkItemTypeResponse[] }>(`${base}/workitemtypes?${API}`),
    fetchAzure<{ value: TypeCategoryResponse[] }>(`${base}/workitemtypecategories?${API}`)
  ])

  // Test Plan, Code Review e afins: existem no processo, mas ninguém os planeja.
  const hidden = new Set(categoryTypes(categories.value, 'Microsoft.HiddenCategory'))
  const visible = types.value.filter((type) => !type.isDisabled && !hidden.has(type.name))

  const workItemTypes = await mapLimited(visible, async (type) => {
    const { value } = await fetchAzure<{ value: Array<{ name: string; category?: string }> }>(
      `${base}/workitemtypes/${segment(type.name)}/states?${API}`
    )
    const fields = new Set((type.fields ?? []).map((field) => field.referenceName))
    const states: DiscoveredState[] = value.map((state) => ({
      name: state.name,
      category:
        state.category && STATE_CATEGORIES.has(state.category)
          ? (state.category as StateCategory)
          : null
    }))
    return {
      name: type.name,
      referenceName: type.referenceName,
      states,
      estimateField: ESTIMATE_FIELDS.find((field) => fields.has(field)) ?? null
    } satisfies DiscoveredWorkItemType
  })

  const visibleNames = new Set(workItemTypes.map((type) => type.name))
  const onlyVisible = (name: string | null): string | null =>
    name && visibleNames.has(name) ? name : null

  return {
    workItemTypes,
    categories: {
      requirement: categoryTypes(categories.value, 'Microsoft.RequirementCategory').filter((name) =>
        visibleNames.has(name)
      ),
      bug: onlyVisible(categoryDefault(categories.value, 'Microsoft.BugCategory')),
      task: onlyVisible(categoryDefault(categories.value, 'Microsoft.TaskCategory'))
    }
  }
}

// ─── Campos ──────────────────────────────────────────────────────────────────

interface FieldResponse {
  name: string
  referenceName: string
  type: string
  isDeleted?: boolean
}

/**
 * Campos que o processo acrescentou: `Custom.*` nos processos herdados e o
 * prefixo da empresa nos processos XML. Os de sistema (`System.*`,
 * `Microsoft.*`) o app já conhece pelo nome.
 * - https://learn.microsoft.com/rest/api/azure/devops/wit/fields/list?view=azure-devops-rest-7.1
 */
export async function listFields(project: string): Promise<DiscoveredField[]> {
  const { value } = await fetchAzure<{ value: FieldResponse[] }>(
    `/${segment(project)}/_apis/wit/fields?${API}`
  )
  return value
    .filter((field) => !field.isDeleted && !/^(System|Microsoft)\./.test(field.referenceName))
    .map(({ name, referenceName, type }) => ({ name, referenceName, type }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Sugestão de Perfil de processo ──────────────────────────────────────────

function statesIn(type: DiscoveredWorkItemType | undefined, category: StateCategory): string[] {
  return (type?.states ?? []).filter((state) => state.category === category).map((s) => s.name)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/**
 * Perfil de processo sugerido a partir das **categorias** do Azure, sem
 * adivinhar nomes de estado. É ponto de partida: o PO revisa no assistente.
 *
 * - Tipos planejáveis: os da categoria de requisitos; o bug e a tarefa, os
 *   padrões das categorias de bug e de tarefa.
 * - Entrega: estados `Completed`; descarte: `Removed`; terminais: os dois.
 * - Em desenvolvimento: o primeiro `InProgress` do tipo principal.
 * - Fim do desenvolvimento: o primeiro `Resolved`, quando o processo tem.
 * - Estado de teste não tem categoria própria no Azure: fica `null`.
 *
 * Devolve `null` quando não há tipo de requisito para planejar.
 */
export function suggestProcessProfile(details: DiscoveredProcess): ProcessProfile | null {
  const byName = new Map(details.workItemTypes.map((type) => [type.name, type]))
  const plannable = details.categories.requirement.filter((name) => byName.has(name))
  if (plannable.length === 0) return null

  const primary = byName.get(plannable[0])
  const bugType = details.categories.bug ?? plannable[0]
  const bug = byName.get(bugType)
  const counted = unique([...plannable, bugType])
  const countedTypes = counted.map((name) => byName.get(name))

  const delivered = unique(countedTypes.flatMap((type) => statesIn(type, 'Completed')))
  const removed = unique(countedTypes.flatMap((type) => statesIn(type, 'Removed')))
  const inProgress =
    statesIn(primary, 'InProgress')[0] ??
    statesIn(primary, 'Resolved')[0] ??
    primary?.states.find((state) => state.category !== 'Proposed')?.name ??
    primary?.states[0]?.name ??
    'Active'

  const bugFlow = (bug?.states ?? [])
    .filter((state) => state.category !== 'Removed')
    .map((state) => state.name)

  return {
    workItemTypes: counted,
    plannableTypes: plannable,
    developmentTypes: plannable,
    bugType,
    taskType: details.categories.task ?? 'Task',
    estimateField: primary?.estimateField ?? ESTIMATE_FIELDS[0],
    // Sem estado Completed o schema recusaria a lista vazia; o PO ajusta.
    deliveredStates: delivered.length > 0 ? delivered : [inProgress],
    terminalStates: unique([...(delivered.length > 0 ? delivered : [inProgress]), ...removed]),
    removedStates: removed,
    inProgressState: inProgress,
    devDoneState: statesIn(primary, 'Resolved')[0] ?? null,
    testingState: null,
    bugStateOrder: bugFlow.length > 0 ? bugFlow : [inProgress]
  }
}
