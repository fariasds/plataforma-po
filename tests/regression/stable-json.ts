/**
 * JSON formatado e com as chaves em ordem alfabética, para o diff de um
 * resultado aprovado ser legível no PR. A ordem dos arrays é preservada: nas
 * telas ela é parte do resultado (a ordem dos itens da Daily, por exemplo).
 *
 * `undefined` some, como no `JSON.stringify`; `Set` e `Map` não aparecem nos
 * resultados das telas, e por isso não são tratados.
 */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
  )
}
