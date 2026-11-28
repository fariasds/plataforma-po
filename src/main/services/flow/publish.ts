import { BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { AppError } from '@shared/errors'
import { ABSORB_FILE, filesToPublish, pageFile, type AbsorbBase } from '@shared/flow-absorb'
import { contentHash } from '@shared/flow-catalog'
import { writeFileAtomic } from '../../profile/atomic-write'
import { requireActiveProfile, setWikiPublish } from '../../profile/profile-store'
import { fetchWikiPage, putWikiPage } from '../azure/client'
import { wikiCatalog } from './absorb'

/**
 * Publicação do catálogo na wiki (ADR 0016): a única escrita do app no Azure. Ligada
 * por Perfil (RN-SEC-39), só para páginas do catálogo (RN-SEC-40), com a confirmação
 * do PO num diálogo do sistema aberto pelo processo principal (RN-SEC-41) e recusada
 * se a página mudou na wiki desde a absorção (RN-CAT-07).
 */

export interface PublishResult {
  /** O PO cancelou no diálogo: nada saiu. */
  cancelled: boolean
  /** Caminhos de página gravados na wiki, na ordem. */
  published: string[]
}

/** Pergunta ao PO num diálogo que a janela não desenha. `true` só no botão de confirmar. */
export type Confirm = (input: {
  message: string
  detail: string
  confirm: string
}) => Promise<boolean>

export const confirmInMain: Confirm = async ({ message, detail, confirm }) => {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [confirm, 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Plataforma do PO',
    message,
    detail
  }
  const window = BrowserWindow.getFocusedWindow()
  const result = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
  return result.response === 0
}

/**
 * Ligar a publicação pede a confirmação do sistema, porque a partir dela o PAT do
 * Perfil passa a poder escrever na wiki. Desligar não pede.
 */
export async function setWikiPublishing(
  enabled: boolean,
  confirm: Confirm = confirmInMain
): Promise<boolean> {
  requireActiveProfile()
  if (enabled) {
    const ok = await confirm({
      message: 'Ligar a publicação do catálogo na wiki?',
      detail:
        'Com ela ligada, o app passa a gravar páginas do catálogo na wiki do Azure DevOps, sempre depois de você confirmar a lista neste diálogo. Use um token com escrita na wiki; a publicação não grava em nenhum outro lugar.',
      confirm: 'Ligar'
    })
    if (!ok) return requireActiveProfile().wikiPublish
  }
  return setWikiPublish(enabled).wikiPublish
}

/** O caminho da página na wiki de um arquivo do catálogo: o da absorção, ou o novo. */
function pagePathOf(file: string, rootPage: string, base: AbsorbBase | null): string {
  const known = Object.entries(base?.pages ?? {}).find(([, p]) => p.file === file)
  if (known) return known[0]
  const path = `${rootPage.replace(/\/+$/, '')}/${file.replace(/\.md$/i, '')}`
  // Só publica arquivo cujo nome volta ao mesmo caminho: nada de nome que a absorção mudaria.
  if (pageFile(rootPage, path) !== file) {
    throw new AppError('CATALOG_INVALID', `O arquivo ${file} não tem um nome de página válido.`)
  }
  return path
}

export async function publishCatalog(
  productId: string,
  files: string[],
  confirm: Confirm = confirmInMain
): Promise<PublishResult> {
  if (!requireActiveProfile().wikiPublish) {
    throw new AppError('WIKI_PUBLISH_OFF', 'A publicação na wiki está desligada neste Perfil.')
  }
  const catalog = wikiCatalog(productId)
  const pending = new Set(filesToPublish(catalog.files, catalog.base))
  const chosen = [...new Set(files)].sort()
  if (chosen.length === 0 || chosen.some((file) => !pending.has(file))) {
    throw new AppError('CATALOG_INVALID', 'Escolha as páginas pela lista do que falta publicar.')
  }

  const base = `/${encodeURIComponent(catalog.project)}/_apis/wiki/wikis/${encodeURIComponent(catalog.wiki)}/pages`
  const pages = chosen.map((file) => ({
    file,
    path: pagePathOf(file, catalog.rootPage, catalog.base)
  }))

  // RN-CAT-07: a página na wiki tem de ser a mesma da última absorção.
  const current = await Promise.all(
    pages.map((p) =>
      fetchWikiPage(
        `${base}?path=${encodeURIComponent(p.path)}&includeContent=true&api-version=7.1`
      )
    )
  )
  const conflicts = pages.filter((p, i) => {
    const wiki = current[i]
    const absorbed = catalog.base?.pages[p.path]
    if (!absorbed) return wiki !== null
    return wiki === null || contentHash(wiki.content) !== absorbed.hash
  })
  if (conflicts.length > 0) {
    throw new AppError(
      'CATALOG_CONFLICT',
      `Mudou na wiki desde a absorção: ${conflicts.map((p) => p.path).join(', ')}. Absorva de novo antes de publicar.`
    )
  }

  const ok = await confirm({
    message: `Publicar ${pages.length === 1 ? '1 página' : `${pages.length} páginas`} na wiki ${catalog.wiki}?`,
    detail: pages
      .map((p) => `${current[pages.indexOf(p)] ? 'Atualizar' : 'Criar'}: ${p.path}`)
      .join('\n'),
    confirm: 'Publicar'
  })
  if (!ok) return { cancelled: true, published: [] }

  const next: AbsorbBase = catalog.base
    ? structuredClone(catalog.base)
    : {
        version: 1,
        absorbedAt: new Date().toISOString(),
        source: { wiki: catalog.wiki, rootPage: catalog.rootPage },
        pages: {}
      }
  const published: string[] = []
  try {
    for (const [i, page] of pages.entries()) {
      const content = catalog.files[page.file]
      await putWikiPage(productId, page.path, content, current[i]?.etag ?? null)
      // O que foi publicado vira a nova base: a página deixa de estar "A publicar".
      next.pages[page.path] = { file: page.file, hash: contentHash(content) }
      published.push(page.path)
    }
  } finally {
    if (published.length > 0) {
      writeFileAtomic(join(catalog.dir, ABSORB_FILE), JSON.stringify(next, null, 2) + '\n')
    }
  }
  return { cancelled: false, published }
}
