import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'

// RN-SEC-34: o servidor MCP não faz rede nem lê o PAT (ADR 0010). Ele roda num
// processo iniciado pelo cliente de IA do PO, e tudo o que ele alcança a IA pode
// pedir. A barreira segue o grafo de imports a partir de `src/main/mcp/` e
// recusa qualquer arquivo que fale com a rede, leia o segredo ou entre no
// caminho do Azure.

const ROOT = resolve(__dirname, '../..')
const MCP_DIR = 'src/main/mcp'

/** Módulos do app que o servidor não pode alcançar, nem por um intermediário. */
const FORBIDDEN_FILES = [
  /^src\/main\/security\/pat-store\.ts$/,
  /^src\/main\/services\//,
  /^src\/main\/ipc\//,
  /^src\/main\/security\/network-guard\.ts$/
]

/** Toda forma de abrir conexão de rede, ler o cofre do SO ou iniciar processo. */
const FORBIDDEN_CODE =
  /\bfetch\s*\(|\bnet\.request\b|\bhttps?\.request\b|\bhttps?\.get\b|\bundici\b|\bsafeStorage\b|\bWebSocket\b|(?:from\s*|require\s*\(\s*|import\s*\(\s*)['"](?:node:)?(?:https?|http2|net|tls|dgram|dns|child_process)['"]|import\s*\{[^}]*\b(?:net|safeStorage)\b[^}]*\}\s*from\s*['"]electron['"]/

/** Comentário que cita `safeStorage` não abre o cofre; só o código conta. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const IMPORT = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm

function toRepoPath(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/')
}

/** Resolve um import do app para o arquivo; pacote de fora devolve `null`. */
function resolveImport(from: string, spec: string): string | null {
  const clean = spec.replace(/\?raw$|\?asset$/, '')
  let base: string
  if (clean.startsWith('@shared/')) base = join(ROOT, 'src/shared', clean.slice('@shared/'.length))
  else if (clean.startsWith('.')) base = resolve(dirname(from), clean)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && !readdirSafe(candidate)) return candidate
  }
  return null
}

function readdirSafe(path: string): boolean {
  try {
    readdirSync(path)
    return true
  } catch {
    return false
  }
}

/** Todos os arquivos do app que o servidor alcança, a partir de `src/main/mcp/`. */
export function reachableFrom(entries: string[]): string[] {
  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (!/\.tsx?$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT)) {
      const target = resolveImport(file, match[1])
      if (target && !seen.has(target)) queue.push(target)
    }
  }
  return [...seen].map(toRepoPath).sort()
}

function mcpEntries(): string[] {
  return readdirSync(join(ROOT, MCP_DIR))
    .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => join(ROOT, MCP_DIR, name))
}

describe('RN-SEC-34: o servidor MCP não faz rede nem lê o PAT', () => {
  const reachable = reachableFrom(mcpEntries())

  it('o grafo do servidor existe e inclui o próprio servidor', () => {
    expect(reachable).toContain('src/main/mcp/index.ts')
    expect(reachable).toContain('src/main/mcp/server.ts')
  })

  it('não alcança o cofre do PAT, o caminho do Azure nem os handlers da janela', () => {
    const offenders = reachable.filter((file) => FORBIDDEN_FILES.some((rule) => rule.test(file)))
    expect(offenders).toEqual([])
  })

  it('nenhum arquivo alcançado abre rede, lê o cofre do SO ou inicia processo', () => {
    const offenders = reachable
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) =>
        FORBIDDEN_CODE.test(withoutComments(readFileSync(join(ROOT, file), 'utf8')))
      )
    expect(offenders).toEqual([])
  })

  it('o detector reconhece as formas usuais', () => {
    expect(FORBIDDEN_CODE.test("await fetch('https://x')")).toBe(true)
    expect(FORBIDDEN_CODE.test("import https from 'https'")).toBe(true)
    expect(FORBIDDEN_CODE.test("import { request } from 'node:http'")).toBe(true)
    expect(FORBIDDEN_CODE.test("import { net } from 'electron'")).toBe(true)
    expect(FORBIDDEN_CODE.test("import { app, safeStorage } from 'electron'")).toBe(true)
    expect(FORBIDDEN_CODE.test("const cp = require('child_process')")).toBe(true)
    expect(FORBIDDEN_CODE.test("import { readFileSync } from 'fs'")).toBe(false)
    expect(FORBIDDEN_CODE.test("import { app } from 'electron'")).toBe(false)
    expect(FORBIDDEN_CODE.test(withoutComments('/** sem safeStorage aqui */'))).toBe(false)
    expect(FORBIDDEN_CODE.test(withoutComments('// fetch(url)\nconst a = 1'))).toBe(false)
  })
})
