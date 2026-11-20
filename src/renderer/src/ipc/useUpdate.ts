import { useMutation, useQuery } from '@tanstack/react-query'
import type { UpdateCheck, UpdateLink } from '@shared/update'
import { ipc } from './client'
import { useIsDemo } from './useProfile'

/**
 * Há versão nova? Uma consulta por abertura do app (RN-GLB-18): o main já guarda
 * o resultado, e aqui ele não envelhece nem é tentado de novo. Na demonstração
 * nem é pedida (RN-SEC-27).
 */
export function useUpdateCheck(): UpdateCheck | undefined {
  const isDemo = useIsDemo()
  const query = useQuery({
    queryKey: ['update-check'],
    queryFn: () => ipc.checkForUpdate(),
    enabled: !isDemo,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false
  })
  return isDemo ? undefined : query.data
}

/** Abre no navegador a página ou o instalador da versão nova (RN-SEC-21). */
export function useOpenUpdateLink(): ReturnType<typeof useMutation<void, Error, UpdateLink>> {
  return useMutation<void, Error, UpdateLink>({
    mutationFn: (link) => ipc.openUpdateLink(link)
  })
}
