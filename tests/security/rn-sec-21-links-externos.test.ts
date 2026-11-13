import { afterEach, describe, expect, it, vi } from 'vitest'
import { openExternalIfAllowed } from '../../src/main/security/network-guard'

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
