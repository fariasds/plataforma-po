import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'

// RN-SEC-39: a publicação na wiki vem desligada. Sem o PO ligar no Perfil, a única
// escrita do app recusa antes de sair, e ligar pede a confirmação do sistema.
// Dados fictícios: o Cenário `fluxo-do-po`, organização `contoso`.

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
const { putWikiPage } = await import('../../src/main/services/azure/client')
const { setWikiPublishing } = await import('../../src/main/services/flow/publish')

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

beforeEach(() => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  store.createProfile({ name: 'Contoso', organization: parsed.config.organization })
  patStore.savePat(['FAKE', 'contoso', 'W'.repeat(24)].join('-'))
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

describe('RN-SEC-39: publicação desligada por padrão', () => {
  it('Perfil novo não publica: recusa antes de sair', async () => {
    expect(store.requireActiveProfile().wikiPublish).toBe(false)
    await expect(
      putWikiPage('loja', '/Catálogo/Loja/Cupons', '# Cupons', null)
    ).rejects.toMatchObject({ code: 'WIKI_PUBLISH_OFF' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ligar pede o diálogo do sistema; cancelar deixa desligada', async () => {
    mock.setMessageBoxResponse(1)
    expect(await setWikiPublishing(true)).toBe(false)
    expect(mock.getMessageBoxCalls()).toHaveLength(1)
    expect(store.requireActiveProfile().wikiPublish).toBe(false)
  })

  it('ligada com a confirmação, a escrita sai; desligada de novo, volta a recusar', async () => {
    mock.setMessageBoxResponse(0)
    expect(await setWikiPublishing(true)).toBe(true)
    await putWikiPage('loja', '/Catálogo/Loja/Cupons', '# Cupons', null)
    expect(fetchMock).toHaveBeenCalledOnce()

    expect(await setWikiPublishing(false)).toBe(false)
    await expect(
      putWikiPage('loja', '/Catálogo/Loja/Cupons', '# Cupons', null)
    ).rejects.toMatchObject({ code: 'WIKI_PUBLISH_OFF' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
