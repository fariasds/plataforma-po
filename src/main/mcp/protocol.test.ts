import { PassThrough } from 'stream'
import { describe, expect, it } from 'vitest'
import { launchMode } from './launch'
import { PROTOCOL_VERSIONS, RPC_ERRORS, handleMessage, type McpServerSpec } from './protocol'
import { serveStdio } from './server'

const spec: McpServerSpec = {
  name: 'plataforma-po',
  title: 'Plataforma do PO',
  version: '0.0.0',
  instructions: 'teste',
  tools: [
    {
      name: 'eco',
      title: 'Eco',
      description: 'Devolve o texto.',
      inputSchema: { type: 'object' },
      readOnly: true,
      call: (args) => ({ content: [{ type: 'text', text: String(args.texto) }] })
    },
    {
      name: 'quebra',
      title: 'Quebra',
      description: 'Sempre falha.',
      inputSchema: { type: 'object' },
      readOnly: true,
      call: () => {
        throw new Error('falhou de propósito')
      }
    }
  ],
  prompts: [],
  resources: []
}

/** `id` nulo monta uma notificação, que não tem `id`. */
const rpc = (method: string, params?: unknown, id: number | null = 1): unknown => ({
  jsonrpc: '2.0',
  ...(id === null ? {} : { id }),
  method,
  ...(params === undefined ? {} : { params })
})

describe('protocolo MCP (ADR 0010)', () => {
  it('initialize devolve a versão pedida quando é conhecida', () => {
    const response = handleMessage(spec, rpc('initialize', { protocolVersion: '2025-03-26' }))
    expect(response?.result).toMatchObject({
      protocolVersion: '2025-03-26',
      serverInfo: { name: 'plataforma-po' }
    })
  })

  it('initialize com versão desconhecida responde a mais nova que o servidor fala', () => {
    const response = handleMessage(spec, rpc('initialize', { protocolVersion: '1999-01-01' }))
    expect(response?.result).toMatchObject({ protocolVersion: PROTOCOL_VERSIONS[0] })
  })

  it('notificação não tem resposta', () => {
    expect(handleMessage(spec, rpc('notifications/initialized', undefined, null))).toBeNull()
  })

  it('lista as ferramentas e chama uma delas', () => {
    const list = handleMessage(spec, rpc('tools/list'))
    expect(list?.result).toMatchObject({ tools: [{ name: 'eco' }, { name: 'quebra' }] })
    const call = handleMessage(spec, rpc('tools/call', { name: 'eco', arguments: { texto: 'oi' } }))
    expect(call?.result).toEqual({ content: [{ type: 'text', text: 'oi' }] })
  })

  it('ferramenta que falha vira resultado com isError, para o modelo ler', () => {
    const call = handleMessage(spec, rpc('tools/call', { name: 'quebra' }))
    expect(call?.result).toMatchObject({
      isError: true,
      content: [{ text: 'falhou de propósito' }]
    })
  })

  it('ferramenta desconhecida e argumento que não é objeto são erro de parâmetro', () => {
    expect(handleMessage(spec, rpc('tools/call', { name: 'nada' }))?.error?.code).toBe(
      RPC_ERRORS.invalidParams
    )
    expect(
      handleMessage(spec, rpc('tools/call', { name: 'eco', arguments: [1] }))?.error?.code
    ).toBe(RPC_ERRORS.invalidParams)
  })

  it('método desconhecido e mensagem inválida', () => {
    expect(handleMessage(spec, rpc('sampling/createMessage'))?.error?.code).toBe(
      RPC_ERRORS.methodNotFound
    )
    expect(handleMessage(spec, { method: 'ping' })?.error?.code).toBe(RPC_ERRORS.invalidRequest)
    expect(handleMessage(spec, [rpc('ping')])?.error?.code).toBe(RPC_ERRORS.invalidRequest)
  })
})

describe('stdio', () => {
  it('uma mensagem por linha, e JSON quebrado não repete o texto recebido', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const done = serveStdio(spec, input, output)
    input.write(JSON.stringify(rpc('ping')) + '\n')
    input.write('{"segredo": quebrado\n')
    input.end()
    await done

    const lines = output.read().toString().trim().split('\n')
    expect(JSON.parse(lines[0])).toEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect(JSON.parse(lines[1]).error.code).toBe(RPC_ERRORS.parse)
    expect(lines[1]).not.toContain('segredo')
  })
})

describe('launchMode', () => {
  it('sem --mcp é a janela de sempre', () => {
    expect(launchMode(['app.exe'])).toEqual({ mode: 'window' })
  })

  it('aceita --perfil separado ou com igual', () => {
    expect(launchMode(['app.exe', '--mcp', '--perfil', 'contoso'])).toEqual({
      mode: 'mcp',
      profileId: 'contoso'
    })
    expect(launchMode(['app.exe', '--perfil=contoso', '--mcp'])).toEqual({
      mode: 'mcp',
      profileId: 'contoso'
    })
  })

  it('sem Perfil é erro com o que fazer', () => {
    expect(launchMode(['app.exe', '--mcp']).mode).toBe('mcp-error')
    expect(launchMode(['app.exe', '--mcp', '--perfil', '--outro']).mode).toBe('mcp-error')
  })
})
