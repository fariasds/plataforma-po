import { BrowserWindow, shell } from 'electron'
import { AppError } from '@shared/errors'
import { IPC_EVENTS } from '@shared/ipc'
import {
  getProfileState,
  importConfiguration,
  onProfileStateChanged,
  reloadProfileState
} from '../profile/config-loader'
import { createProfile, requireActiveProfile } from '../profile/profile-store'
import { readWorkData, writeWorkData } from '../profile/work-data'
import * as patStore from '../security/pat-store'
import { checkCredentials, clearAvatarCache } from '../services/azure/client'
import { clearUserProfileCache } from '../services/azure/directory'
import { handle } from './registry'

/**
 * Nenhum destes handlers recebe caminho de arquivo: o renderer fala em Perfil
 * ativo e em chave de Dados de trabalho, e o main resolve onde isso mora.
 */
export function registerProfileHandlers(): void {
  handle('getProfileState', () => getProfileState())

  handle('createProfile', async (input) => {
    const pat = typeof input?.pat === 'string' ? input.pat.trim() : ''
    if (!pat) throw new AppError('PAT_MISSING', 'Informe o token.')

    // Tudo o que pode recusar vem antes de criar a pasta: um token inválido ou
    // um SO sem cifragem não deixam Perfil pela metade no disco.
    patStore.assertEncryptionAvailable()
    await checkCredentials(pat, input.organization)

    const profile = createProfile({ name: input.name, organization: input.organization })
    patStore.savePat(pat, profile.id)
    clearAvatarCache()
    clearUserProfileCache()
    return reloadProfileState()
  })

  handle('importConfig', (json) => importConfiguration(json))

  handle('openProfileFolder', async () => {
    const { dir } = requireActiveProfile()
    const failure = await shell.openPath(dir)
    if (failure)
      throw new AppError('UNEXPECTED', `Não consegui abrir a pasta do Perfil: ${failure}`)
  })

  handle('readWorkData', (key) => readWorkData(requireActiveProfile().id, key))

  handle('writeWorkData', (key, value) => writeWorkData(requireActiveProfile().id, key, value))

  onProfileStateChanged((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_EVENTS.profileStateChanged, state)
    }
  })
}
