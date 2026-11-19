import { shell } from 'electron'
import { checkForUpdate, openUpdateLink } from '../services/update/release-check'
import { handle } from './registry'

/** Aviso de versão nova (RN-GLB-18, RN-SEC-33). */
export function registerUpdateHandlers(): void {
  handle('checkForUpdate', () => checkForUpdate())
  handle('openUpdateLink', (link) => openUpdateLink(link, shell.openExternal))
}
