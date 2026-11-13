import { fetchAzure } from './client'

/**
 * Descrição dos work items, em HTML como o Azure guarda. Só o pedido do objetivo
 * da sprint usa (RN-PLN-21), e só para os itens que o PO marcou; nenhuma tela
 * carrega este campo.
 */

const DESCRIPTION_FIELD = 'System.Description'
// O Azure aceita até 200 IDs por chamada.
const CHUNK = 200

export async function fetchDescriptions(ids: number[]): Promise<Map<number, string>> {
  const descriptions = new Map<number, string>()

  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK)
    const { value } = await fetchAzure<{
      // Com `errorPolicy=omit`, item apagado ou sem acesso vem como `null`.
      value: Array<{ id: number; fields: Record<string, unknown> } | null>
    }>(
      `/_apis/wit/workitems?ids=${chunk.join(',')}&fields=System.Id,${DESCRIPTION_FIELD}&errorPolicy=omit&api-version=7.1`
    )
    for (const item of value) {
      const html = item?.fields?.[DESCRIPTION_FIELD]
      if (item && typeof html === 'string') descriptions.set(item.id, html)
    }
  }
  return descriptions
}
