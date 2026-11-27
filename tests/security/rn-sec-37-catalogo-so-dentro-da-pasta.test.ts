import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { pageFile } from '@shared/flow-absorb'

// RN-SEC-37: o que vem da wiki só é gravado dentro de catalogo/. O nome do arquivo
// sai do caminho da página, que quem edita a wiki escolhe, e da base da absorção,
// que fica na pasta do PO. Dados fictícios: o Cenário `fluxo-do-po`.

const state = vi.hoisted(() => ({ config: null as Configuration | null }))

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('../../src/main/profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/main/profile/config-loader')>()),
  getActiveConfig: () => state.config
}))

const mock = await import('../helpers/electron-mock')
const { fluxoDoPo } = await import('../../src/main/demo/scenarios/fluxo-do-po')
const { createFakeAzure } = await import('../../src/main/demo/fake-azure')
const fake = createFakeAzure(fluxoDoPo.azure)
vi.mock('../../src/main/services/azure/client', () => ({
  fetchAzure: (path: string) => fake.fetchAzure(path)
}))

const store = await import('../../src/main/profile/profile-store')
const folders = await import('../../src/main/profile/work-folders')
const { absorbCatalog } = await import('../../src/main/services/flow/absorb')

const FIXTURE = resolve(__dirname, '../regression/pastas/fluxo-do-po/loja')
let root = ''

beforeEach(() => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  const profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  root = mkdtempSync(join(tmpdir(), 'pasta-do-po-'))
  cpSync(FIXTURE, root, { recursive: true })
  folders.setWorkFolder(profileId, 'loja', root)
})

describe('RN-SEC-37: o que vem da wiki só é gravado dentro de catalogo/', () => {
  it('caminho de página que sobe ou desce para fora da raiz não vira arquivo', () => {
    expect(pageFile('/Catálogo/Loja', '/Catálogo/Loja/../../segredos')).toBeNull()
    expect(pageFile('/Catálogo/Loja', '/Catálogo/Loja/./x')).toBeNull()
    expect(pageFile('/Catálogo/Loja', '/Catálogo/Loja/a\\..\\..\\b')).not.toContain('\\')
  })

  it.each([
    ['que sobe da pasta', () => '../fora.md'],
    // Uma pasta nova a cada vez: a prova de falha grava de verdade fora da pasta.
    ['absoluto', () => join(mkdtempSync(join(tmpdir(), 'fora-')), 'fora-absoluto.md')],
    ['que não é Markdown', () => 'Pagamentos.exe']
  ])('a base da absorção com caminho %s é recusada, e nada é gravado', async (_case, pathOf) => {
    const file = pathOf()
    const basePath = join(root, 'catalogo', '.absorcao.json')
    const base = JSON.parse(readFileSync(basePath, 'utf8'))
    // A página mudou na wiki: a absorção tentaria gravar no caminho da base.
    base.pages['/Catálogo/Loja/Pagamentos'].file = file
    writeFileSync(basePath, JSON.stringify(base))
    const entregas = join(root, 'catalogo', 'Entregas.md')

    // O PO escolhe a versão da wiki: a absorção tenta gravar no caminho da base.
    await expect(absorbCatalog('loja', ['/Catálogo/Loja/Pagamentos'])).rejects.toMatchObject({
      code: 'CATALOG_INVALID'
    })
    expect(existsSync(join(root, 'fora.md'))).toBe(false)
    expect(existsSync(resolve(root, 'catalogo', file))).toBe(false)
    // Ou entra tudo, ou nada: a página nova também não foi gravada.
    expect(existsSync(entregas)).toBe(false)
  })
})
