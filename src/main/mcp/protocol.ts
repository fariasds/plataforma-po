/**
 * O protocolo MCP que o servidor fala, escrito aqui em vez de vir do SDK
 * oficial (ADR 0010): por stdio, são poucas mensagens JSON-RPC, e o SDK traria
 * servidor HTTP e as dependências dele para dentro do instalador.
 *
 * Este arquivo é lógica pura: recebe uma mensagem já lida e devolve a resposta.
 * Quem lê e escreve no stdio é o `server.ts`.
 */

/** Versões do protocolo que este servidor entende, da mais nova para a mais antiga. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

export interface TextContent {
  type: 'text'
  text: string
}

export interface ToolResult {
  content: TextContent[]
  isError?: boolean
}

export interface McpTool {
  name: string
  title: string
  description: string
  /** JSON Schema dos argumentos, como o cliente de IA mostra ao modelo. */
  inputSchema: Record<string, unknown>
  /** Só leitura? O cliente pode pedir menos confirmação para quem só lê. */
  readOnly: boolean
  call(args: Record<string, unknown>): ToolResult
}

export interface PromptMessage {
  role: 'user' | 'assistant'
  content: TextContent
}

export interface McpPrompt {
  name: string
  title: string
  description: string
  /** Os argumentos que o cliente de IA pede ao PO antes de usar o prompt. */
  arguments?: Array<{ name: string; description: string; required: boolean }>
  get(args: Record<string, string>): { description: string; messages: PromptMessage[] }
}

export interface McpResource {
  uri: string
  name: string
  title: string
  description: string
  mimeType: string
  read(): string
}

export interface McpServerSpec {
  name: string
  title: string
  version: string
  /** Texto que o cliente entrega ao modelo ao conectar. */
  instructions: string
  tools: McpTool[]
  prompts: McpPrompt[]
  resources: McpResource[]
}

type Id = string | number | null

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: Id
  result?: unknown
  error?: { code: number; message: string }
}

/** Códigos do JSON-RPC 2.0. */
export const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
} as const

function ok(id: Id, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function fail(id: Id, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Erro de ferramenta vira resultado com `isError`, para o modelo ler e corrigir. */
export function toolError(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function negotiateVersion(params: Record<string, unknown>): string {
  const asked = params.protocolVersion
  return PROTOCOL_VERSIONS.find((version) => version === asked) ?? PROTOCOL_VERSIONS[0]
}

function callTool(spec: McpServerSpec, id: Id, params: Record<string, unknown>): JsonRpcResponse {
  const tool = spec.tools.find((candidate) => candidate.name === params.name)
  if (!tool)
    return fail(id, RPC_ERRORS.invalidParams, `Ferramenta desconhecida: ${String(params.name)}`)
  const args = params.arguments === undefined ? {} : params.arguments
  if (!isRecord(args))
    return fail(id, RPC_ERRORS.invalidParams, 'Os argumentos precisam ser um objeto.')
  try {
    return ok(id, tool.call(args))
  } catch (error) {
    // A mensagem é do nosso código; a pilha não sai, para não expor caminhos da máquina.
    const message = error instanceof Error ? error.message : 'Falha inesperada.'
    return ok(id, toolError(message))
  }
}

/**
 * Responde a uma mensagem JSON-RPC. Notificação (sem `id`) não tem resposta, e
 * devolve `null`.
 */
export function handleMessage(spec: McpServerSpec, message: unknown): JsonRpcResponse | null {
  if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    const id =
      isRecord(message) && (typeof message.id === 'string' || typeof message.id === 'number')
    return fail(
      id ? (message.id as Id) : null,
      RPC_ERRORS.invalidRequest,
      'Mensagem JSON-RPC inválida.'
    )
  }
  const isNotification = !('id' in message)
  if (isNotification) return null

  const id = message.id as Id
  const params = isRecord(message.params) ? message.params : {}

  switch (message.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: negotiateVersion(params),
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: false },
          resources: { listChanged: false, subscribe: false }
        },
        serverInfo: { name: spec.name, title: spec.title, version: spec.version },
        instructions: spec.instructions
      })
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, {
        tools: spec.tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { title: tool.title, readOnlyHint: tool.readOnly, openWorldHint: false }
        }))
      })
    case 'tools/call':
      return callTool(spec, id, params)
    case 'prompts/list':
      return ok(id, {
        prompts: spec.prompts.map(({ name, title, description, arguments: args }) => ({
          name,
          title,
          description,
          ...(args ? { arguments: args } : {})
        }))
      })
    case 'prompts/get': {
      const prompt = spec.prompts.find((candidate) => candidate.name === params.name)
      if (!prompt)
        return fail(id, RPC_ERRORS.invalidParams, `Prompt desconhecido: ${String(params.name)}`)
      // Só texto: o argumento vira linha do pedido, nunca código.
      const raw = isRecord(params.arguments) ? params.arguments : {}
      const args = Object.fromEntries(
        Object.entries(raw).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      )
      return ok(id, prompt.get(args))
    }
    case 'resources/list':
      return ok(id, {
        resources: spec.resources.map(({ uri, name, title, description, mimeType }) => ({
          uri,
          name,
          title,
          description,
          mimeType
        }))
      })
    case 'resources/read': {
      const resource = spec.resources.find((candidate) => candidate.uri === params.uri)
      if (!resource)
        return fail(id, RPC_ERRORS.invalidParams, `Recurso desconhecido: ${String(params.uri)}`)
      return ok(id, {
        contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }]
      })
    }
    default:
      return fail(id, RPC_ERRORS.methodNotFound, `Método não suportado: ${message.method}`)
  }
}
