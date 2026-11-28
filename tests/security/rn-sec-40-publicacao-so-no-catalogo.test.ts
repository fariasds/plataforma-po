import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { AppError } from '@shared/errors'
import { assertWikiPageWrite } from '../../src/main/security/network-guard'

// RN-SEC-40: a única escrita do app é PUT de página da wiki do catálogo, abaixo da
// página raiz que a Configuração declara. Com um PAT que pode escrever, é esta
// barreira que segura o resto. Dados fictícios: o Cenário `fluxo-do-po`.

const state = vi.hoisted(() => ({ config: null as Configuration | null }))

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('../../src/main/profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/main/profile/config-loader')>()),
  getActiveConfig: () => state.config
}))

const mock = await import('../helpers/electron-mock')
const { fluxoDoPo } = await import('../../src/main/demo/scenarios/fluxo-do-po')
const store = await import('../../src/main/profile/profile-store')
const patStore = await import('../../src/main/security/pat-store')
const { putWikiPage, postAzure } = await import('../../src/main/services/azure/client')

const SCOPE = { project: 'Contoso', wiki: 'Contoso.wiki', rootPage: '/Catálogo/Loja' }
const PAGES = 'https://dev.azure.com/contoso/Contoso/_apis/wiki/wikis/Contoso.wiki/pages'
const page = (path: string, extra = ''): URL =>
  new URL(`${PAGES}?path=${encodeURIComponent(path)}&api-version=7.1${extra}`)

function blocked(method: string, url: URL): boolean {
  try {
    assertWikiPageWrite(method, url, SCOPE)
    return false
  } catch (error) {
    return error instanceof AppError && error.code === 'AZURE_BLOCKED'
  }
}

describe('RN-SEC-40: a barreira da escrita', () => {
  it('aceita PUT de página abaixo da raiz do catálogo', () => {
    expect(blocked('PUT', page('/Catálogo/Loja/Cupons'))).toBe(false)
    expect(blocked('PUT', page('/Catálogo/Loja/Pagamentos/Pix'))).toBe(false)
  })

  it.each([
    ['outro verbo', 'POST', page('/Catálogo/Loja/Cupons')],
    ['DELETE', 'DELETE', page('/Catálogo/Loja/Cupons')],
    ['a própria raiz', 'PUT', page('/Catálogo/Loja')],
    ['fora da raiz', 'PUT', page('/Catálogo/App/Cupons')],
    ['raiz como prefixo', 'PUT', page('/Catálogo/LojaX/Cupons')],
    ['subida com ..', 'PUT', page('/Catálogo/Loja/../App/Cupons')],
    ['parâmetro a mais', 'PUT', page('/Catálogo/Loja/Cupons', '&versionDescriptor.version=main')],
    ['path repetido', 'PUT', page('/Catálogo/Loja/Cupons', '&path=%2FOutra')],
    [
      'outra wiki',
      'PUT',
      new URL(PAGES.replace('Contoso.wiki', 'Outra.wiki') + '?path=%2FCat%C3%A1logo%2FLoja%2FA')
    ],
    [
      'outro projeto',
      'PUT',
      new URL(PAGES.replace('/Contoso/_apis', '/Outro/_apis') + '?path=%2FCat%C3%A1logo%2FLoja%2FA')
    ],
    ['work item', 'PUT', new URL('https://dev.azure.com/contoso/_apis/wit/workitems/101')]
  ])('recusa %s', (_case, method, url) => {
    expect(blocked(method, url)).toBe(true)
  })
})

describe('RN-SEC-40: o client.ts aplica a regra', () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

  beforeEach(() => {
    mock.resetElectronMock()
    const parsed = validateConfiguration(fluxoDoPo.config)
    if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
    state.config = parsed.config
    store.createProfile({ name: 'Contoso', organization: parsed.config.organization })
    store.setWikiPublish(true)
    patStore.savePat(['FAKE', 'contoso', 'W'.repeat(24)].join('-'))
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('a página do catálogo sai como PUT, com o ETag', async () => {
    await putWikiPage('loja', '/Catálogo/Loja/Cupons', '# Cupons', '"abc"')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(new URL(url).searchParams.get('path')).toBe('/Catálogo/Loja/Cupons')
    expect((init.headers as Record<string, string>)['If-Match']).toBe('"abc"')
  })

  it.each([
    ['fora da raiz', 'loja', '/Catálogo/App/Cupons'],
    ['subida com ..', 'loja', '/Catálogo/Loja/../../Home'],
    ['Produto com catálogo local', 'app', '/Catálogo/Loja/Cupons']
  ])('recusa %s antes de sair', async (_case, productId, path) => {
    await expect(putWikiPage(productId, path, 'x', null)).rejects.toBeInstanceOf(AppError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('com a publicação ligada, o caminho de leitura continua sem escrever', async () => {
    await expect(
      postAzure(`/Contoso/_apis/wiki/wikis/Contoso.wiki/pages?path=%2FA&api-version=7.1`, {})
    ).rejects.toMatchObject({
      code: 'AZURE_BLOCKED'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
