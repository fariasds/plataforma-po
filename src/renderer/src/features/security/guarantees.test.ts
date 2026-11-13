import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { GUARANTEES } from './guarantees'

// A tela Segurança só vale se cada promessa dela tiver prova. Este teste é o
// que impede a tela de citar regra que não existe, regra revogada ou teste que
// foi apagado.

const ROOT = resolve(__dirname, '../../../../..')
const RULES_DIR = join(ROOT, 'docs/regras-de-negocio')

function ruleHeadings(): { active: Set<string>; revoked: Set<string> } {
  const active = new Set<string>()
  const revoked = new Set<string>()
  for (const file of readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(RULES_DIR, file), 'utf8')
    for (const match of text.matchAll(/^###\s+(~~)?(RN-[A-Z]+-\d+)/gm)) {
      ;(match[1] ? revoked : active).add(match[2])
    }
  }
  return { active, revoked }
}

describe('tela Segurança: toda promessa tem prova', () => {
  const { active, revoked } = ruleHeadings()
  const rules = GUARANTEES.flatMap((g) => g.rules)

  it('toda regra citada existe na documentação e não está revogada', () => {
    expect(rules.filter((rule) => !active.has(rule) || revoked.has(rule))).toEqual([])
  })

  it('todo arquivo de prova existe no repositório', () => {
    const missing = GUARANTEES.flatMap((g) => g.proof).filter(
      (path) => !existsSync(join(ROOT, path))
    )
    expect(missing).toEqual([])
  })

  it('toda regra da tela também está na página docs/seguranca.md', () => {
    const page = readFileSync(join(ROOT, 'docs/seguranca.md'), 'utf8')
    expect(rules.filter((rule) => !page.includes(rule))).toEqual([])
  })

  it('cada garantia aparece uma vez', () => {
    const keys = GUARANTEES.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
