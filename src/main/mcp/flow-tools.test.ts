import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flowKeys } from '@shared/flow-snapshot'

// As ferramentas e os prompts do fluxo do PO no servidor MCP (RN-FLX-02, RN-FLX-17,
// RN-FLX-26, RN-CAT-05). Dados fictícios: o Cenário `fluxo-do-po`.

vi.mock('electron', async () => (await import('../../../tests/helpers/electron-mock')).electronMock)

const mock = await import('../../../tests/helpers/electron-mock')
const { fluxoDoPo } = await import('../demo/scenarios/fluxo-do-po')
const store = await import('../profile/profile-store')
const paths = await import('../profile/paths')
const folders = await import('../profile/work-folders')
const workData = await import('../profile/work-data')
const { buildServerSpec } = await import('./index')
const { handleMessage } = await import('./protocol')

const TAKEN_AT = '2026-11-26T13:00:00.000Z'
let profileId = ''

function rpc(method: string, params: Record<string, unknown>): unknown {
  const response = handleMessage(buildServerSpec(profileId, '0.0.0'), {
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  }) as { result: unknown }
  return response.result
}

function tool(name: string, args: Record<string, unknown>): { isError?: boolean; text: string } {
  const result = rpc('tools/call', { name, arguments: args }) as {
    isError?: boolean
    content: { text: string }[]
  }
  return { isError: result.isError, text: result.content[0].text }
}

beforeEach(() => {
  mock.resetElectronMock()
  profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  writeFileSync(paths.configPath(profileId), JSON.stringify(fluxoDoPo.config))
  const loja = mkdtempSync(join(tmpdir(), 'pasta-loja-'))
  cpSync(resolve(__dirname, '../../../tests/regression/pastas/fluxo-do-po/loja'), loja, {
    recursive: true
  })
  folders.setWorkFolder(profileId, 'loja', loja)
  folders.setWorkFolder(profileId, 'app', mkdtempSync(join(tmpdir(), 'pasta-app-')))
  workData.writeWorkData(profileId, flowKeys.snapshot('loja'), {
    version: 1,
    productId: 'loja',
    takenAt: TAKEN_AT,
    windowStart: '2026-05-30',
    priorityField: null,
    features: [],
    children: [],
    feedbacks: null,
    bugs: []
  })
})

describe('as ferramentas de leitura', () => {
  it('listar_features traz a data do retrato e a Fase de cada Feature (RN-FLX-02)', () => {
    const { text } = tool('listar_features', { produto: 'loja' })
    expect(text).toContain(`Retrato do Azure tirado em ${TAKEN_AT}`)
    expect(text).toContain('"fase": "Discovery"')
    expect(text).toContain('"pasta": "pagamento-pix"')
  })

  it('validar_feature devolve o que a tela mostra, pelo mesmo código (RN-FLX-17)', () => {
    const result = JSON.parse(tool('validar_feature', { produto: 'loja', feature: '#4102' }).text)
    expect(result.fase).toBe('Discovery')
    expect(result.pendencias.map((p: { code: string }) => p.code)).toContain('decision-proposed')
  })

  it('ler_feature traz o texto dos artefatos', () => {
    const { text } = tool('ler_feature', { produto: 'loja', feature: 'pagamento-pix' })
    expect(text).toContain('--- features/pagamento-pix/discovery/decisoes.md')
    expect(text).toContain('### D2 · O QR expira em 30 minutos')
  })

  it('sem retrato, diz ao PO o que fazer', () => {
    const result = tool('ler_retrato', { produto: 'app' })
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/abrir a tela Features/)
  })

  it('buscar_regra acha pelo ID e pelo texto, inclusive no catálogo consultado (RN-CAT-05)', () => {
    const byId = JSON.parse(tool('buscar_regra', { produto: 'loja', termo: 'RN-PAG-012' }).text)
    expect(byId[0]).toMatchObject({ id: 'RN-PAG-012', consultado: false, pagina: 'Pagamentos.md' })
    expect(byId[0].texto).toContain('**Descrição:**')
    const consulted = JSON.parse(tool('buscar_regra', { produto: 'app', termo: 'cupom' }).text)
    expect(consulted).toEqual([
      expect.objectContaining({ id: 'RN-CUP-004', produto: 'loja', consultado: true })
    ])
  })

  it('Feature que não existe e Produto que não existe são erro legível', () => {
    expect(tool('ler_feature', { produto: 'loja', feature: '9999' }).text).toMatch(/Não achei/)
    expect(tool('listar_features', { produto: 'outro' }).isError).toBe(true)
  })
})

describe('os prompts do processo (ADR 0014, RN-FLX-26)', () => {
  function prompt(name: string, args: Record<string, string> = {}): string {
    const result = rpc('prompts/get', { name, arguments: args }) as {
      messages: { content: { text: string } }[]
    }
    return result.messages[0].content.text
  }

  it('o de fábrica, com o pedido do PO no fim', () => {
    const text = prompt('discovery', { produto: 'loja', feature: '4102' })
    expect(text).toContain('# Discovery de uma Feature')
    expect(text).toContain('## O pedido')
    expect(text).toContain('- feature: 4102')
  })

  it('o do PO, quando ele trocou o texto', () => {
    const file = paths.instructionPath(profileId, 'discovery')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '# Meu Discovery\n')
    expect(prompt('discovery')).toBe('# Meu Discovery\n')
  })

  it('a IA propõe; a instrução em uso não muda até o PO aplicar', () => {
    const result = tool('propor_instrucao', { instrucao: 'quebra', texto: '# Quebra nova\n' })
    expect(result.isError).toBeUndefined()
    expect(readFileSync(paths.instructionProposalPath(profileId, 'quebra'), 'utf8')).toBe(
      '# Quebra nova\n'
    )
    expect(existsSync(paths.instructionPath(profileId, 'quebra'))).toBe(false)
    expect(prompt('quebra')).toContain('# Quebra de uma Feature')
  })

  it('instrução desconhecida é recusada', () => {
    expect(tool('propor_instrucao', { instrucao: '../configuracao', texto: 'x' }).isError).toBe(
      true
    )
  })
})
