import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { ipc } from './client'
import { PROFILE_QUERY_KEY } from './useProfile'

const PAT_QUERY_KEY = ['pat', 'has']

export function useHasPat(): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: PAT_QUERY_KEY,
    queryFn: () => ipc.hasPat(),
    staleTime: 0
  })
}

/**
 * Saves the PAT. The main process validates it against Azure first, so a
 * rejected token surfaces here as an error and nothing gets stored.
 */
export function useSavePat(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (pat) => ipc.savePat(pat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAT_QUERY_KEY })
      // O estado do Perfil sai de `needs-pat`; não espera o aviso do main.
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
    }
  })
}

export function useClearPat(): ReturnType<typeof useMutation<void, Error, void>> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: () => ipc.clearPat(),
    // Azure data cached under the old token must not survive the swap.
    onSuccess: () => queryClient.invalidateQueries()
  })
}
