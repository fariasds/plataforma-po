import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAllowedReleaseLink,
  openExternalIfAllowed,
  openReleaseLinkIfAllowed
} from '../../src/main/security/network-guard'

// RN-SEC-21: a janela só manda para o navegador páginas da organização no Azure
// DevOps. Link injetado em título de work item, ou `javascript:`, não sai do app.

const ORG = 'contoso'

function opened(url: string): string[] {
  const open = vi.fn()
  openExternalIfAllowed(url, ORG, open)
  return open.mock.calls.map((call) => String(call[0]))
}

describe('RN-SEC-21: links externos só para a organização', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('abre o work item da organização', () => {
    const url = 'https://dev.azure.com/contoso/_workitems/edit/1'
    expect(opened(url)).toEqual([url])
  })

  it.each([
    ['outro site', 'https://evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['outra organização', 'https://dev.azure.com/fabrikam/_workitems/edit/1'],
    ['host parecido', 'https://dev.azure.com.evil.com/contoso/_workitems/edit/1'],
    ['http sem TLS', 'http://dev.azure.com/contoso/_workitems/edit/1'],
    ['arquivo local', 'file:///C:/Windows/System32/calc.exe'],
    ['API em vez de página', 'https://vssps.dev.azure.com/contoso/_apis/graph/users']
  ])('nega %s e registra', (_case, url) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(opened(url)).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('RN-SEC-21: links da versão nova (RN-GLB-18)', () => {
  const REPO = 'https://github.com/fariasds/plataforma-po'
  const RELEASE = `${REPO}/releases/tag/v1.2.0`
  const INSTALLER = `${REPO}/releases/download/v1.2.0/plataforma-po-desktop-1.2.0-setup.exe`

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('abre a página da Release e o instalador da mesma versão', () => {
    expect(isAllowedReleaseLink(RELEASE)).toBe(true)
    expect(isAllowedReleaseLink(INSTALLER)).toBe(true)
  })

  it.each([
    ['outro repositório', 'https://github.com/evil/plataforma-po/releases/tag/v1.2.0'],
    ['outro arquivo', `${REPO}/releases/download/v1.2.0/evil.exe`],
    [
      'instalador de outra versão',
      `${REPO}/releases/download/v1.2.0/plataforma-po-desktop-6.6.6-setup.exe`
    ],
    ['versão fora do formato', `${REPO}/releases/tag/v1.2.0-evil`],
    ['host parecido', RELEASE.replace('github.com', 'github.com.evil.com')],
    ['http sem TLS', RELEASE.replace('https:', 'http:')],
    ['parâmetro', `${RELEASE}?x=1`],
    ['fragmento', `${RELEASE}#x`],
    ['usuário embutido', RELEASE.replace('https://', 'https://x@')],
    ['outra página do repositório', `${REPO}/settings`],
    ['caminho a mais', `${RELEASE}/x`]
  ])('nega %s e registra', (_case, url) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const open = vi.fn()
    expect(openReleaseLinkIfAllowed(url, open)).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('link de Release vindo de work item continua negado', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(opened(INSTALLER)).toEqual([])
  })
})
