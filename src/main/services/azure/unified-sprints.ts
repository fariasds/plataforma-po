import type { UnifiedSprint } from '@shared/azure'
import { buildUnifiedSprints } from '../../lib/sprint-utils'
import { getIterations } from './iterations'
import { requireActiveConfig, sprintProducts } from './scope'

/**
 * Sprints de todos os Produtos com cadência por sprint, unidas por período.
 * Cada Produto numera as suas sprints do seu jeito, então a chave de agrupamento é
 * a janela de datas, nunca o nome (RN-GLB-04). Produto de fluxo contínuo não tem
 * iteração e fica de fora. Com uma Squad, só os Produtos dela (RN-GLB-17).
 */
export async function getUnifiedSprints(
  limit = 5,
  preferFuture = false,
  squadId: string | null = null
): Promise<UnifiedSprint[]> {
  const products = sprintProducts(requireActiveConfig(), squadId)
  const iterations = await Promise.all(products.map((product) => getIterations(product)))
  return buildUnifiedSprints(
    products.map((product, i) => ({ productId: product.id, iterations: iterations[i] })),
    limit,
    preferFuture
  )
}
