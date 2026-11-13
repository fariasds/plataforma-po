import { AppError } from '@shared/errors'
import { reloadProfileState } from '../profile/config-loader'
import { checkCredentials, clearAvatarCache } from '../services/azure/client'
import { clearUserProfileCache } from '../services/azure/directory'
import * as patStore from '../security/pat-store'
import { handle } from './registry'

export function registerPatHandlers(): void {
  handle('hasPat', () => patStore.hasPat())

  handle('savePat', async (pat) => {
    const value = pat.trim()
    if (!value) {
      throw new AppError('PAT_MISSING', 'Informe o token.')
    }

    // RN-SEC-27: com a demonstração ativa, recusa antes de o token sair da máquina.
    patStore.assertPatAllowed()

    // Validate before storing, so a token that cannot work never gets saved —
    // otherwise the app would open on the dashboard and fail there instead.
    await checkCredentials(value)
    patStore.savePat(value)
    // Os caches guardam falhas: sem limpar, um token com mais escopo herdaria os
    // `null` do anterior e nem foto nem perfil seriam buscados de novo.
    clearAvatarCache()
    clearUserProfileCache()
    // O estado do Perfil depende do PAT (`needs-pat` → `ready`).
    reloadProfileState()
  })

  handle('clearPat', () => {
    patStore.clearPat()
    clearAvatarCache()
    clearUserProfileCache()
    reloadProfileState()
  })
}
