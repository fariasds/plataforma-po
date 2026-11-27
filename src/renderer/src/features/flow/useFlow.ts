import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { AbsorbPreview, CatalogView } from '@shared/flow-absorb'
import type { FlowBoard } from '@shared/flow-board'
import type { FlowSnapshotSummary } from '@shared/flow-snapshot'
import { ipc } from '../../ipc/client'

/**
 * As consultas da tela Features. O retrato lê o Azure ao abrir a tela e no botão
 * Atualizar (RN-FLX-02); o quadro lê só o disco, e é refeito quando o retrato muda
 * ou a pasta muda.
 */

export function useFlowSnapshot(productId: string): UseQueryResult<FlowSnapshotSummary, Error> {
  return useQuery({
    queryKey: ['flow-snapshot', productId],
    enabled: productId !== '',
    queryFn: () => ipc.refreshFlowSnapshot(productId)
  })
}

export function useFlowBoard(
  productId: string,
  snapshotTakenAt: string | undefined,
  ready: boolean
): UseQueryResult<FlowBoard, Error> {
  return useQuery({
    queryKey: ['flow-board', productId, snapshotTakenAt ?? null],
    enabled: productId !== '' && ready,
    // O disco muda por fora (a IA, o editor do PO): o quadro é sempre lido de novo.
    staleTime: 0,
    queryFn: () => ipc.getFlowBoard(productId)
  })
}

export function useWorkFolders(): UseQueryResult<Record<string, string>, Error> {
  return useQuery({ queryKey: ['work-folders'], queryFn: () => ipc.getWorkFolders() })
}

function useRefreshFlow(): () => Promise<void> {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['work-folders'] })
    await queryClient.invalidateQueries({ queryKey: ['flow-board'] })
  }
}

export function useChooseWorkFolder(): ReturnType<
  typeof useMutation<string | null, Error, string>
> {
  const refresh = useRefreshFlow()
  return useMutation({
    mutationFn: (productId: string) => ipc.chooseWorkFolder(productId),
    onSuccess: refresh
  })
}

export function useLinkPlannedPbi(): ReturnType<
  typeof useMutation<FlowBoard, Error, { productId: string; slug: string; pbi: string; id: number }>
> {
  const refresh = useRefreshFlow()
  return useMutation({
    mutationFn: ({ productId, slug, pbi, id }) => ipc.linkPlannedPbi(productId, slug, pbi, id),
    onSuccess: refresh
  })
}

export function useLinkDraftFeature(): ReturnType<
  typeof useMutation<FlowBoard, Error, { productId: string; slug: string; id: number }>
> {
  const refresh = useRefreshFlow()
  return useMutation({
    mutationFn: ({ productId, slug, id }) => ipc.linkDraftFeature(productId, slug, id),
    onSuccess: refresh
  })
}

export function useCatalog(productId: string): UseQueryResult<CatalogView, Error> {
  return useQuery({
    queryKey: ['catalog', productId],
    enabled: productId !== '',
    // O PO e a IA mexem no catálogo por fora: é sempre lido de novo.
    staleTime: 0,
    queryFn: () => ipc.getCatalog(productId)
  })
}

/** A diferença da absorção: lê a wiki, então só quando o PO pede. */
export function usePreviewAbsorb(): ReturnType<typeof useMutation<AbsorbPreview, Error, string>> {
  return useMutation({ mutationFn: (productId: string) => ipc.previewCatalogAbsorb(productId) })
}

export function useAbsorbCatalog(): ReturnType<
  typeof useMutation<CatalogView, Error, { productId: string; useWiki: string[] }>
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, useWiki }) => ipc.absorbCatalog(productId, useWiki),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      // O catálogo novo pode levar uma Feature a Publicada (RN-FLX-05).
      await queryClient.invalidateQueries({ queryKey: ['flow-board'] })
    }
  })
}
