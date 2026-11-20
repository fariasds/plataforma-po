import { useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AzureUserProfile, UnifiedSprint } from '@shared/azure'
import type { Configuration, Squad } from '@shared/config/schema'
import type {
  BugAnalysisResult,
  DailyResult,
  PlanningResult,
  SprintDeliveryResult,
  TeamPerformanceResult
} from '@shared/dashboards'
import { t } from '../i18n'
import { ipc } from './client'
import { PROFILE_QUERY_KEY } from './useProfile'
import { useActiveSquad } from './useActiveSquad'

/**
 * A Configuração em uso, ou `null` antes de existir uma válida.
 *
 * Lê o mesmo cache que `useProfileState`, sem assinar o aviso do main outra vez:
 * quem mantém o cache em dia é o `ProfileGate`.
 */
export function useActiveConfig(): Configuration | null {
  const { data } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => ipc.getProfileState(),
    staleTime: Infinity
  })
  return data?.config ?? null
}

/** A Configuração em uso. Só para telas atrás do `ProfileGate`, que garante uma. */
export function useConfiguration(): Configuration {
  const config = useActiveConfig()
  if (!config) throw new Error('Tela de dashboard aberta sem Configuração em uso.')
  return config
}

// ─── Seleção de Produto, Grupo ou Squad inteira ──────────────────────────────

/** Um item do filtro: um Produto, um Grupo ou a Squad inteira. */
export interface SelectionOption {
  id: string
  name: string
  /** `undefined` para Grupo sem cor na Configuração. */
  color: string | undefined
  /** Soma mais de um Produto: Grupo ou Squad inteira. */
  isGroup: boolean
  /** Só na Squad inteira: as cores dos Produtos dela, mostradas lado a lado. */
  memberColors?: string[]
}

/**
 * - `review`: todos os Produtos e depois todos os Grupos.
 * - `planning`: Planning e Daily; Produto de fluxo contínuo não tem sprint para
 *   planejar, então fica de fora — e com ele o Grupo que o contém.
 */
export type SelectionKind = 'review' | 'planning'

/**
 * Com uma Squad aberta (RN-GLB-17), só o que é dela: primeiro a Squad inteira
 * (quando ela tem dois ou mais Produtos), depois os Produtos e os Grupos dela.
 * A Squad inteira segue a regra do Grupo no Planning e na Daily.
 */
export function selectionOptions(
  config: Configuration,
  kind: SelectionKind,
  squad: Squad | null = null
): SelectionOption[] {
  const members = squad ? new Set(squad.products) : null
  const products = config.products.filter(
    (p) => (kind === 'review' || p.cadence === 'sprints') && (!members || members.has(p.id))
  )
  const ids = new Set(products.map((p) => p.id))
  const groups = config.groups.filter((g) => g.products.every((id) => ids.has(id)))
  const whole: SelectionOption[] =
    squad && squad.products.length > 1 && squad.products.every((id) => ids.has(id))
      ? [
          {
            id: squad.id,
            name: t('squads.whole'),
            color: squad.color,
            isGroup: true,
            memberColors: squad.products.map(
              (id) => config.products.find((p) => p.id === id)!.color
            )
          }
        ]
      : []
  return [
    ...whole,
    ...products.map((p) => ({ id: p.id, name: p.name, color: p.color, isGroup: false })),
    ...groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      isGroup: true
    }))
  ]
}

export interface Selection {
  options: SelectionOption[]
  /** ID selecionado; `''` quando a Configuração ainda não tem Produto. */
  value: string
  selected: SelectionOption | undefined
  onChange: (id: string) => void
}

/**
 * Seleção de uma tela, dentro da Squad aberta. Começa na primeira opção e, se a
 * Configuração ou a Squad mudar e o escolhido sumir, volta para a primeira.
 */
export function useSelection(kind: SelectionKind): Selection {
  const options = selectionOptions(useConfiguration(), kind, useActiveSquad())
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = options.find((o) => o.id === chosen) ?? options[0]
  return { options, value: selected?.id ?? '', selected, onChange: setChosen }
}

/**
 * One hook per screen, mirroring the IPC handlers. Query keys carry every input
 * so switching product or sprint fetches fresh data while keeping the old one cached.
 */

/** Sprints da Squad aberta; sem Squads, as de todos os Produtos (RN-GLB-17). */
export function useSprints(
  limit?: number,
  preferFuture?: boolean,
  /** `'all'`: Sprint unificada de todos os Produtos, ignorando a aba (a Home, RN-GLB-17). */
  scope: 'squad' | 'all' = 'squad'
): UseQueryResult<UnifiedSprint[], Error> {
  const activeSquadId = useActiveSquad()?.id ?? null
  const squadId = scope === 'all' ? null : activeSquadId
  return useQuery({
    queryKey: ['sprints', limit, preferFuture, squadId],
    queryFn: () => ipc.getSprints(limit, preferFuture, squadId)
  })
}

export function useSprintDelivery(
  selectionId: string,
  sprint: UnifiedSprint | undefined
): UseQueryResult<SprintDeliveryResult, Error> {
  return useQuery({
    queryKey: ['sprint-delivery', selectionId, sprint?.key],
    enabled: sprint !== undefined,
    queryFn: () => ipc.getSprintDelivery(selectionId, sprint!)
  })
}

export function useTeamPerformance(
  selectionId: string,
  sprints: UnifiedSprint[] | undefined
): UseQueryResult<TeamPerformanceResult, Error> {
  return useQuery({
    queryKey: ['team-performance', selectionId, sprints?.map((s) => s.key)],
    enabled: sprints !== undefined && sprints.length > 0,
    queryFn: () => ipc.getTeamPerformance(selectionId, sprints!)
  })
}

export function useBugAnalysis(
  selectionId: string,
  sprints: UnifiedSprint[] | undefined,
  selectedSprint: UnifiedSprint | undefined
): UseQueryResult<BugAnalysisResult, Error> {
  return useQuery({
    queryKey: ['bug-analysis', selectionId, sprints?.map((s) => s.key), selectedSprint?.key],
    enabled: sprints !== undefined && sprints.length > 0 && selectedSprint !== undefined,
    queryFn: () => ipc.getBugAnalysis(selectionId, sprints!, selectedSprint!)
  })
}

export function useDaily(
  selectionId: string,
  sprint: UnifiedSprint | undefined
): UseQueryResult<DailyResult, Error> {
  return useQuery({
    queryKey: ['daily', selectionId, sprint?.key],
    enabled: sprint !== undefined,
    // O consumo é medido até "agora": cache longo faria a barra congelar.
    staleTime: 60 * 1000,
    queryFn: () => ipc.getDaily(selectionId, sprint!)
  })
}

/**
 * Nome e foto de quem é dono do PAT, vindos do Azure.
 *
 * Cache longo de propósito: o perfil de alguém não muda durante o expediente.
 * Sem retry: se falhar, a tela segue nas iniciais.
 */
export function useCurrentUser(): UseQueryResult<AzureUserProfile | null, Error> {
  return useQuery({
    queryKey: ['current-user'],
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => ipc.getCurrentUser()
  })
}

export function usePlanning(
  selectionId: string,
  sprint: UnifiedSprint | undefined
): UseQueryResult<PlanningResult, Error> {
  return useQuery({
    queryKey: ['planning', selectionId, sprint?.key],
    enabled: sprint !== undefined,
    queryFn: () => ipc.getPlanning(selectionId, sprint!)
  })
}
