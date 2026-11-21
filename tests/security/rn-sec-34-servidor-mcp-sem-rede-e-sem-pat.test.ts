import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { mcpEntries, reachableFrom, withoutComments } from '../helpers/import-graph'

// RN-SEC-34: o servidor MCP não faz rede nem lê o PAT (ADR 0010). Ele roda num
// processo iniciado pelo cliente de IA do PO, e tudo o que ele alcança a IA pode
// pedir. A barreira segue o grafo de imports a partir de `src/main/mcp/` e
// recusa qualquer arquivo que fale com a rede, leia o segredo ou entre no
// caminho do Azure.

const ROOT = resolve(__dirname, '../..')

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
