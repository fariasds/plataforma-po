import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Squad } from '@shared/config/schema'
import { ipc } from './client'
import { PROFILE_QUERY_KEY } from './useProfile'

/**
 * Squad aberta na janela (RN-GLB-17). É uma só para o app inteiro, como a aba de
 * um navegador: trocar de tela não troca de Squad.
 *
 * Preferência de interface desta máquina, como o menu recolhido: lembrar a
 * última aba não justifica um Dado de trabalho. Leitura e escrita protegidas —
 * sem armazenamento, a aba só não é lembrada ao reabrir.
 */
const ACTIVE_SQUAD_KEY = 'plataforma-po.squad-ativa'

function readStored(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SQUAD_KEY)
  } catch {
    return null
  }
}

let chosen: string | null = readStored()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setActiveSquad(id: string): void {
  chosen = id
  try {
    localStorage.setItem(ACTIVE_SQUAD_KEY, id)
  } catch {
    // Sem armazenamento disponível: a escolha vale só para esta sessão.
  }
  listeners.forEach((listener) => listener())
}

/**
 * A Squad aberta, ou `null` quando a Configuração não tem Squads. A lembrada
 * que sumiu da Configuração (ou é de outro Perfil) cede lugar à primeira.
 */
export function useActiveSquad(): Squad | null {
  // O mesmo cache do `useActiveConfig`; importá-lo daqui fecharia um ciclo com useAzure.
  const { data } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => ipc.getProfileState(),
    staleTime: Infinity
  })
  const id = useSyncExternalStore(subscribe, () => chosen)
  const squads = data?.config?.squads ?? []
  if (squads.length === 0) return null
  return squads.find((s) => s.id === id) ?? squads[0]
}
