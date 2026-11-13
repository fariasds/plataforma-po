import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { validateConfiguration } from '@shared/config/validate'

/**
 * RN-CFG-04: a Configuração guarda o NOME da organização, nunca uma URL.
 *
 * O host é sempre montado como `dev.azure.com/<org>`. Se o arquivo aceitasse
 * URL, uma Configuração importada poderia mandar o PAT para outro servidor.
 */

const example = JSON.parse(readFileSync(resolve('examples/exemplo-scrum.json'), 'utf8'))

function withOrganization(organization: unknown): unknown {
  return { ...structuredClone(example), organization }
}

function organizationIssues(organization: unknown): string[] {
  const result = validateConfiguration(withOrganization(organization))
  return result.ok
    ? []
    : result.issues.filter((i) => i.path === 'organization').map((i) => i.message)
}

describe('RN-CFG-04 — organização por nome', () => {
  it.each(['contoso', 'Contoso-BR', 'a', 'org2026', 'x'.repeat(50)])('aceita "%s"', (name) => {
    expect(organizationIssues(name)).toEqual([])
  })

  it.each([
    'https://dev.azure.com/contoso',
    'dev.azure.com/contoso',
    'contoso.visualstudio.com',
    'evil.example.com',
    'contoso/projeto',
    'contoso\\projeto',
    'contoso:443',
    'contoso@evil',
    'contoso?x=1',
    'contoso#x',
    'con toso',
    '-contoso',
    'localhost.',
    '127.0.0.1',
    '',
    'x'.repeat(51)
  ])('rejeita "%s"', (value) => {
    expect(organizationIssues(value).length).toBeGreaterThan(0)
  })

  it('rejeita valor que não é texto', () => {
    expect(organizationIssues(42).length).toBeGreaterThan(0)
    expect(organizationIssues(null).length).toBeGreaterThan(0)
  })

  it('explica o motivo, para a IA do PO não insistir na URL', () => {
    const [message] = organizationIssues('https://dev.azure.com/contoso')
    expect(message).toMatch(/sem URL/)
    expect(message).toMatch(/PAT/)
  })

  it('não existe outro campo que aceite o endereço do servidor', () => {
    const result = validateConfiguration({
      ...structuredClone(example),
      baseUrl: 'https://evil.example.com'
    })
    expect(result.ok).toBe(false)
  })
})
