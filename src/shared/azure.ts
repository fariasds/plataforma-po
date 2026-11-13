/**
 * Raw shapes returned by the Azure DevOps REST API.
 * They live in `shared` because delivered work items travel to the renderer
 * inside the dashboard results.
 */

export interface AzureIteration {
  id: string
  name: string
  path: string
  attributes: {
    startDate: string
    finishDate: string
    timeFrame: 'past' | 'current' | 'future'
  }
}

export interface WorkItemFields {
  'System.Id': number
  'System.Title': string
  'System.State': string
  'System.WorkItemType': string
  'System.IterationPath': string
  'System.CreatedDate': string
}

export interface WorkItem {
  id: number
  fields: WorkItemFields
}

export interface WiqlResponse {
  workItems: Array<{ id: number; url: string }>
}

export interface WorkItemsResponse {
  value: WorkItem[]
}

export interface WorkItemUpdate {
  id: number
  revisedDate: string
  fields?: {
    'System.State'?: { oldValue?: string; newValue: string }
    'System.IterationPath'?: { oldValue?: string; newValue: string }
  }
}

export interface WorkItemUpdatesResponse {
  value: WorkItemUpdate[]
}

/**
 * Identidade do dono do PAT, segundo o Azure DevOps (`RN-SEC-16`).
 *
 * Ambos os campos podem vir nulos — sem nome ou sem foto, a tela continua
 * atendendo pelas iniciais.
 */
export interface AzureUserProfile {
  displayName: string | null
  /** Foto já embutida como data URI, ou `null`. */
  avatar: string | null
}

/**
 * Deep link to a work item in Azure DevOps. Opens in the default browser.
 * A organização vem da Configuração; o main só deixa abrir links dela (RN-SEC-21).
 */
export function workItemUrl(organization: string, id: number): string {
  return `https://dev.azure.com/${encodeURIComponent(organization)}/_workitems/edit/${id}`
}

/** A iteração de um Produto dentro de uma Sprint unificada. */
export interface IterationRef {
  id: string
  name: string
  path: string
}

/**
 * Uma sprint como o app a vê: um período, com a iteração correspondente em cada
 * Produto que tem sprint nele (RN-GLB-04). `iterations` é indexado pelo ID do
 * Produto e segue a ordem dos Produtos na Configuração.
 */
export interface UnifiedSprint {
  key: string
  label: string
  startDate: string
  finishDate: string
  iterations: Record<string, IterationRef>
}

/** A iteração do Produto nesta sprint, se ele tem uma. */
export function sprintIteration(
  sprint: UnifiedSprint,
  productId: string
): IterationRef | undefined {
  // Tolerante a sprint sem o campo: ela chega do renderer, pelo IPC.
  return Object.hasOwn(sprint.iterations ?? {}, productId)
    ? sprint.iterations[productId]
    : undefined
}

/** Nome curto da sprint: o da primeira iteração, na ordem dos Produtos. */
export function sprintShortName(sprint: UnifiedSprint): string | undefined {
  return Object.values(sprint.iterations ?? {})[0]?.name
}
