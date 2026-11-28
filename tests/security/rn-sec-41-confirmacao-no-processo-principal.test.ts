import { cpSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'

// RN-SEC-41: nada é publicado sem o PO confirmar num diálogo do sistema que o
// processo principal abre, com a lista das páginas. A janela só escolhe o que pedir:
// nenhum argumento do IPC dispensa o diálogo. Dados fictícios: o Cenário `fluxo-do-po`.

const state = vi.hoisted(() => ({ config: null as Configuration | null }))

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('../../src/main/profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/main/profile/config-loader')>()),
  getActiveConfig: () => state.config
}))

const mock = await import('../helpers/electron-mock')
const { fluxoDoPo } = await import('../../src/main/demo/scenarios/fluxo-do-po')
const { createFakeAzure } = await import('../../src/main/demo/fake-azure')
let fake = createFakeAzure(fluxoDoPo.azure)
vi.mock('../../src/main/services/azure/client', () => ({
  fetchAzure: (path: string) => fake.fetchAzure(path),
  fetchWikiPage: (path: string) => fake.fetchWikiPage(path),
  putWikiPage: (_productId: string, pagePath: string, content: string, etag: string | null) =>
    fake.putWikiPage(
      `/Contoso/_apis/wiki/wikis/Contoso.wiki/pages?path=${encodeURIComponent(pagePath)}&api-version=7.1`,
      content,
      etag
    )
}))

const store = await import('../../src/main/profile/profile-store')
const folders = await import('../../src/main/profile/work-folders')
const { publishCatalog } = await import('../../src/main/services/flow/publish')

const FIXTURE = resolve(__dirname, '../regression/pastas/fluxo-do-po/loja')
const ROOT = resolve(__dirname, '../..')
const NEW_PAGE = 'Rascunho de frete.md'
let root = ''

const puts = (): number => fake.calls.filter((c) => c.method === 'PUT').length

beforeEach(() => {
  mock.resetElectronMock()
  fake = createFakeAzure(fluxoDoPo.azure)
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  const profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  store.setWikiPublish(true)
  root = mkdtempSync(join(tmpdir(), 'pasta-do-po-'))
  cpSync(FIXTURE, root, { recursive: true })
  folders.setWorkFolder(profileId, 'loja', root)
})

describe('RN-SEC-41: a confirmação é do processo principal', () => {
  it('o diálogo do sistema mostra a lista; cancelar não publica nada', async () => {
    mock.setMessageBoxResponse(1)
    const base = readFileSync(join(root, 'catalogo/.absorcao.json'), 'utf8')
    await expect(publishCatalog('loja', [NEW_PAGE])).resolves.toEqual({
      cancelled: true,
      published: []
    })
    const [call] = mock.getMessageBoxCalls() as Array<[{ detail: string }]>
    expect(call[0].detail).toContain('Criar: /Catálogo/Loja/Rascunho de frete')
    expect(puts()).toBe(0)
    expect(readFileSync(join(root, 'catalogo/.absorcao.json'), 'utf8')).toBe(base)
  })

  it('confirmado no diálogo, publica e a página deixa de estar a publicar', async () => {
    mock.setMessageBoxResponse(0)
    const result = await publishCatalog('loja', [NEW_PAGE])
    expect(result.published).toEqual(['/Catálogo/Loja/Rascunho de frete'])
    expect(puts()).toBe(1)
    const base = JSON.parse(readFileSync(join(root, 'catalogo/.absorcao.json'), 'utf8'))
    expect(base.pages['/Catálogo/Loja/Rascunho de frete'].file).toBe(NEW_PAGE)
  })

  it('o handler de IPC não repassa nada que dispense o diálogo', () => {
    const handler = readFileSync(join(ROOT, 'src/main/ipc/publish-handlers.ts'), 'utf8')
    expect(handler).not.toMatch(/confirm/i)
    const service = readFileSync(join(ROOT, 'src/main/services/flow/publish.ts'), 'utf8')
    // O diálogo é o padrão do serviço, e o diálogo padrão é o do Electron, no main.
    expect(service).toMatch(/files: string\[\],\s*confirm: Confirm = confirmInMain/)
    expect(service).toMatch(/dialog\.showMessageBox/)
  })
})
