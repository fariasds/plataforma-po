import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { CreateProfileRequest, ImportConfigResult, ProfileState } from '@shared/ipc'
import { ipc, ipcEvents } from './client'

export const PROFILE_QUERY_KEY = ['profile', 'state']

/**
 * Estado do Perfil ativo, mantido em dia pelo aviso do main.
 *
 * Quando a Configuração em uso muda — edição no arquivo, importação, troca de
 * Perfil —, **todas** as outras queries são invalidadas: qualquer resultado em
 * cache pode ter sido calculado com Produtos, estados ou calendário antigos.
 */
export function useProfileState(): UseQueryResult<ProfileState, Error> {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      ipcEvents.onProfileStateChanged((next) => {
        const previous = queryClient.getQueryData<ProfileState>(PROFILE_QUERY_KEY)
        queryClient.setQueryData(PROFILE_QUERY_KEY, next)
        if (JSON.stringify(previous?.config) !== JSON.stringify(next.config)) {
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] !== PROFILE_QUERY_KEY[0]
          })
        }
      }),
    [queryClient]
  )

  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => ipc.getProfileState(),
    // Quem atualiza é o aviso do main; refazer a leitura sozinho não traria nada novo.
    staleTime: Infinity
  })
}

/** Cria o Perfil. O main valida o PAT antes; token recusado não cria nada. */
export function useCreateProfile(): ReturnType<
  typeof useMutation<ProfileState, Error, CreateProfileRequest>
> {
  const queryClient = useQueryClient()

  return useMutation<ProfileState, Error, CreateProfileRequest>({
    mutationFn: (input) => ipc.createProfile(input),
    onSuccess: (state) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, state)
      queryClient.invalidateQueries()
    }
  })
}

/**
 * O Perfil ativo é o de demonstração (RN-GLB-15)? Só para a interface: mostrar a
 * faixa e esconder o que não se aplica. Quem escolhe o caminho dos dados é o main
 * (RN-SEC-27). Lê o mesmo cache do `useProfileState`, sem assinar o aviso de novo.
 */
export function useIsDemo(): boolean {
  return useCachedProfileState()?.profile?.kind === 'demo'
}

/** Já existe o Perfil com Azure de verdade? Decide entre criar um e voltar para ele. */
export function useHasAzureProfile(): boolean {
  return useCachedProfileState()?.hasAzureProfile ?? false
}

function useCachedProfileState(): ProfileState | undefined {
  const { data } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => ipc.getProfileState(),
    staleTime: Infinity
  })
  return data
}

/** Entra na demonstração. Tudo em cache era do Perfil anterior. */
export function useStartDemo(): ReturnType<typeof useMutation<ProfileState, Error, void>> {
  const queryClient = useQueryClient()
  return useMutation<ProfileState, Error, void>({
    mutationFn: () => ipc.startDemo(),
    onSuccess: (state) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, state)
      queryClient.invalidateQueries()
    }
  })
}

/** Sai da demonstração para o Perfil com o Azure de verdade. */
export function useLeaveDemo(): ReturnType<typeof useMutation<ProfileState, Error, void>> {
  const queryClient = useQueryClient()
  return useMutation<ProfileState, Error, void>({
    mutationFn: () => ipc.leaveDemo(),
    onSuccess: (state) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, state)
      queryClient.invalidateQueries()
    }
  })
}

/** Volta a demonstração aos dados do Cenário; os Dados de trabalho somem. */
export function useRestoreDemo(): ReturnType<typeof useMutation<ProfileState, Error, void>> {
  const queryClient = useQueryClient()
  return useMutation<ProfileState, Error, void>({
    mutationFn: () => ipc.restoreDemo(),
    onSuccess: (state) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, state)
      queryClient.invalidateQueries()
    }
  })
}

export function useImportConfig(): ReturnType<
  typeof useMutation<ImportConfigResult, Error, string>
> {
  return useMutation<ImportConfigResult, Error, string>({
    mutationFn: (json) => ipc.importConfig(json)
  })
}

export function useOpenProfileFolder(): ReturnType<typeof useMutation<void, Error, void>> {
  return useMutation<void, Error, void>({ mutationFn: () => ipc.openProfileFolder() })
}

/** Dados de trabalho de uma chave; `null` quando nunca foram gravados. */
export function useWorkData<T>(key: string): UseQueryResult<T | null, Error> {
  return useQuery({
    queryKey: ['work-data', key],
    queryFn: async () => (await ipc.readWorkData(key)) as T | null
  })
}

export function useWriteWorkData<T>(key: string): ReturnType<typeof useMutation<void, Error, T>> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, T>({
    mutationFn: (value) => ipc.writeWorkData(key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-data', key] })
  })
}
