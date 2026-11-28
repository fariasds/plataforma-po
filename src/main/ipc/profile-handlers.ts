import { setWikiPublishing } from '../services/flow/publish'
import { BrowserWindow, app, dialog, shell } from 'electron'
import { AppError } from '@shared/errors'
import { IPC_EVENTS } from '@shared/ipc'
import {
  applyProposal,
  discardProposal,
  getProfileState,
  importConfiguration,
  onProfileStateChanged,
  previewImport,
  reloadProfileState
} from '../profile/config-loader'
import { createProfile, requireActiveProfile } from '../profile/profile-store'
import { readWorkData, writeWorkData } from '../profile/work-data'
import { clearWorkFolder, getWorkFolders, setWorkFolder } from '../profile/work-folders'
import * as patStore from '../security/pat-store'
import { checkCredentials, clearAvatarCache } from '../services/azure/client'
import { clearUserProfileCache } from '../services/azure/directory'
import { activeProduct } from '../services/azure/scope'
import {
  applyInstructionProposal,
  discardInstructionProposal,
  listInstructions,
  resetInstruction
} from '../services/flow/instructions'
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

  handle('previewImport', (json, mode) => previewImport(json, mode))

  handle('importConfig', (json, mode) => importConfiguration(json, mode))

  handle('applyProposal', () => applyProposal())

  handle('discardProposal', () => discardProposal())

  // O cliente de IA inicia este mesmo executável com --mcp (ADR 0010). Em
  // desenvolvimento o executável é o do Electron, e a pasta do app vai antes.
  handle('getMcpLaunch', () => ({
    command: process.execPath,
    appArgs: app.isPackaged ? [] : [app.getAppPath()],
    profileId: requireActiveProfile().id
  }))

  handle('openProfileFolder', async () => {
    const { dir } = requireActiveProfile()
    const failure = await shell.openPath(dir)
    if (failure)
      throw new AppError('UNEXPECTED', `Não consegui abrir a pasta do Perfil: ${failure}`)
  })

  handle('readWorkData', (key) => readWorkData(requireActiveProfile().id, key))

  handle('writeWorkData', (key, value) => writeWorkData(requireActiveProfile().id, key, value))

  handle('getWorkFolders', () => getWorkFolders(requireActiveProfile().id))

  // RN-FLX-26: a IA propõe a instrução; quem aplica, descarta ou volta ao padrão é o PO.
  handle('getInstructions', () => listInstructions())
  handle('applyInstructionProposal', (name) => applyInstructionProposal(name))
  handle('discardInstructionProposal', (name) => discardInstructionProposal(name))
  handle('resetInstruction', (name) => resetInstruction(name))

  // RN-SEC-36: o caminho vem do diálogo do sistema, nunca da janela. Só o ID do
  // Produto atravessa, e ele é conferido contra a Configuração em uso.
  handle('chooseWorkFolder', async (productId) => {
    const product = activeProduct(productId)
    const profile = requireActiveProfile()
    const window = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: `Pasta de trabalho de ${product.name}`,
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return setWorkFolder(profile.id, product.id, result.filePaths[0])
  })

  // RN-SEC-39: ligar a publicação na wiki pede a confirmação do sistema, no main.
  handle('setWikiPublish', (enabled) => setWikiPublishing(enabled === true))

  handle('clearWorkFolder', (productId) =>
    clearWorkFolder(requireActiveProfile().id, activeProduct(productId).id)
  )

  onProfileStateChanged((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_EVENTS.profileStateChanged, state)
    }
  })
}
