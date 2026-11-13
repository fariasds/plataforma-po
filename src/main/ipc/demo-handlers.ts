import { reloadProfileState } from '../profile/config-loader'
import { leaveDemoProfile, restoreDemoProfile, startDemoProfile } from '../profile/profile-store'
import { clearAvatarCache } from '../services/azure/client'
import { clearUserProfileCache } from '../services/azure/directory'
import { handle } from './registry'

/**
 * Perfil de demonstração (RN-GLB-15). Nenhum deles recebe argumento: entrar
 * na demonstração só muda o Perfil ativo, e é ele que o `client.ts` consulta
 * para escolher o caminho dos dados (RN-SEC-27).
 */

/** Foto e perfil do Azure em cache não atravessam a troca de Perfil (RN-SEC-27). */
function forgetCaches(): void {
  clearAvatarCache()
  clearUserProfileCache()
}

export function registerDemoHandlers(): void {
  handle('startDemo', () => {
    startDemoProfile()
    forgetCaches()
    return reloadProfileState()
  })

  handle('leaveDemo', () => {
    leaveDemoProfile()
    forgetCaches()
    return reloadProfileState()
  })

  handle('restoreDemo', () => {
    restoreDemoProfile()
    forgetCaches()
    return reloadProfileState()
  })
}
