import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'

// O Dependabot integra sozinho o grupo "ferramentas" (.github/dependabot.yml). Um
// pacote que vai para dentro do instalador nunca pode cair nele: este teste
// confere que todo pacote importado pelo código do app está no grupo "app" e
// excluído de "ferramentas", e que as duas listas são a mesma.

const ROOT = resolve(__dirname, '../..')
const config = readFileSync(join(ROOT, '.github/dependabot.yml'), 'utf8')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

function listAfter(text: string, key: string): string[] {
  const start = text.indexOf(`${key}:`)
  if (start === -1) return []
  const items: string[] = []
  for (const line of text.slice(start).split(/\r?\n/).slice(1)) {
    const item = line.match(/^\s+- '([^']+)'\s*$/)
    if (item) items.push(item[1])
    else if (line.trim() !== '' && !line.trim().startsWith('#')) break
  }
  return items
}

const appSection = config.slice(config.indexOf('      app:'), config.indexOf('      ferramentas:'))
const toolsSection = config.slice(config.indexOf('      ferramentas:'))
const appPatterns = listAfter(appSection, 'patterns')
const excluded = listAfter(toolsSection, 'exclude-patterns')

const matches = (name: string, pattern: string): boolean =>
  pattern.endsWith('/*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)])
const imported = new Set(
  sourceFiles(join(ROOT, 'src')).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/from '([^'.][^']*)'/g)]
      .map(([, spec]) =>
        spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
      )
      .filter((name) => declared.has(name))
  )
)

describe('grupos do Dependabot', () => {
  it('as listas foram lidas (o teste não passa por estar vazio)', () => {
    expect(appPatterns.length).toBeGreaterThan(5)
    expect(imported.size).toBeGreaterThan(5)
  })

  it('todo pacote importado pelo app está no grupo app', () => {
    const missing = [...imported].filter((name) => !appPatterns.some((p) => matches(name, p)))
    expect(missing).toEqual([])
  })

  it('o grupo ferramentas exclui exatamente o que o grupo app inclui', () => {
    expect(excluded).toEqual(appPatterns)
  })
})
