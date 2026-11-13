import { readdirSync, readFileSync } from 'fs'
import { extname, join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipc'

// RN-SEC-10: o PAT nunca chega ao renderer. O contrato de IPC só sabe perguntar se
// há PAT, gravar e apagar; e nada do lado da janela alcança o módulo que o lê.

const ALLOWED_PAT_METHODS = ['clearPat', 'hasPat', 'savePat']
const ROOT = resolve(__dirname, '../..')
const RENDERER_SIDE = ['src/renderer', 'src/preload', 'src/shared']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx'])
const PAT_STORE_IMPORT =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"][^'"]*security\/pat-store(?:\.[a-z]+)?['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : []
  })
}

describe('RN-SEC-10: o contrato de IPC não lê o PAT', () => {
  it('só hasPat, savePat e clearPat mencionam o PAT nos canais', () => {
    const patEntries = Object.entries(IPC_CHANNELS).filter(
      ([method, channel]) => /pat/i.test(method) || /pat/i.test(channel)
    )
    expect(patEntries.map(([method]) => method).sort()).toEqual(ALLOWED_PAT_METHODS)
  })

  it('nenhum arquivo do renderer, do preload ou do shared importa security/pat-store', () => {
    const offenders = RENDERER_SIDE.flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((file) => PAT_STORE_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(offenders).toEqual([])
  })

  it('o detector de import reconhece as formas usuais', () => {
    expect(PAT_STORE_IMPORT.test("import { loadPat } from '../main/security/pat-store'")).toBe(true)
    expect(PAT_STORE_IMPORT.test("await import('@main/security/pat-store.ts')")).toBe(true)
    expect(PAT_STORE_IMPORT.test("require('./security/pat-store')")).toBe(true)
    expect(PAT_STORE_IMPORT.test("import './security/pat-store'")).toBe(true)
    expect(PAT_STORE_IMPORT.test("import { x } from './security/pat-store-docs'")).toBe(false)
  })
})
