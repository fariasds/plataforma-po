import { readdirSync, readFileSync } from 'fs'
import { extname, join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'

// RN-SEC-23: o app não inicia processo. A IA do PO é por copiar e colar (ADR
// 0007): nenhum arquivo de `src/` importa módulo que inicia programa. A única
// exceção é a captura de referência dos dashboards, só em desenvolvimento.

const ROOT = resolve(__dirname, '../..')
const DEV_EXCEPTION = 'src/main/dev/snapshot.ts'
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

/**
 * Módulos que iniciam programa: o do Node (com ou sem `node:`), os pacotes
 * conhecidos que o embrulham e o `utilityProcess` do Electron.
 */
const PROCESS_MODULE =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"](?:node:)?(?:child_process|execa|cross-spawn|shelljs|zx|node-pty)(?:\/[^'"]*)?['"]/
const PROCESS_API = /\butilityProcess\b|\bprocess\.binding\s*\(\s*['"]spawn_sync['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) && !/\.test\.tsx?$/.test(entry.name)
      ? [full]
      : []
  })
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(join(ROOT, 'src'))
    .map((file) => relative(ROOT, file).replace(/\\/g, '/'))
    .filter((file) => file !== DEV_EXCEPTION)
    .filter((file) => pattern.test(readFileSync(join(ROOT, file), 'utf8')))
}

describe('RN-SEC-23: o app não inicia processo', () => {
  it('nenhum arquivo de src/ importa módulo que inicia programa', () => {
    expect(offenders(PROCESS_MODULE)).toEqual([])
  })

  it('nem usa o utilityProcess do Electron', () => {
    expect(offenders(PROCESS_API)).toEqual([])
  })

  it('a exceção de desenvolvimento continua só em desenvolvimento', () => {
    // Se o snapshot deixar de existir, a exceção some junto; se existir, ele não
    // pode ser carregado pelo app empacotado.
    const files = sourceFiles(join(ROOT, 'src')).map((file) =>
      relative(ROOT, file).replace(/\\/g, '/')
    )
    const importers = files
      .filter((file) => file !== DEV_EXCEPTION)
      .filter((file) => /['"][^'"]*dev\/snapshot['"]/.test(readFileSync(join(ROOT, file), 'utf8')))
    for (const file of importers) {
      expect(readFileSync(join(ROOT, file), 'utf8')).toMatch(
        /is\.dev|app\.isPackaged|import\.meta\.env\.DEV/
      )
    }
  })

  it('o detector reconhece as formas usuais', () => {
    expect(PROCESS_MODULE.test("import { spawn } from 'child_process'")).toBe(true)
    expect(PROCESS_MODULE.test("import { execFile } from 'node:child_process'")).toBe(true)
    expect(PROCESS_MODULE.test("const cp = require('child_process')")).toBe(true)
    expect(PROCESS_MODULE.test("const { execa } = await import('execa')")).toBe(true)
    expect(PROCESS_MODULE.test("import spawn from 'cross-spawn'")).toBe(true)
    expect(PROCESS_MODULE.test("import 'child_process'")).toBe(true)
    expect(PROCESS_MODULE.test("import { readFile } from 'fs'")).toBe(false)
    expect(PROCESS_MODULE.test('// child_process fica de fora')).toBe(false)
    expect(PROCESS_API.test('utilityProcess.fork(path)')).toBe(true)
  })
})
