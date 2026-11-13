import { useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { ManualPlanningItem } from '@shared/dashboards'
import { planningKeys } from '@shared/planning-keys'
import { ipc } from '../../ipc/client'
import { useConfiguration } from '../../ipc/useAzure'
import { resolveCapacity, type CapacityConfig, type StoredCapacity } from './planning-rules'

/**
 * Dados de trabalho do Planning (RN-PLN-07, RN-PLN-12, RN-PLN-16), guardados no
 * Perfil pelo main. As chaves usam o ID do Produto e a chave da Sprint
 * unificada, nunca nomes (RN-CFG-08).
 */

export { planningKeys }

/** A mesma chave de cache do `useWorkData`, para as duas leituras não divergirem. */
function queryKey(key: string): [string, string] {
  return ['work-data', key]
}

interface StoredValues<T> {
  /** Um valor por chave, na ordem pedida; `null` quando nunca foi gravado. */
  values: Array<T | null>
  isPending: boolean
  /** Última falha de leitura ou gravação. */
  error: Error | null
  /** Grava cada chave com o seu valor. A tela muda na hora; o disco vem depois. */
  save: (next: Array<T | null>) => void
}

/**
 * Lê várias chaves de Dados de trabalho de uma vez e grava de forma otimista.
 * Sem o otimismo, cada clique mostraria o valor antigo até o main responder.
 */
export function useStoredValues<T>(keys: string[], enabled = true): StoredValues<T> {
  const queryClient = useQueryClient()
  const [writeError, setWriteError] = useState<Error | null>(null)

  const results = useQueries({
    queries: keys.map((key) => ({
      queryKey: queryKey(key),
      queryFn: async () => ((await ipc.readWorkData(key)) as T | null) ?? null,
      enabled,
      // Só esta tela grava estas chaves, e ela mesma atualiza o cache.
      staleTime: Infinity
    }))
  })

  function save(next: Array<T | null>): void {
    keys.forEach((key, i) => {
      queryClient.setQueryData(queryKey(key), next[i])
      ipc.writeWorkData(key, next[i]).then(
        () => setWriteError(null),
        (error: Error) => {
          setWriteError(error)
          // O cache mostrava algo que não foi gravado: volta ao que está no disco.
          queryClient.invalidateQueries({ queryKey: queryKey(key) })
        }
      )
    })
  }

  return {
    values: results.map((r) => r.data ?? null),
    isPending: enabled && results.some((r) => r.isPending),
    error: writeError ?? results.find((r) => r.error)?.error ?? null,
    save
  }
}

// ─── Itens remanescentes ─────────────────────────────────────────────────────

interface ManualItems {
  items: ManualPlanningItem[]
  isPending: boolean
  error: Error | null
  save: (items: ManualPlanningItem[]) => void
}

/**
 * Remanescentes da seleção. Cada Produto guarda a sua lista; o Grupo lê as dos
 * seus Produtos juntas e, ao gravar, devolve cada item à lista do Produto de
 * origem (RN-PLN-12). Assim a visão do Produto e a do Grupo nunca divergem.
 */
export function useManualItems(productIds: string[], sprintKey: string | undefined): ManualItems {
  const keys = sprintKey ? productIds.map((id) => planningKeys.manual(id, sprintKey)) : []
  const stored = useStoredValues<ManualPlanningItem[]>(keys, sprintKey !== undefined)

  return {
    items: stored.values.flatMap((list) => list ?? []),
    isPending: stored.isPending,
    error: stored.error,
    save: (items) => stored.save(productIds.map((id) => items.filter((i) => i.product === id)))
  }
}

// ─── Capacidade ──────────────────────────────────────────────────────────────

/** Os valores editados ficam no Perfil; o que nunca foi editado segue a Configuração. */
export function useCapacity(): {
  config: CapacityConfig
  productiveHours: number
  update: (patch: Partial<CapacityConfig>) => void
} {
  const { capacityDefaults, calendar } = useConfiguration()
  const stored = useStoredValues<StoredCapacity>([planningKeys.capacity])
  const saved = stored.values[0] ?? {}
  const config = resolveCapacity(capacityDefaults, saved)

  return {
    config,
    productiveHours: calendar.productiveHoursPerDay,
    update: (patch) => stored.save([{ ...saved, ...patch }])
  }
}
