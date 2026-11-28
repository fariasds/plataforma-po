import { lstatSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Última alteração de um arquivo dentro de uma pasta, para o "parada há N dias"
 * (RN-FLX-11). Separado do leitor para a regressão fixar as datas: num checkout,
 * a data dos arquivos é a do clone.
 */

/** Teto de entradas visitadas: `apoio/` pode ter muito material. */
const MAX_ENTRIES = 2000

export function lastModified(dir: string): number | null {
  let latest: number | null = null
  let visited = 0
  const walk = (current: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      return
    }
    for (const name of entries) {
      if (++visited > MAX_ENTRIES) return
      const full = join(current, name)
      let stat
      try {
        stat = lstatSync(full)
      } catch {
        continue
      }
      // Link simbólico não é seguido: ele pode apontar para fora da pasta.
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) walk(full)
      else if (stat.isFile()) latest = Math.max(latest ?? 0, stat.mtimeMs)
    }
  }
  walk(dir)
  return latest
}
