import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'

// O ID liga a documentação, o texto de ajuda e o código. Este teste garante que o
// elo não aponta para o nada: toda regra citada no código, nos testes, nos scripts
// e no catálogo de Cenários existe em docs/regras-de-negocio/ e não foi revogada.

const ROOT = resolve(__dirname, '../..')
const RULES_DIR = join(ROOT, 'docs/regras-de-negocio')
const RULE_ID = /RN-[A-Z]{3}-\d{2}/g

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'aprovados') return []
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

// O README da pasta usa IDs como exemplo do formato; não define regra.
const ruleDocs = readdirSync(RULES_DIR)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .map((name) => readFileSync(join(RULES_DIR, name), 'utf8'))

const defined = new Set(ruleDocs.flatMap((text) => text.match(RULE_ID) ?? []))

// Formatos de revogação de docs/regras-de-negocio/README.md: "- RN-XXX-NN — revogada"
// na lista de revogadas, ou o ID riscado.
const revoked = new Set(
  ruleDocs.flatMap((text) =>
    [...text.matchAll(/^- (RN-[A-Z]{3}-\d{2}) — revogada|~~(RN-[A-Z]{3}-\d{2})~~/gm)].map(
      (match) => match[1] ?? match[2]
    )
  )
)

const cited = [
  ...files(join(ROOT, 'src')),
  ...files(join(ROOT, 'tests')),
  ...files(join(ROOT, 'scripts')),
  join(ROOT, 'docs/cenarios.md')
]
  .filter((path) => /\.(ts|tsx|mjs|md)$/.test(path))
  .flatMap((path) => {
    const text = readFileSync(path, 'utf8')
    return [...new Set(text.match(RULE_ID) ?? [])].map((id) => ({
      id,
      file: relative(ROOT, path).replace(/\\/g, '/')
    }))
  })

describe('regras citadas', () => {
  it('a documentação define regras (o teste não passa por estar vazio)', () => {
    expect(defined.size).toBeGreaterThan(50)
    expect(cited.length).toBeGreaterThan(50)
  })

  it('toda regra citada existe em docs/regras-de-negocio/', () => {
    const missing = cited.filter((entry) => !defined.has(entry.id))
    expect(missing.map((entry) => `${entry.id} em ${entry.file}`)).toEqual([])
  })

  it('nenhuma regra citada está revogada', () => {
    const dead = cited.filter((entry) => revoked.has(entry.id))
    expect(dead.map((entry) => `${entry.id} em ${entry.file}`)).toEqual([])
  })
})
