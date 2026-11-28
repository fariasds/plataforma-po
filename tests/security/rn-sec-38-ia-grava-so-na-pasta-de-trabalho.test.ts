import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join, relative, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateConfiguration } from '@shared/config/validate'
import { fluxoDoPo } from '../../src/main/demo/scenarios/fluxo-do-po'

// RN-SEC-38: a IA do PO grava só dentro da pasta de trabalho do Produto que ela
// nomeia, nas pastas do processo e em arquivo de texto (ADR 0013). Quem escolheu a
// pasta foi o PO, pelo diálogo do sistema (RN-SEC-36). Dados fictícios: o Cenário
// `fluxo-do-po`, numa cópia temporária da pasta de trabalho dele.

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

const mock = await import('../helpers/electron-mock')
const store = await import('../../src/main/profile/profile-store')
const paths = await import('../../src/main/profile/paths')
const folders = await import('../../src/main/profile/work-folders')

let profileId = ''
let loja = ''
let app = ''
let outside = ''
/** A pasta-mãe da pasta da Loja: o que escapar por ".." cai aqui, e em nenhum outro lugar. */
let parent = ''

/** Todo arquivo sob uma pasta, com o conteúdo. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) walk(full)
      else files[relative(dir, full).replace(/\\/g, '/')] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return files
}

async function write(
  produto: string,
  caminho: unknown
): Promise<{ isError?: boolean; text: string }> {
  const { buildServerSpec } = await import('../../src/main/mcp')
  const { handleMessage } = await import('../../src/main/mcp/protocol')
  const response = handleMessage(buildServerSpec(profileId, '0.0.0'), {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'gravar_arquivo', arguments: { produto, caminho, conteudo: '# texto\n' } }
  }) as { result: { isError?: boolean; content: { text: string }[] } }
  return { isError: response.result.isError, text: response.result.content[0].text }
}

beforeEach(() => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  writeFileSync(paths.configPath(profileId), JSON.stringify(fluxoDoPo.config))
  parent = mkdtempSync(join(tmpdir(), 'rn-sec-38-'))
  loja = join(parent, 'loja')
  cpSync(resolve(__dirname, '../regression/pastas/fluxo-do-po/loja'), loja, { recursive: true })
  app = mkdtempSync(join(tmpdir(), 'pasta-app-'))
  outside = mkdtempSync(join(tmpdir(), 'fora-'))
  folders.setWorkFolder(profileId, 'loja', loja)
  folders.setWorkFolder(profileId, 'app', app)
})

describe('RN-SEC-38: a IA grava só dentro da pasta de trabalho', () => {
  it('grava arquivo de texto nas pastas do processo, e só ali', async () => {
    const userData = snapshot(mock.getUserDataDir())
    const result = await write('loja', 'features/pagamento-pix/discovery/apoio/reuniao.md')
    expect(result.isError).toBeUndefined()
    expect(
      readFileSync(join(loja, 'features/pagamento-pix/discovery/apoio/reuniao.md'), 'utf8')
    ).toBe('# texto\n')
    // A pasta do Perfil, com Configuração, Dados de trabalho e o resto, não muda.
    expect(snapshot(mock.getUserDataDir())).toEqual(userData)
  })

  it.each([
    ['caminho absoluto', () => join(outside, 'x.md')],
    ['caminho com unidade', () => 'C:features/x.md'],
    ['".." que sai da pasta', () => '../fora.md'],
    ['".." no meio', () => 'features/../../fora.md'],
    ['arquivo do app, com ponto', () => 'catalogo/.absorcao.json'],
    ['pasta fora das do processo', () => 'outros/x.md'],
    ['a raiz da pasta', () => 'roadmap.json'],
    ['extensão que não é de texto', () => 'features/pagamento-pix/script.ps1'],
    ['caminho que não é texto', () => ({ caminho: 'features/x.md' })]
  ])('recusa %s, sem gravar nada', async (_case, caminho) => {
    const before = snapshot(loja)
    const result = await write('loja', caminho())
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/Nada foi gravado|caminho/)
    expect(snapshot(loja)).toEqual(before)
    expect(readdirSync(outside)).toEqual([])
    expect(readdirSync(parent)).toEqual(['loja'])
  })

  it('recusa caminho que passa por um link para fora da pasta', async (context) => {
    try {
      // Junção não exige administrador no Windows; em outro sistema é um link comum.
      symlinkSync(outside, join(loja, 'features', 'atalho'), 'junction')
    } catch {
      context.skip()
    }
    const result = await write('loja', 'features/atalho/x.md')
    expect(result.isError).toBe(true)
    expect(readdirSync(outside)).toEqual([])
  })

  it('a pasta de um Produto não alcança a de outro, que ele só consulta', async () => {
    // O App consulta o catálogo da Loja (RN-CAT-05): gravar pelo App cai na pasta do App.
    const result = await write('app', 'catalogo/Pagamentos.md')
    expect(result.isError).toBeUndefined()
    expect(existsSync(join(app, 'catalogo', 'Pagamentos.md'))).toBe(true)
    expect(readFileSync(join(loja, 'catalogo', 'Pagamentos.md'), 'utf8')).not.toBe('# texto\n')
    // E duas pastas não se sobrepõem: a do App não pode ficar dentro da da Loja.
    const nested = join(loja, 'features')
    mkdirSync(nested, { recursive: true })
    expect(() => folders.setWorkFolder(profileId, 'app', nested)).toThrow(/outro Produto/)
  })
})
