import type { SeenMemory } from '@shared/release-notes'

/**
 * Memória da última versão vista (`RN-HOM-04`): preferência desta máquina, como o
 * menu recolhido. Não leva o ID do Perfil, porque quem atualizou foi o app da
 * máquina, não um Perfil; e a demonstração nem lê nem grava.
 *
 * Leitura e escrita protegidas: sem armazenamento, o modal só não lembra.
 */
const KEY = 'plataforma-po.novidades.ultima-vista'

/** Os primeiros passos (`RN-HOM-03`) existem desde a 1.0.0: sinal de que o app já era usado. */
const FIRST_STEPS_PREFIX = 'plataforma-po.primeiros-passos.'

export function readSeen(): SeenMemory {
  try {
    const lastSeen = localStorage.getItem(KEY) ?? undefined
    let usedBefore = false
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(FIRST_STEPS_PREFIX)) usedBefore = true
    }
    return { lastSeen, usedBefore }
  } catch {
    // Sem armazenamento, trata como instalação nova: melhor não abrir do que abrir sempre.
    return { usedBefore: false }
  }
}

export function markSeen(version: string): void {
  try {
    localStorage.setItem(KEY, version)
  } catch {
    // Sem armazenamento disponível: vale só para esta sessão.
  }
}
