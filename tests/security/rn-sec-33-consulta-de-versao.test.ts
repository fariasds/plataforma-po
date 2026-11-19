import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@shared/errors'
import { RELEASE_CHECK_URL } from '@shared/update'
import { assertAllowedReleaseCheck } from '../../src/main/security/network-guard'

// RN-SEC-33: a consulta de versão vai a um endereço só, sem o PAT, e nada da
// resposta escolhe para onde o navegador vai. É a única saída de rede do main
// além do Azure (RN-SEC-18).

vi.mock('electron', async () => {
  const { electronMock } = await import('../helpers/electron-mock')
  // Versão instalada fixa: a do mock genérico não é um número de versão.
  return { ...electronMock, app: { ...electronMock.app, getVersion: () => '1.1.0' } }
})

const ROOT = resolve(__dirname, '../..')
const RELEASE_CHECK = 'src/main/services/update/release-check.ts'
const FAKE_PAT = ['FAKE', 'contoso', 'pat', 'Q'.repeat(24)].join('-')
const INSTALLER = 'plataforma-po-desktop-1.2.0-setup.exe'

/** Resposta de `releases/latest` com links forjados: nenhum deles pode ser usado. */
function latestRelease(tag: string, assetNames: string[]): Response {
  return new Response(
    JSON.stringify({
      tag_name: tag,
      html_url: `https://evil.com/releases/tag/${tag}`,
      assets: assetNames.map((name) => ({ name, browser_download_url: `https://evil.com/${name}` }))
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

function rejects(url: string, method?: string): boolean {
  try {
    assertAllowedReleaseCheck(url, method)
    return false
  } catch (error) {
    return error instanceof AppError && error.code === 'UPDATE_BLOCKED'
  }
}

const REPO_API = 'https://api.github.com/repos/fariasds/plataforma-po'

describe('RN-SEC-33: o endereço da consulta', () => {
  it('aceita só o GET da última Release do repositório público', () => {
    expect(RELEASE_CHECK_URL).toBe(`${REPO_API}/releases/latest`)
    expect(rejects(RELEASE_CHECK_URL)).toBe(false)
    expect(rejects(RELEASE_CHECK_URL, 'get')).toBe(false)
  })

  it.each([
    ['POST', RELEASE_CHECK_URL, 'POST'],
    ['outro repositório', 'https://api.github.com/repos/evil/plataforma-po/releases/latest', 'GET'],
    ['a lista de Releases, com rascunhos', `${REPO_API}/releases`, 'GET'],
    [
      'host parecido',
      'https://api.github.com.evil.com/repos/fariasds/plataforma-po/releases/latest',
      'GET'
    ],
    ['http sem TLS', RELEASE_CHECK_URL.replace('https:', 'http:'), 'GET'],
    ['usuário embutido', RELEASE_CHECK_URL.replace('https://', 'https://x@'), 'GET'],
    ['parâmetro a mais', `${RELEASE_CHECK_URL}?token=x`, 'GET'],
    ['porta', RELEASE_CHECK_URL.replace('api.github.com', 'api.github.com:8443'), 'GET'],
    ['não é URL', 'releases/latest', 'GET']
  ])('recusa %s', (_case, url, method) => {
    expect(rejects(url, method)).toBe(true)
  })
})

describe('RN-SEC-33: o arquivo da consulta não alcança o token', () => {
  const source = readFileSync(join(ROOT, RELEASE_CHECK), 'utf8')

  it('não importa o guardião do PAT nem nada do Azure', () => {
    expect(source).not.toMatch(/pat-store|services\/azure|['"]\.\.\/azure/)
  })

  it('tem um único fetch, logo depois da checagem, para o endereço fixo', () => {
    expect(source.match(/\bfetch\s*\(/g) ?? []).toHaveLength(1)
    expect(source).toMatch(
      /assertAllowedReleaseCheck\(RELEASE_CHECK_URL, init\.method\)\s*return fetch\(RELEASE_CHECK_URL, init\)/
    )
  })
})

describe('RN-SEC-33: a consulta em funcionamento', () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()
  const open = vi.fn()

  beforeEach(async () => {
    vi.resetModules()
    fetchMock.mockReset()
    open.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Com um Perfil de verdade e um PAT guardado: a consulta tem de ignorar os dois.
    const profiles = await import('../../src/main/profile/profile-store')
    if (!profiles.getActiveProfile())
      profiles.createProfile({ name: 'Contoso', organization: 'contoso' })
    const patStore = await import('../../src/main/security/pat-store')
    patStore.savePat(FAKE_PAT)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const releaseCheck = (): Promise<typeof import('../../src/main/services/update/release-check')> =>
    import('../../src/main/services/update/release-check')

  it('sai uma vez, só GET, sem seguir redirecionamento e sem credencial', async () => {
    fetchMock.mockResolvedValue(latestRelease('v1.2.0', [INSTALLER]))
    const { checkForUpdate } = await releaseCheck()

    expect(await checkForUpdate()).toEqual({
      status: 'available',
      installed: '1.1.0',
      latest: '1.2.0',
      hasInstaller: true
    })
    await checkForUpdate()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(RELEASE_CHECK_URL)
    expect(init?.method).toBe('GET')
    expect(init?.redirect).toBe('error')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('cookie')).toBeNull()
    const sent = JSON.stringify({ url, headers: [...headers.entries()] })
    expect(sent).not.toContain(FAKE_PAT)
    expect(sent).not.toContain('contoso')
  })

  it('abre no navegador só os endereços que o main monta, nunca os da resposta', async () => {
    fetchMock.mockResolvedValue(latestRelease('v1.2.0', [INSTALLER]))
    const { checkForUpdate, openUpdateLink } = await releaseCheck()
    await checkForUpdate()

    await openUpdateLink('installer', open)
    await openUpdateLink('release', open)
    expect(open.mock.calls.map((call) => call[0])).toEqual([
      `https://github.com/fariasds/plataforma-po/releases/download/v1.2.0/${INSTALLER}`,
      'https://github.com/fariasds/plataforma-po/releases/tag/v1.2.0'
    ])
  })

  it('pedido de link que não é um dos dois é recusado', async () => {
    fetchMock.mockResolvedValue(latestRelease('v1.2.0', [INSTALLER]))
    const { checkForUpdate, openUpdateLink } = await releaseCheck()
    await checkForUpdate()
    const forged = 'https://evil.com/x.exe' as unknown as 'installer'
    await expect(openUpdateLink(forged, open)).rejects.toMatchObject({ code: 'UPDATE_BLOCKED' })
    expect(open).not.toHaveBeenCalled()
  })

  it.each([
    ['tag que não é versão', 'v1.2.0; rm'],
    ['tag com caminho', 'v1.2.0/../../evil'],
    ['tag sem v', '1.2.0'],
    ['pré-lançamento', 'v1.2.0-beta.1']
  ])('%s não gera aviso nem link', async (_case, tag) => {
    fetchMock.mockResolvedValue(latestRelease(tag, []))
    const { checkForUpdate, openUpdateLink } = await releaseCheck()
    expect((await checkForUpdate()).status).toBe('unknown')
    await expect(openUpdateLink('release', open)).rejects.toMatchObject({
      code: 'UPDATE_UNAVAILABLE'
    })
    expect(open).not.toHaveBeenCalled()
  })

  it('sem o instalador anexado, oferece só a página', async () => {
    fetchMock.mockResolvedValue(latestRelease('v1.2.0', ['outro-arquivo.exe']))
    const { checkForUpdate, openUpdateLink } = await releaseCheck()
    expect(await checkForUpdate()).toMatchObject({ status: 'available', hasInstaller: false })
    await expect(openUpdateLink('installer', open)).rejects.toMatchObject({
      code: 'UPDATE_UNAVAILABLE'
    })
    await openUpdateLink('release', open)
    expect(open).toHaveBeenCalledOnce()
  })

  it('sem rede, não há aviso e nada é lançado', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const { checkForUpdate } = await releaseCheck()
    expect(await checkForUpdate()).toEqual({ status: 'unknown', installed: '1.1.0' })
  })

  it('na demonstração a consulta não sai e nenhum link abre (RN-SEC-27)', async () => {
    fetchMock.mockResolvedValue(latestRelease('v1.2.0', [INSTALLER]))
    const profiles = await import('../../src/main/profile/profile-store')
    profiles.startDemoProfile()
    try {
      const { checkForUpdate, openUpdateLink } = await releaseCheck()
      expect(await checkForUpdate()).toEqual({ status: 'unknown', installed: '1.1.0' })
      expect(fetchMock).not.toHaveBeenCalled()
      await expect(openUpdateLink('installer', open)).rejects.toMatchObject({
        code: 'UPDATE_UNAVAILABLE'
      })
      expect(open).not.toHaveBeenCalled()
    } finally {
      profiles.leaveDemoProfile()
    }
  })
})
