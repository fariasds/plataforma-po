import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { validateConfiguration } from '@shared/config/validate'

/**
 * RN-CFG-05: nada com forma de segredo entra na Configuração, em qualquer
 * profundidade, nem sob chave com nome de segredo.
 *
 * Os valores abaixo são montados em partes para o próprio arquivo de teste não
 * disparar o hook de pre-commit — e não são tokens reais.
 */

// O teste corrompe o JSON de propósito, em qualquer ponto: tipar isto seria reescrever o schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = any

const example = JSON.parse(readFileSync(resolve('examples/exemplo-scrum.json'), 'utf8'))

const AZURE_CLASSIC_PAT = 'abcdefghijklmnopqrstuvwxyz234567'.repeat(2).slice(0, 52)
const AZURE_NEW_PAT = 'A1b2C3d4'.repeat(10).slice(0, 76) + 'AZDO' + 'x9Y8'
const GITHUB_TOKEN = 'gh' + 'p_' + 'A1b2C3d4E5'.repeat(4).slice(0, 36)
const GITHUB_FINE = 'github' + '_pat_' + 'A1b2_C3d4E5'.repeat(6).slice(0, 62)
const BASIC_HEADER = 'Basic ' + 'OmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MjM0NTY3'

function validate(change: (config: Draft) => void): ReturnType<typeof validateConfiguration> {
  const config = structuredClone(example)
  change(config)
  return validateConfiguration(config)
}

function secretIssues(change: (config: Draft) => void): { path: string; message: string }[] {
  const result = validate(change)
  return result.ok
    ? []
    : result.issues.filter((i) => /forma de token|não é permitida/.test(i.message))
}

describe('RN-CFG-05 — sem segredo na Configuração', () => {
  it('o exemplo fictício não dispara a barreira', () => {
    expect(secretIssues(() => {})).toEqual([])
  })

  it.each([
    ['PAT clássico do Azure', AZURE_CLASSIC_PAT],
    ['PAT novo do Azure', AZURE_NEW_PAT],
    ['token do GitHub', GITHUB_TOKEN],
    ['token fino do GitHub', GITHUB_FINE],
    ['cabeçalho Basic', BASIC_HEADER],
    ['token no meio de um texto', `copie ${AZURE_CLASSIC_PAT} aqui`]
  ])('recusa %s em qualquer profundidade', (_, secret) => {
    const cases: Array<[string, (c: Draft) => void]> = [
      ['products[0].name', (c) => (c.products[0].name = secret)],
      ['products[0].areaPaths[0]', (c) => (c.products[0].areaPaths[0] = secret)],
      [
        'calendar.extraHolidays[0].name',
        (c) => (c.calendar.extraHolidays = [{ date: '2026-11-20', name: secret }])
      ],
      ['groups[0].name', (c) => (c.groups[0].name = secret)]
    ]
    for (const [path, change] of cases) {
      expect(secretIssues(change).map((i) => i.path)).toContain(path)
    }
  })

  it('recusa mesmo em chave que o schema desconhece', () => {
    const issues = secretIssues((c) => (c.notes = { hint: AZURE_CLASSIC_PAT }))
    expect(issues.map((i) => i.path)).toContain('notes.hint')
  })

  it.each([
    'pat',
    'PAT',
    'token',
    'password',
    'secret',
    'accessToken',
    'azure_pat',
    'clientSecret'
  ])('recusa a chave "%s"', (key) => {
    const issues = secretIssues((c) => (c.products[0][key] = 'qualquer coisa'))
    expect(issues.map((i) => i.path)).toContain(`products[0].${key}`)
  })

  it('não confunde chave legítima com nome de segredo', () => {
    // "format", "compat" e "tokenizer" contêm as letras, mas não são segredo.
    for (const key of ['format', 'compat', 'tokenizer', 'patternList']) {
      expect(secretIssues((c) => (c.products[0][key] = 'x'))).toEqual([])
    }
  })

  it('a mensagem nunca repete o segredo', () => {
    const result = validate((c) => (c.products[0].name = AZURE_CLASSIC_PAT))
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain(AZURE_CLASSIC_PAT)
  })

  it('o arquivo é recusado mesmo com o resto da forma correta', () => {
    expect(validate((c) => (c.products[0].name = GITHUB_TOKEN)).ok).toBe(false)
  })
})
