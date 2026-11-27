import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import type { AbsorbBase } from '@shared/flow-absorb'

// RN-CAT-03, RN-CAT-06: absorver grava só o que veio da wiki e o PO aceitou, e a
// base da absorção anda junto. Dados fictícios: o Cenário `fluxo-do-po`, numa cópia
// temporária da pasta de trabalho dele.

const state = vi.hoisted(() => ({ config: null as Configuration | null }))

vi.mock(
  'electron',
  async () => (await import('../../../../tests/helpers/electron-mock')).electronMock
)
vi.mock('../../profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../profile/config-loader')>()),
  getActiveConfig: () => state.config
}))

const mock = await import('../../../../tests/helpers/electron-mock')
const { fluxoDoPo } = await import('../../demo/scenarios/fluxo-do-po')
const { createFakeAzure } = await import('../../demo/fake-azure')
const fake = createFakeAzure(fluxoDoPo.azure)
vi.mock('../azure/client', () => ({ fetchAzure: (path: string) => fake.fetchAzure(path) }))

const store = await import('../../profile/profile-store')
const folders = await import('../../profile/work-folders')
const { absorbCatalog, previewCatalogAbsorb } = await import('./absorb')

const FIXTURE = resolve(__dirname, '../../../../tests/regression/pastas/fluxo-do-po/loja')
let catalog = ''

function read(file: string): string {
  return readFileSync(join(catalog, file), 'utf8')
}

beforeEach(() => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  const profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  const root = mkdtempSync(join(tmpdir(), 'pasta-do-po-'))
  cpSync(FIXTURE, root, { recursive: true })
  folders.setWorkFolder(profileId, 'loja', root)
  catalog = join(root, 'catalogo')
})

describe('absorbCatalog', () => {
  it('entra o novo e o mudado só na wiki; o conflito e o local ficam', async () => {
    const trocas = read('Trocas.md')
    const view = await absorbCatalog('loja', [])
    expect(read('Entregas.md')).toContain('RN-ENT-001')
    expect(read('Pagamentos.md')).toContain('RN-PAG-016')
    expect(read('Trocas.md')).toBe(trocas)
    expect(existsSync(join(catalog, 'Rascunho de frete.md'))).toBe(true)
    // Trocas segue a publicar (o conflito ficou com a versão local); o rascunho também.
    expect(view.pages.filter((p) => p.toPublish).map((p) => p.file)).toEqual([
      'Rascunho de frete.md',
      'Trocas.md'
    ])
  })

  it('o conflito entra quando o PO escolhe a versão da wiki', async () => {
    const view = await absorbCatalog('loja', ['/Catálogo/Loja/Trocas'])
    expect(read('Trocas.md')).toContain('Validada (2026-11-24)')
    expect(view.pages.filter((p) => p.toPublish).map((p) => p.file)).toEqual([
      'Rascunho de frete.md'
    ])
    const base = JSON.parse(read('.absorcao.json')) as AbsorbBase
    expect(Object.keys(base.pages).sort()).toEqual([
      '/Catálogo/Loja/Cupons',
      '/Catálogo/Loja/Entregas',
      '/Catálogo/Loja/Pagamentos',
      '/Catálogo/Loja/Trocas'
    ])
  })

  it('depois de absorver, a diferença só mostra o que ficou para trás', async () => {
    await absorbCatalog('loja', [])
    const preview = await previewCatalogAbsorb('loja')
    expect(preview.pages.map((p) => [p.file, p.status])).toEqual([
      ['Cupons.md', 'unchanged'],
      ['Entregas.md', 'unchanged'],
      ['Pagamentos.md', 'unchanged'],
      ['Trocas.md', 'conflict']
    ])
  })

  it('a escolha precisa ser uma lista de páginas', async () => {
    await expect(absorbCatalog('loja', 'tudo' as unknown as string[])).rejects.toMatchObject({
      code: 'CATALOG_INVALID'
    })
  })

  it('o App, de catálogo local, não absorve', async () => {
    await expect(previewCatalogAbsorb('app')).rejects.toMatchObject({ code: 'CATALOG_INVALID' })
  })
})
