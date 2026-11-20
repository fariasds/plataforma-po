import { createPackage } from '@electron/asar'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditEntries } from '../../scripts/audit-package.mjs'

// RN-SEC-13: o pacote só leva o app. A lista do electron-builder.yml é por
// exclusão, e pasta nova entra no pacote sozinha; a auditoria é uma lista do que
// pode estar nele, e roda na esteira a cada PR e a cada versão.

const ROOT = resolve(__dirname, '../..')
const SCRIPT = join(ROOT, 'scripts/audit-package.mjs')

const APP = [
  'package.json',
  'LICENSE',
  'out/main/index.js',
  'out/renderer/index.html',
  'node_modules/antd/package.json'
]

let dirs: string[] = []

afterEach(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }))
  dirs = []
})

/** Monta um app.asar de verdade com estes arquivos e devolve a pasta resources/. */
async function packaged(files: string[], unpacked: string[] = []): Promise<string> {
  const base = mkdtempSync(join(tmpdir(), 'po-asar-'))
  dirs.push(base)
  const source = join(base, 'app')
  for (const file of files) {
    mkdirSync(dirname(join(source, file)), { recursive: true })
    writeFileSync(join(source, file), 'x')
  }
  const resources = join(base, 'resources')
  mkdirSync(resources)
  await createPackage(source, join(resources, 'app.asar'))
  for (const file of unpacked) {
    const path = join(resources, 'app.asar.unpacked', file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, 'x')
  }
  return resources
}

function audit(resources: string): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT, resources], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { code: 0, output }
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string }
    return { code: failure.status, output: `${failure.stdout}${failure.stderr}` }
  }
}

describe('RN-SEC-13 · conteúdo do pacote', () => {
  it('aceita o app: out/, package.json, dependências e resources/', () => {
    expect(auditEntries([...APP, 'resources/profile-template/AGENTS.md'])).toEqual([])
  })

  it.each([
    ['docs/regras-de-negocio/01-conceitos-globais.md'],
    ['src/main/index.ts'],
    ['tests/fixtures/azure/items.json'],
    ['scripts/scan-secrets.mjs'],
    ['CLAUDE.md'],
    ['.githooks/pre-commit'],
    ['pasta-nova/qualquer.txt']
  ])('recusa %s, fora do que o pacote pode ter', (path) => {
    expect(auditEntries([...APP, path]).map((v) => v.path)).toEqual([path])
  })

  it.each([
    ['node_modules/algum/.env'],
    ['out/pat.bin'],
    ['resources/perfis-privados/x.json'],
    ['node_modules/x/.claude/worktrees/a.ts'],
    ['resources/perfis.json']
  ])('recusa %s em qualquer lugar, mesmo dentro de pasta permitida', (path) => {
    expect(auditEntries([...APP, path]).length).toBeGreaterThan(0)
  })

  it('só resources/ pode sair do asar', () => {
    expect(auditEntries(APP, ['resources/icon.png'])).toEqual([])
    expect(auditEntries(APP, ['out/main/index.js'])).toHaveLength(1)
  })

  it('o script lê um app.asar real e sai com 0 quando o pacote é só o app', async () => {
    const result = audit(await packaged(APP, ['resources/icon.png']))
    expect(result.code).toBe(0)
    expect(result.output).toContain('nada indevido')
  })

  it('o script sai com 1 e diz o caminho quando há pasta indevida', async () => {
    const result = audit(
      await packaged([...APP, 'docs/interno.md', 'perfis-privados/cliente.json'])
    )
    expect(result.code).toBe(1)
    expect(result.output).toContain('docs/interno.md')
    expect(result.output).toContain('perfis-privados/cliente.json')
  })
})
