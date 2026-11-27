import { existsSync, readFileSync, realpathSync, statSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import { app } from 'electron'
import { AppError } from '@shared/errors'
import { writeFileAtomic } from './atomic-write'
import { workFoldersPath } from './paths'

/**
 * A pasta de trabalho de cada Produto (RN-FLX-03, ADR 0013): onde moram o Brief,
 * as Decisões, o Plano de PBIs e o catálogo. O caminho é desta máquina, e por isso
 * não entra na Configuração, que se compartilha.
 *
 * RN-SEC-36: quem escolhe a pasta é o PO, no diálogo do sistema. Nenhum caminho
 * vem da janela, e o arquivo fica fora de `dados/`, onde a janela não grava. A IA do
 * PO vai gravar nesta pasta: ela nunca pode ser a pasta de dados do app, nem ficar
 * dentro dela.
 */

interface StoredFolders {
  version: 1
  folders: Record<string, string>
}

function read(profileId: string): StoredFolders {
  const file = workFoldersPath(profileId)
  if (!existsSync(file)) return { version: 1, folders: {} }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<StoredFolders>
    const folders: Record<string, string> = {}
    for (const [id, path] of Object.entries(parsed.folders ?? {})) {
      if (typeof path === 'string') folders[id] = path
    }
    return { version: 1, folders }
  } catch {
    // Arquivo estragado não derruba o app: as pastas voltam a não estar escolhidas.
    return { version: 1, folders: {} }
  }
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** O caminho real, com o link simbólico resolvido; o próprio caminho se ainda não existe. */
function real(path: string): string {
  try {
    return realpathSync.native(path)
  } catch {
    return resolve(path)
  }
}

/**
 * Confere a pasta que o PO escolheu. Recusa caminho relativo, o que não é pasta e
 * qualquer lugar dentro da pasta de dados do app (Perfis, cofre do PAT).
 */
export function assertWorkFolder(path: string): string {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw new AppError('WORK_FOLDER_INVALID', 'Escolha uma pasta pelo diálogo do sistema.')
  }
  const target = real(path)
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new AppError('WORK_FOLDER_INVALID', 'A pasta escolhida não existe.')
  }
  const userData = real(app.getPath('userData'))
  if (inside(target, userData) || inside(userData, target)) {
    throw new AppError(
      'WORK_FOLDER_INVALID',
      'A pasta de trabalho não pode ser a pasta de dados do app, nem ficar dentro dela ou contê-la. Escolha uma pasta sua, como Documentos.'
    )
  }
  return target
}

/** A pasta do Produto, ou `null` se o PO ainda não escolheu. Não confere se ela existe. */
export function getWorkFolder(profileId: string, productId: string): string | null {
  return read(profileId).folders[productId] ?? null
}

export function getWorkFolders(profileId: string): Record<string, string> {
  return read(profileId).folders
}

export function setWorkFolder(profileId: string, productId: string, path: string): string {
  const folder = assertWorkFolder(path)
  const stored = read(profileId)
  stored.folders[productId] = folder
  writeFileAtomic(workFoldersPath(profileId), JSON.stringify(stored, null, 2) + '\n')
  return folder
}

export function clearWorkFolder(profileId: string, productId: string): void {
  const stored = read(profileId)
  if (!(productId in stored.folders)) return
  delete stored.folders[productId]
  writeFileAtomic(workFoldersPath(profileId), JSON.stringify(stored, null, 2) + '\n')
}
