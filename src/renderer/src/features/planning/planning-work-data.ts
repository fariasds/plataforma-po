import { useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { AnticipatedShare, ManualPlanningItem, PlanningLookupItem } from '@shared/dashboards'
import { planningKeys } from '@shared/planning-keys'
import { ipc } from '../../ipc/client'
import { useConfiguration } from '../../ipc/useAzure'
import { useActiveSquad } from '../../ipc/useActiveSquad'
import {
  resolveCapacity,
  resolveSquadCapacity,
  type CapacityConfig,
  type StoredCapacity
} from './planning-rules'

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

/**
 * Os remanescentes relidos do Azure, pelo ID (RN-PLN-09). Assim o percentual é
 * reaplicado sobre a estimativa de agora, e o botão Atualizar alcança também
 * esses itens (RN-GLB-19). Item que não se consegue reler fica com os pontos
 * guardados.
 */
export function useLiveLeftovers(ids: number[]): ReadonlyMap<number, PlanningLookupItem> {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['planning-item', id],
      queryFn: () => ipc.getPlanningItem(id)
    }))
  })
  const live = new Map<number, PlanningLookupItem>()
  for (const result of results) if (result.data) live.set(result.data.id, result.data)
  return live
}

// ─── Desenvolvimento antecipado ──────────────────────────────────────────────

interface Anticipations {
  items: AnticipatedShare[]
  isPending: boolean
  error: Error | null
  /** Grava ou troca o antecipado de um item; 0% nas duas disciplinas tira a marca. */
  set: (share: AnticipatedShare) => void
  remove: (id: number) => void
}

/**
 * Antecipados da seleção (RN-PLN-26). Como os remanescentes, cada Produto guarda
 * a sua lista e o Grupo lê e grava as dos seus Produtos.
 */
export function useAnticipations(
  productIds: string[],
  sprintKey: string | undefined
): Anticipations {
  const keys = sprintKey ? productIds.map((id) => planningKeys.anticipated(id, sprintKey)) : []
  const stored = useStoredValues<AnticipatedShare[]>(keys, sprintKey !== undefined)
  const items = stored.values.flatMap((list) => list ?? [])
  const save = (next: AnticipatedShare[]): void =>
    stored.save(productIds.map((id) => next.filter((a) => a.product === id)))

  return {
    items,
    isPending: stored.isPending,
    error: stored.error,
    set: (share) => {
      const others = items.filter((a) => a.id !== share.id)
      save(share.frontendPercent === 0 && share.backendPercent === 0 ? others : [...others, share])
    },
    remove: (id) => save(items.filter((a) => a.id !== id))
  }
}

// ─── Capacidade ──────────────────────────────────────────────────────────────

/**
 * Os valores editados ficam no Perfil; o que nunca foi editado segue a
 * Configuração. Com Squads, cada uma tem a sua (RN-PLN-22).
 */
export function useCapacity(): {
  config: CapacityConfig
  productiveHours: number
  update: (patch: Partial<CapacityConfig>) => void
} {
  const { capacityDefaults, calendar } = useConfiguration()
  const squad = useActiveSquad()
  const stored = useStoredValues<StoredCapacity>(
    squad ? [planningKeys.squadCapacity(squad.id), planningKeys.capacity] : [planningKeys.capacity]
  )

  if (!squad) {
    const saved = stored.values[0] ?? {}
    return {
      config: resolveCapacity(capacityDefaults, saved),
      productiveHours: calendar.productiveHoursPerDay,
      update: (patch) => stored.save([{ ...saved, ...patch }])
    }
  }

  const [savedSquad, savedProfile] = stored.values
  const config = resolveSquadCapacity(
    capacityDefaults,
    squad.capacityDefaults,
    savedSquad,
    savedProfile
  )
  return {
    config,
    productiveHours: calendar.productiveHoursPerDay,
    // A primeira edição grava a capacidade inteira na Squad: dali em diante ela
    // não depende mais da capacidade única do Perfil.
    update: (patch) => stored.save([{ ...(savedSquad ?? config), ...patch }, savedProfile])
  }
}
