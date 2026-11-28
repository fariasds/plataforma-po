import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUserDataDir, resetElectronMock } from '../../../tests/helpers/electron-mock'

vi.mock('electron', async () => (await import('../../../tests/helpers/electron-mock')).electronMock)

const { buildServerSpec } = await import('.')
const { handleMessage } = await import('./protocol')

const example = readFileSync(resolve('examples/exemplo-scrum.json'), 'utf8')

function profileDir(): string {
  return join(getUserDataDir(), 'perfis', 'contoso')
}

function rpc(method: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  const response = handleMessage(buildServerSpec('contoso', '0.0.0'), {
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  })
  return (response?.result ?? response?.error) as Record<string, unknown>
}

function toolText(
  name: string,
  args: Record<string, unknown> = {}
): { text: string; isError: boolean } {
  const result = rpc('tools/call', { name, arguments: args }) as {
    content: { text: string }[]
    isError?: boolean
  }
  return { text: result.content[0].text, isError: result.isError === true }
}

beforeEach(() => {
  resetElectronMock()
  mkdirSync(profileDir(), { recursive: true })
  writeFileSync(join(profileDir(), 'configuracao.json'), example)
})

describe('ferramentas do servidor MCP', () => {
  it('Perfil que não existe não sobe o servidor', () => {
    expect(() => buildServerSpec('nao-existe', '0.0.0')).toThrow('não existe nesta máquina')
    expect(() => buildServerSpec('../fora', '0.0.0')).toThrow()
  })

  it('ler_configuracao devolve o arquivo e diz se é válido', () => {
    const { text, isError } = toolText('ler_configuracao')
    expect(isError).toBe(false)
    expect(text).toContain('A Configuração em uso é válida.')
    expect(text).toContain('"organization": "contoso"')
  })

  it('validar diz o que mudaria, sem gravar', () => {
    const proposed = JSON.parse(example)
    proposed.products[0].name = 'Loja Nova'
    const { text, isError } = toolText('validar', { configuracao: proposed })
    expect(isError).toBe(false)
    expect(text).toContain('Muda: Produto "Loja Nova" (loja)')
  })

  it('validar devolve os erros com o caminho, para a IA corrigir', () => {
    const { text, isError } = toolText('validar', {
      configuracao: { ...JSON.parse(example), organization: 'fabrikam' }
    })
    expect(isError).toBe(true)
    expect(text).toContain('- organization:')
  })

  it('aceita a Configuração como texto JSON também', () => {
    expect(toolText('validar', { configuracao: example }).isError).toBe(false)
  })

  it('sem o argumento, explica o que mandar', () => {
    expect(toolText('propor_configuracao').text).toContain('"configuracao"')
  })

  it('propor grava a proposta que a janela lê (RN-CFG-12)', () => {
    const proposed = JSON.parse(example)
    proposed.products[0].name = 'Loja Nova'
    const { text } = toolText('propor_configuracao', { configuracao: proposed })
    expect(text).toContain('Proposta gravada.')
    const written = JSON.parse(readFileSync(join(profileDir(), 'proposta.json'), 'utf8'))
    expect(written.products[0].name).toBe('Loja Nova')
  })

  it('oferece o roteiro configurar_plataforma e os recursos de instrução e schema', () => {
    const names = (rpc('prompts/list') as { prompts: { name: string }[] }).prompts.map(
      (p) => p.name
    )
    expect(names).toEqual([
      'configurar_plataforma',
      'resumir_feedback',
      'encaixar_oportunidade',
      'discovery',
      'quebra',
      'analisar_bug',
      'reescrever_bug'
    ])
    const prompt = rpc('prompts/get', { name: 'configurar_plataforma' }) as {
      messages: { content: { text: string } }[]
    }
    expect(prompt.messages[0].content.text).toContain('Nunca peça, aceite nem escreva o token')

    const schema = rpc('resources/read', { uri: 'plataforma-po://configuracao/schema' }) as {
      contents: { text: string }[]
    }
    expect(() => JSON.parse(schema.contents[0].text)).not.toThrow()
    const agents = rpc('resources/read', { uri: 'plataforma-po://configuracao/instrucoes' }) as {
      contents: { text: string }[]
    }
    expect(agents.contents[0].text).toContain('proposta.json')
  })
})
