import type { AzureIteration, UnifiedSprint } from '@shared/azure'

function toDateKey(iso: string): string {
  return iso.split('T')[0]
}

// Lê a parte de data da string ISO ignorando timezone (evita bug UTC→BRT)
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatLabel(startDate: string, finishDate: string): string {
  const fmt = (iso: string): string =>
    parseLocalDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${fmt(startDate)} → ${fmt(finishDate)}`
}

/** As iterações de um Produto, já lidas do Azure. */
export interface ProductIterations {
  productId: string
  iterations: AzureIteration[]
}

/**
 * Junta as iterações de N Produtos numa lista de Sprints unificadas (RN-GLB-04).
 * A chave é a janela de datas, nunca o nome: cada Produto numera as suas sprints
 * do seu jeito. A ordem de `products` vira a ordem de `iterations` na sprint.
 */
export function buildUnifiedSprints(
  products: ProductIterations[],
  limit = 5,
  preferFuture = false
): UnifiedSprint[] {
  const map = new Map<string, UnifiedSprint>()

  for (const { productId, iterations } of products) {
    for (const iter of iterations) {
      const key = `${toDateKey(iter.attributes.startDate)}_${toDateKey(iter.attributes.finishDate)}`
      const existing = map.get(key) ?? {
        key,
        label: formatLabel(iter.attributes.startDate, iter.attributes.finishDate),
        startDate: iter.attributes.startDate,
        finishDate: iter.attributes.finishDate,
        iterations: {}
      }
      // Duas iterações do mesmo Produto no mesmo período: vale a última, como antes.
      existing.iterations[productId] = { id: iter.id, name: iter.name, path: iter.path }
      map.set(key, existing)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const all = Array.from(map.values()).sort(
    (a, b) => parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime()
  )

  // Encontra o índice da sprint atual (StartDate <= hoje <= FinishDate)
  const currentIndex = all.findIndex((s) => {
    const start = parseLocalDate(s.startDate)
    const finish = parseLocalDate(s.finishDate)
    finish.setHours(23, 59, 59, 999)
    return today >= start && today <= finish
  })

  // Se não encontrar sprint atual, comportamento depende de preferFuture:
  // - false (dashboard): ancora na sprint passada mais recente
  // - true (planejamento): ancora na sprint futura mais próxima (dia de gap → próxima sprint)
  let anchorIndex: number
  if (currentIndex >= 0) {
    anchorIndex = currentIndex
  } else if (preferFuture) {
    // Último índice onde startDate > hoje = sprint futura mais próxima (array newest→oldest)
    const nearestFutureIndex = all.reduce(
      (found, s, i) => (parseLocalDate(s.startDate) > today ? i : found),
      -1
    )
    if (nearestFutureIndex >= 0) {
      anchorIndex = nearestFutureIndex
    } else {
      const pastIndex = all.findIndex((s) => parseLocalDate(s.finishDate) < today)
      anchorIndex = pastIndex >= 0 ? pastIndex : 0
    }
  } else {
    const pastIndex = all.findIndex((s) => parseLocalDate(s.finishDate) < today)
    anchorIndex = pastIndex >= 0 ? pastIndex : 0
  }

  // Planning olha para frente (RN-PLN-01): a âncora e as (limit - 1) seguintes, da
  // mais próxima para a mais distante. Review olha para trás: a âncora e as anteriores.
  if (preferFuture) {
    return all.slice(Math.max(0, anchorIndex - limit + 1), anchorIndex + 1).reverse()
  }
  return all.slice(anchorIndex, anchorIndex + limit)
}
