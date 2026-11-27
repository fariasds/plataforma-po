import { existsSync, lstatSync, readFileSync, readdirSync } from 'fs'
import { join, relative, sep } from 'path'
import { ARTIFACT_FILES, parseFeatureFolder, type FeatureFolderFiles } from '@shared/flow-artifacts'
import type { FeatureFolderInput } from '@shared/flow-board'
import { lastModified } from './file-times'

/**
 * Lê `features/` da pasta de trabalho (ADR 0013): uma subpasta por Feature, e de
 * cada uma só os quatro arquivos que o app reconhece (RN-FLX-04). Não grava nada.
 */

export const FEATURES_DIR = 'features'

/** Um artefato maior que isto não é lido: ninguém escreve um Brief de 1 MB. */
const MAX_ARTIFACT_BYTES = 1024 * 1024
const MAX_LISTED_FILES = 500

function readArtifact(file: string): string | null {
  try {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.size > MAX_ARTIFACT_BYTES) return null
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** Arquivos da pasta da Feature, relativos a ela, sem seguir link simbólico. */
function listFiles(dir: string): string[] {
  const result: string[] = []
  const walk = (current: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      return
    }
    for (const name of entries) {
      if (result.length >= MAX_LISTED_FILES) return
      const full = join(current, name)
      let stat
      try {
        stat = lstatSync(full)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) walk(full)
      else if (stat.isFile()) result.push(relative(dir, full).split(sep).join('/'))
    }
  }
  walk(dir)
  return result.sort()
}

export function readFeatureFolders(workFolder: string): FeatureFolderInput[] {
  const root = join(workFolder, FEATURES_DIR)
  if (!existsSync(root)) return []
  let names: string[]
  try {
    names = readdirSync(root)
  } catch {
    return []
  }
  return names
    .filter((name) => !name.startsWith('_') && !name.startsWith('.'))
    .filter((name) => {
      try {
        const stat = lstatSync(join(root, name))
        return stat.isDirectory() && !stat.isSymbolicLink()
      } catch {
        return false
      }
    })
    .sort()
    .map((slug) => {
      const dir = join(root, slug)
      const files: FeatureFolderFiles = {
        slug,
        files: listFiles(dir),
        readme: readArtifact(join(dir, ARTIFACT_FILES.readme)),
        brief: readArtifact(join(dir, ARTIFACT_FILES.brief)),
        decisions: readArtifact(join(dir, ARTIFACT_FILES.decisions)),
        plan: readArtifact(join(dir, ARTIFACT_FILES.plan))
      }
      return { folder: parseFeatureFolder(files), lastModified: lastModified(dir) }
    })
}
