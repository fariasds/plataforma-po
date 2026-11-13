import { readFileSync } from 'fs'
import { join } from 'path'
import { AppError } from '@shared/errors'
import { writeFileAtomic } from './atomic-write'
import { workDataDir } from './paths'

/**
 * Dados de trabalho: o que nasce do uso do app (itens manuais do Planning,
 * capacidade, planejamento). Um arquivo JSON por chave em `dados/`.
 *
 * A chave vem do renderer, então é validada antes de virar nome de arquivo:
 * o alfabeto fechado não tem barra, ponto nem letra de unidade, e `../x` não
 * passa. RN-CFG-08: dado que depende de Produto ou Grupo usa o **ID** dele na
 * chave (ver `workDataKey`), nunca o nome, que o PO pode trocar.
 */

export const WORK_DATA_KEY_PATTERN = /^[a-z0-9:_-]{1,120}$/
export const MAX_WORK_DATA_BYTES = 1024 * 1024

function assertKey(key: string): string {
  if (typeof key !== 'string' || !WORK_DATA_KEY_PATTERN.test(key)) {
    throw new AppError(
      'WORK_DATA_INVALID_KEY',
      'Chave de Dados de trabalho inválida: use só letras minúsculas, números, ":", "_" ou "-" (até 120).'
    )
  }
  return key
}

/**
 * `:` não é válido em nome de arquivo no Windows. `encodeURIComponent` troca
 * por `%3A`; como `%` não está no alfabeto da chave, chaves diferentes nunca
 * caem no mesmo arquivo.
 */
function fileFor(profileId: string, key: string): string {
  return join(workDataDir(profileId), `${encodeURIComponent(assertKey(key))}.json`)
}

/**
 * Chave de dado que pertence a um Produto ou Grupo: `<escopo>:<id>`.
 *
 * O ID vai em minúsculas porque o alfabeto da chave é minúsculo — e porque o
 * sistema de arquivos do Windows não distingue caixa. Dois IDs que só diferem
 * em maiúsculas dividiriam os mesmos dados de qualquer jeito.
 */
export function workDataKey(scope: string, id: string): string {
  return assertKey(`${scope}:${id.toLowerCase()}`)
}

/** Valor guardado, ou `null` se a chave nunca foi gravada. */
export function readWorkData(profileId: string, key: string): unknown {
  const file = fileFor(profileId, key)
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new AppError(
      'WORK_DATA_CORRUPT',
      `O arquivo de Dados de trabalho "${key}" está corrompido e não foi lido.`
    )
  }
}

export function writeWorkData(profileId: string, key: string, value: unknown): void {
  const file = fileFor(profileId, key)
  const text = JSON.stringify(value)
  if (text === undefined) {
    throw new AppError('WORK_DATA_INVALID_VALUE', 'O valor não pode ser convertido em JSON.')
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_WORK_DATA_BYTES) {
    throw new AppError('WORK_DATA_INVALID_VALUE', `Os Dados de trabalho "${key}" passam de 1 MB.`)
  }
  writeFileAtomic(file, text)
}
