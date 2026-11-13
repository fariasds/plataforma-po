import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { randomBytes } from 'crypto'

/**
 * Grava num temporário ao lado e troca por `rename`. Quem lê — o app, o
 * observador do arquivo ou a IA do PO — vê o arquivo antigo ou o novo inteiro,
 * nunca um pela metade depois de uma queda no meio da gravação.
 */
export function writeFileAtomic(file: string, content: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  try {
    writeFileSync(temp, content)
    renameSync(temp, file)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}
