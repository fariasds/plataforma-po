import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  DiscoveredArea,
  DiscoveredField,
  DiscoveredProject,
  DiscoveredTeam,
  ProcessDiscovery
} from '@shared/discovery'
import { ipc } from '../../ipc/client'

/*
  Descoberta no Azure, usada só pelo assistente. As listas mudam pouco durante
  uma sessão de configuração: cinco minutos de cache poupam idas repetidas ao
  voltar e avançar entre os passos.
*/
const STALE_MS = 5 * 60 * 1000

export function useDiscoveredProjects(): UseQueryResult<DiscoveredProject[], Error> {
  return useQuery({
    queryKey: ['discovery', 'projects'],
    queryFn: () => ipc.discoverProjects(),
    staleTime: STALE_MS
  })
}

export function useDiscoveredTeams(project: string): UseQueryResult<DiscoveredTeam[], Error> {
  return useQuery({
    queryKey: ['discovery', 'teams', project],
    queryFn: () => ipc.discoverTeams(project),
    staleTime: STALE_MS
  })
}

export function useDiscoveredAreas(project: string): UseQueryResult<DiscoveredArea, Error> {
  return useQuery({
    queryKey: ['discovery', 'areas', project],
    queryFn: () => ipc.discoverAreas(project),
    staleTime: STALE_MS
  })
}

export function useDiscoveredProcesses(
  projects: string[]
): UseQueryResult<ProcessDiscovery, Error>[] {
  return useQueries({
    queries: projects.map((project) => ({
      queryKey: ['discovery', 'process', project],
      queryFn: () => ipc.discoverProcess(project),
      staleTime: STALE_MS
    }))
  })
}

export function useDiscoveredFields(
  projects: string[]
): UseQueryResult<DiscoveredField[], Error>[] {
  return useQueries({
    queries: projects.map((project) => ({
      queryKey: ['discovery', 'fields', project],
      queryFn: () => ipc.discoverFields(project),
      staleTime: STALE_MS
    }))
  })
}
