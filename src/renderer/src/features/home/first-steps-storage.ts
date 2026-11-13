import { FIRST_STEPS, type FirstStep, type FirstStepsMemory } from '@shared/home'

/**
 * Memória dos primeiros passos (`RN-HOM-03`): preferência desta máquina, como o
 * menu recolhido, e não Dados de trabalho — não é dado de Produto nem algo que a
 * IA do PO precise ler. A chave leva o ID do Perfil para a demonstração não
 * marcar como visto o que o Perfil real nunca abriu.
 *
 * Leitura e escrita protegidas: sem armazenamento, a lista só não lembra.
 */
const PREFIX = 'plataforma-po.primeiros-passos.'

function keyFor(profileId: string): string {
  return PREFIX + profileId
}

export function readFirstSteps(profileId: string | undefined): FirstStepsMemory {
  if (!profileId) return { visited: [] }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(profileId)) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return { visited: [] }
    const { visited, showList } = parsed as Record<string, unknown>
    return {
      visited: Array.isArray(visited)
        ? visited.filter((s): s is FirstStep => FIRST_STEPS.includes(s as FirstStep))
        : [],
      showList: typeof showList === 'boolean' ? showList : undefined
    }
  } catch {
    return { visited: [] }
  }
}

function write(profileId: string, memory: FirstStepsMemory): void {
  try {
    localStorage.setItem(keyFor(profileId), JSON.stringify(memory))
  } catch {
    // Sem armazenamento disponível: vale só para esta sessão.
  }
}

export function recordVisit(profileId: string | undefined, step: FirstStep): void {
  if (!profileId) return
  const memory = readFirstSteps(profileId)
  if (memory.visited.includes(step)) return
  write(profileId, { ...memory, visited: [...memory.visited, step] })
}

export function setShowList(profileId: string | undefined, showList: boolean): void {
  if (!profileId) return
  write(profileId, { ...readFirstSteps(profileId), showList })
}
