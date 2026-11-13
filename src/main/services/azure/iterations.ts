import type { AzureIteration } from '@shared/azure'
import { fetchAzure } from './client'
import type { ResolvedProduct } from './scope'

// ─── Classification node (árvore de iterations do projeto) ──────────────────────

interface IterationNode {
  identifier: string
  name: string
  path: string
  attributes?: {
    startDate?: string
    finishDate?: string
  }
  children?: IterationNode[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Normaliza o path da árvore de classificação para o formato de IterationPath
// usado em WIQL: "\Loja Online\Iteration\Sprint 103" → "Loja Online\Sprint 103"
function toIterationPath(nodePath: string): string {
  return nodePath.replace(/^\\/, '').replace(/\\Iteration\\/, '\\')
}

function deriveTimeFrame(
  startDate: string,
  finishDate: string
): AzureIteration['attributes']['timeFrame'] {
  const now = Date.now()
  if (new Date(finishDate).getTime() < now) return 'past'
  if (new Date(startDate).getTime() > now) return 'future'
  return 'current'
}

// Achata a árvore, mantendo apenas nós-folha com datas (sprints reais).
// Nós de agrupamento (raiz "Iteration", pastas) não têm datas e são ignorados.
function flattenIterations(node: IterationNode, acc: AzureIteration[]): void {
  const { startDate, finishDate } = node.attributes ?? {}
  if (startDate && finishDate) {
    acc.push({
      id: node.identifier,
      name: node.name,
      path: toIterationPath(node.path),
      attributes: { startDate, finishDate, timeFrame: deriveTimeFrame(startDate, finishDate) }
    })
  }
  for (const child of node.children ?? []) {
    flattenIterations(child, acc)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface TeamIterationsResponse {
  value: Array<{
    id: string
    name: string
    path: string
    attributes?: { startDate?: string | null; finishDate?: string | null }
  }>
}

// Com time na Configuração, valem as iterações atribuídas a ele: é o jeito de
// separar Produtos que dividem o mesmo projeto e a mesma árvore de iterações.
async function getTeamIterations(project: string, team: string): Promise<AzureIteration[]> {
  const response = await fetchAzure<TeamIterationsResponse>(
    `/${encodeURIComponent(project)}/${encodeURIComponent(team)}` +
      `/_apis/work/teamsettings/iterations?api-version=7.1`
  )
  return response.value.flatMap(({ id, name, path, attributes }) => {
    const startDate = attributes?.startDate
    const finishDate = attributes?.finishDate
    if (!startDate || !finishDate) return []
    return [
      {
        id,
        name,
        path,
        attributes: { startDate, finishDate, timeFrame: deriveTimeFrame(startDate, finishDate) }
      }
    ]
  })
}

// Sem time, lê TODAS as iterations cadastradas no projeto (via classification
// nodes), e não apenas as atribuídas ao backlog de um time. Assim qualquer sprint
// criada no Azure DevOps passa a aparecer no dashboard automaticamente, sem
// depender de atribuição manual ao time (RN-GLB-05).
export async function getIterations(product: ResolvedProduct): Promise<AzureIteration[]> {
  if (product.team) return getTeamIterations(product.project, product.team)

  const root = await fetchAzure<IterationNode>(
    `/${encodeURIComponent(product.project)}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.1`
  )

  const iterations: AzureIteration[] = []
  flattenIterations(root, iterations)
  return iterations
}
