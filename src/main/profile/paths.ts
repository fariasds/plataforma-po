import { join } from 'path'
import { app } from 'electron'
import { AppError } from '@shared/errors'

/**
 * Onde cada parte do Perfil mora no disco. Tudo deriva de `userData`; nenhum
 * caminho vem do renderer — ele só conhece o ID do Perfil, e mesmo esse passa
 * pela validação abaixo antes de virar pedaço de caminho.
 *
 *   <userData>/perfis.json
 *   <userData>/perfis/<id>/configuracao.json, configuracao.schema.json, AGENTS.md, dados/
 *   <userData>/segredos/<id>.bin      ← fora da pasta do Perfil (RN-CFG-06)
 */

export const PROFILE_ID_PATTERN = /^[a-z0-9-]{1,40}$/

export const CONFIG_FILE = 'configuracao.json'
export const SCHEMA_FILE = 'configuracao.schema.json'
export const AGENTS_FILE = 'AGENTS.md'

/** Recusa qualquer coisa que não seja um slug — `..`, barra e letra de unidade incluídos. */
export function assertProfileId(profileId: string): string {
  if (typeof profileId !== 'string' || !PROFILE_ID_PATTERN.test(profileId)) {
    throw new AppError('PROFILE_INVALID', `ID de Perfil inválido: "${String(profileId)}".`)
  }
  return profileId
}

export function profilesIndexPath(): string {
  return join(app.getPath('userData'), 'perfis.json')
}

export function profilesRoot(): string {
  return join(app.getPath('userData'), 'perfis')
}

export function profileDir(profileId: string): string {
  return join(profilesRoot(), assertProfileId(profileId))
}

export function configPath(profileId: string): string {
  return join(profileDir(profileId), CONFIG_FILE)
}

export function workDataDir(profileId: string): string {
  return join(profileDir(profileId), 'dados')
}

export function secretsDir(): string {
  return join(app.getPath('userData'), 'segredos')
}

export function secretPath(profileId: string): string {
  return join(secretsDir(), `${assertProfileId(profileId)}.bin`)
}
