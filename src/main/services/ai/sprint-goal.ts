import {
  MAX_GOAL_ITEMS,
  buildSprintGoalText,
  descriptionBudget,
  htmlToText,
  pickGoalItem,
  type SprintGoalRequest
} from '@shared/ai'
import type { UnifiedSprint } from '@shared/azure'
import { AppError } from '@shared/errors'
import { planningKeys } from '@shared/planning-keys'
import { requireActiveProfile } from '../../profile/profile-store'
import { readWorkData } from '../../profile/work-data'
import { redact } from '../../security/redact'
import { fetchDescriptions } from '../azure/descriptions'
import { getPlanningData } from '../azure/planning'
import { activeScope } from '../azure/scope'

/**
 * Monta o pedido do objetivo da sprint (RN-PLN-21), que o PO copia para a IA dele
 * (ADR 0007). Este módulo não executa nada nem fala com IA: só devolve texto.
 *
 * A janela manda só IDs. Título, estado, Produto e descrição o main busca de
 * novo, no Azure: texto livre vindo do renderer nunca entra no pedido.
 */

interface SourceItem {
  id: number
  title: string
  state: string
  product: string
  priority: number | null
}

function isSourceItem(value: unknown): value is SourceItem {
  const item = value as SourceItem
  return (
    typeof item === 'object' &&
    item !== null &&
    Number.isSafeInteger(item.id) &&
    typeof item.title === 'string' &&
    typeof item.state === 'string' &&
    typeof item.product === 'string'
  )
}

function assertItemIds(itemIds: unknown): number[] {
  const valid =
    Array.isArray(itemIds) &&
    itemIds.length > 0 &&
    itemIds.length <= MAX_GOAL_ITEMS &&
    itemIds.every((id) => Number.isSafeInteger(id) && id > 0)
  if (!valid) {
    throw new AppError(
      'AI_INVALID_REQUEST',
      `Marque de 1 a ${MAX_GOAL_ITEMS} itens da sprint para montar o pedido.`
    )
  }
  return [...new Set(itemIds as number[])]
}

export async function buildSprintGoalRequest(
  selectionId: string,
  sprint: UnifiedSprint,
  itemIds: number[]
): Promise<SprintGoalRequest> {
  const ids = assertItemIds(itemIds)
  const { products } = activeScope(selectionId)
  const profile = requireActiveProfile()

  // Remanescentes ficam nos Dados de trabalho, por Produto e sprint (RN-PLN-12).
  const manual = products.flatMap((product) => {
    const stored = readWorkData(profile.id, planningKeys.manual(product.id, String(sprint?.key)))
    return Array.isArray(stored) ? stored.filter(isSourceItem) : []
  })
  const planned = (await getPlanningData(selectionId, sprint)).items

  const byId = new Map<number, SourceItem>()
  for (const item of [...manual, ...planned]) byId.set(item.id, item)

  const productName = (id: string): string => products.find((p) => p.id === id)?.name ?? ''
  // Item de Produto fora da seleção não entra, mesmo que o ID exista.
  const sources = ids.flatMap((id) => {
    const item = byId.get(id)
    return item && productName(item.product) ? [item] : []
  })

  // A descrição só é buscada para o que vai no pedido, e cortada para o pedido
  // inteiro caber no teto.
  const descriptions = sources.length
    ? await fetchDescriptions(sources.map((item) => item.id))
    : new Map<number, string>()
  const budget = descriptionBudget(sources.length)

  // Um token colado num work item iria para a IA do PO. Título e descrição passam
  // pela mesma redação dos logs (RN-SEC-19): formas conhecidas e o PAT que o
  // cliente do Azure acabou de usar, cru e em base64 (RN-SEC-24). A redação vem
  // depois da conversão do HTML, para um token partido por marcação ou escrito
  // com entidade não escapar.
  const items = sources.map((item) =>
    pickGoalItem(
      { ...item, title: redact(item.title) },
      productName(item.product),
      redact(htmlToText(descriptions.get(item.id), budget))
    )
  )
  const sent = new Set(items.map((item) => item.id))

  return {
    items,
    missingIds: ids.filter((id) => !sent.has(id)),
    text: buildSprintGoalText(items)
  }
}
