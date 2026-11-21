import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mcpEntries, reachableFrom, withoutComments } from '../helpers/import-graph'
import { getUserDataDir, resetElectronMock } from '../helpers/electron-mock'

// RN-SEC-35: o servidor MCP grava só a proposta, na pasta do Perfil dele (ADR
// 0010). A IA do PO pode chamar qualquer ferramenta a qualquer hora; o que ela
// consegue mudar no disco é `proposta.json`, e quem aplica é o PO, na janela
// (RN-CFG-12).

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const ROOT = resolve(__dirname, '../..')

/** Toda API do `fs` que cria, muda ou apaga arquivo ou pasta. */
const FS_WRITE =
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|rename|renameSync|mkdir|mkdirSync|copyFile|copyFileSync|cp|cpSync|createWriteStream|truncate|truncateSync|symlink|symlinkSync|chmod|chmodSync)\s*\(/

/** A gravação atômica é a única porta de escrita que o servidor alcança. */
const ATOMIC_WRITE = 'src/main/profile/atomic-write.ts'

describe('RN-SEC-35: o servidor MCP grava só a proposta (estático)', () => {
  const reachable = reachableFrom(mcpEntries()).filter((file) => /\.tsx?$/.test(file))

  it('nenhum arquivo alcançado escreve no disco, fora a gravação atômica', () => {
    const offenders = reachable
      .filter((file) => file !== ATOMIC_WRITE)
      .filter((file) => FS_WRITE.test(withoutComments(readFileSync(join(ROOT, file), 'utf8'))))
    expect(offenders).toEqual([])
  })

  it('no servidor, toda gravação atômica vai para proposalPath', () => {
    const calls = reachable
      .filter((file) => file.startsWith('src/main/mcp/'))
      .flatMap((file) =>
        [
          ...withoutComments(readFileSync(join(ROOT, file), 'utf8')).matchAll(
            /writeFileAtomic\(([^,]*),/g
          )
        ].map((match) => ({ file, target: match[1].trim() }))
      )
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.filter((call) => !/^proposalPath\(/.test(call.target))).toEqual([])
  })

  it('o detector reconhece as formas usuais', () => {
    expect(FS_WRITE.test("writeFileSync(configPath(id), '{}')")).toBe(true)
    expect(FS_WRITE.test('rmSync(dir, { recursive: true })')).toBe(true)
    expect(FS_WRITE.test("createWriteStream('x')")).toBe(true)
    expect(FS_WRITE.test('readFileSync(file)')).toBe(false)
  })
})

/** Todos os arquivos sob a pasta de dados, com o conteúdo, para comparar antes e depois. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else files[relative(dir, full).replace(/\\/g, '/')] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return files
}

describe('RN-SEC-35: o servidor MCP grava só a proposta (comportamento)', () => {
  const example = readFileSync(resolve(ROOT, 'examples/exemplo-scrum.json'), 'utf8')

  beforeEach(() => {
    resetElectronMock()
    for (const id of ['contoso', 'outro']) {
      mkdirSync(join(getUserDataDir(), 'perfis', id, 'dados'), { recursive: true })
      writeFileSync(join(getUserDataDir(), 'perfis', id, 'configuracao.json'), example)
    }
    writeFileSync(join(getUserDataDir(), 'perfis.json'), '{"active":"contoso","profiles":[]}')
  })

  async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { buildServerSpec } = await import('../../src/main/mcp')
    const { handleMessage } = await import('../../src/main/mcp/protocol')
    const spec = buildServerSpec('contoso', '0.0.0')
    return handleMessage(spec, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args }
    })
  }

  it('ler e validar não mudam nenhum arquivo', async () => {
    const before = snapshot(getUserDataDir())
    await call('ler_configuracao')
    await call('validar', { configuracao: JSON.parse(example) })
    expect(snapshot(getUserDataDir())).toEqual(before)
  })

  it('propor muda só a proposta, na pasta do Perfil preso ao servidor', async () => {
    const before = snapshot(getUserDataDir())
    const proposed = JSON.parse(example)
    proposed.products[0].name = 'Loja Nova'

    await call('propor_configuracao', { configuracao: proposed })

    const after = snapshot(getUserDataDir())
    const changed = Object.keys(after).filter((file) => after[file] !== before[file])
    expect(changed).toEqual(['perfis/contoso/proposta.json'])
    expect(Object.keys(before).filter((file) => !(file in after))).toEqual([])
  })

  it('proposta recusada não grava nada', async () => {
    const before = snapshot(getUserDataDir())
    await call('propor_configuracao', {
      configuracao: { ...JSON.parse(example), organization: 'https://x.example' }
    })
    expect(snapshot(getUserDataDir())).toEqual(before)
  })
})
