import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { Configuration } from '@shared/config/schema'
import {
  buildOpportunities,
  parseBugAnalysis,
  parseOpportunityFile,
  type BugAnalysis,
  type OpportunitiesView,
  type OpportunityFile
} from '@shared/flow-opportunities'
import { getWorkFolder } from '../profile/work-folders'
import { storedSnapshot } from './board'
import { productOf } from './catalog-files'

/**
 * As oportunidades de um Produto (RN-FLX-14 a RN-FLX-16, RN-FLX-25): o retrato do
 * Azure mais `oportunidades/` e `bugs/` da pasta de trabalho. Só leitura; a janela e
 * o servidor MCP chamam daqui.
 */

export const OPPORTUNITIES_DIR = 'oportunidades'
export const BUGS_DIR = 'bugs'

const MAX_FILES = 500
const MAX_FILE_BYTES = 1024 * 1024

/** Os Markdown do primeiro nível da pasta, sem link simbólico e sem arquivo começado por ponto. */
export function readMarkdownFiles(dir: string): Array<{ file: string; text: string }> {
  if (!existsSync(dir)) return []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => !name.startsWith('.') && name.toLowerCase().endsWith('.md'))
    .sort()
    .slice(0, MAX_FILES)
    .flatMap((name) => {
      try {
        const stat = lstatSync(join(dir, name))
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return []
        return [{ file: name, text: readFileSync(join(dir, name), 'utf8') }]
      } catch {
        return []
      }
    })
}

export function readBugAnalyses(root: string): BugAnalysis[] {
  return readMarkdownFiles(join(root, BUGS_DIR)).map(({ file, text }) =>
    parseBugAnalysis(`${BUGS_DIR}/${file}`, text)
  )
}

export function opportunitiesView(
  config: Configuration,
  profileId: string,
  productId: string
): OpportunitiesView {
  const product = productOf(config, productId)
  const root = getWorkFolder(profileId, product.id)
  const workFolder =
    root === null ? 'unset' : existsSync(root) && statSync(root).isDirectory() ? 'ok' : 'missing'
  const files: OpportunityFile[] =
    workFolder === 'ok'
      ? readMarkdownFiles(join(root!, OPPORTUNITIES_DIR)).map(({ file, text }) =>
          parseOpportunityFile(`${OPPORTUNITIES_DIR}/${file}`, text)
        )
      : []
  const snapshot = storedSnapshot(profileId, product.id)
  return {
    productId: product.id,
    snapshotTakenAt: snapshot?.takenAt ?? null,
    feedbackConfigured: product.poFlow.feedback !== null,
    workFolder,
    opportunities: buildOpportunities({
      snapshot,
      files,
      bugs: workFolder === 'ok' ? readBugAnalyses(root!) : [],
      link: product.poFlow.feedback?.link ?? null
    })
  }
}
