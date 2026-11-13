import { readdirSync, readFileSync } from 'fs'
import { extname, join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'

// RN-SEC-29: a janela roda em sandbox, com isolamento de contexto, sem Node, sem
// permissões além da escrita na área de transferência, e o preload entrega a ela
// só o objeto `api`. As opções vivem no código-fonte do main e do preload, então a
// prova é ler esse código: um teste de execução precisaria subir o Electron.

const ROOT = resolve(__dirname, '../..')
const MAIN_INDEX = join(ROOT, 'src/main/index.ts')
const PRELOAD_INDEX = join(ROOT, 'src/preload/index.ts')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : []
  })
}

// Remove comentários para que um exemplo no comentário não conte como código.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function code(file: string): string {
  return stripComments(readFileSync(file, 'utf8'))
}

const WEAKENING = [
  /\bsandbox\s*:\s*false\b/,
  /\bcontextIsolation\s*:\s*false\b/,
  /\bnodeIntegration\w*\s*:\s*true\b/,
  /\bwebSecurity\s*:\s*false\b/,
  /\ballowRunningInsecureContent\s*:\s*true\b/,
  /\bwebviewTag\s*:\s*true\b/,
  /\bexperimentalFeatures\s*:\s*true\b/
]

function weakeningsIn(source: string): string[] {
  return WEAKENING.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source)
}

function exposedNames(source: string): string[] {
  return [...source.matchAll(/exposeInMainWorld\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
}

function allowedPermissions(source: string): string[] | null {
  const match = source.match(/ALLOWED_PERMISSIONS[^=]*=\s*new Set\(\s*\[([^\]]*)\]\s*\)/)
  if (!match) return null
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

describe('RN-SEC-29: a janela é endurecida', () => {
  const main = code(MAIN_INDEX)
  const preload = code(PRELOAD_INDEX)

  it('a janela declara sandbox, isolamento de contexto e Node desligado', () => {
    expect(main).toMatch(/\bsandbox\s*:\s*true\b/)
    expect(main).toMatch(/\bcontextIsolation\s*:\s*true\b/)
    expect(main).toMatch(/\bnodeIntegration\s*:\s*false\b/)
  })

  it('nenhum arquivo do main afrouxa uma opção de segurança da janela', () => {
    const offenders = sourceFiles(join(ROOT, 'src/main'))
      .map((file) => ({ file: relative(ROOT, file), found: weakeningsIn(code(file)) }))
      .filter(({ found }) => found.length > 0)
    expect(offenders).toEqual([])
  })

  it('o preload entrega à janela só o objeto api', () => {
    expect(exposedNames(preload)).toEqual(['api'])
    expect(preload).not.toMatch(/@electron-toolkit\/preload/)
    expect(preload).not.toMatch(/\bwindow\s*\.\s*\w+\s*=/)
  })

  it('permissões: só a escrita na área de transferência, no pedido e na consulta', () => {
    expect(allowedPermissions(main)).toEqual(['clipboard-sanitized-write'])
    expect(main).toMatch(/setPermissionRequestHandler\s*\(/)
    expect(main).toMatch(/setPermissionCheckHandler\s*\(/)
  })

  it('os detectores reconhecem as formas usuais', () => {
    expect(weakeningsIn('webPreferences: { sandbox: false }')).toHaveLength(1)
    expect(weakeningsIn('nodeIntegrationInWorker: true')).toHaveLength(1)
    expect(weakeningsIn('sandbox: true, contextIsolation: true')).toEqual([])
    expect(exposedNames("contextBridge.exposeInMainWorld('electron', x)")).toEqual(['electron'])
    expect(allowedPermissions("const ALLOWED_PERMISSIONS = new Set(['media'])")).toEqual(['media'])
    expect(stripComments('// sandbox: false\nconst a = 1')).not.toMatch(/sandbox/)
  })
})
