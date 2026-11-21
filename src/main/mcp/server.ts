import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { Readable, Writable } from 'stream'
import { RPC_ERRORS, handleMessage, type JsonRpcResponse, type McpServerSpec } from './protocol'

/**
 * Teto de uma linha: uma proposta de Configuração tem até 1 MB (RN-CFG-07), e o
 * JSON escapado dentro da mensagem pode crescer. Acima disso a linha é descartada.
 */
export const MAX_LINE_BYTES = 4 * 1024 * 1024

/**
 * No stdio do MCP, a saída padrão é só do protocolo: um `console.log` perdido
 * quebraria a conversa com o cliente. Todo log vai para a saída de erro, que o
 * cliente de IA mostra como log do servidor.
 */
export function routeLogsToStderr(): void {
  const toStderr = (...args: unknown[]): void => console.error(...args)
  console.log = toStderr
  console.info = toStderr
  console.debug = toStderr
}

/**
 * A entrada padrão, lida pelo descritor. No processo principal do Electron no
 * Windows, `process.stdin` chega vazio mesmo com o pipe aberto; o descritor 0
 * lido pelo `fs` recebe o que o cliente de IA escreve (prova no ADR 0010).
 */
export function stdinStream(): Readable {
  return createReadStream('', { fd: 0 })
}

/**
 * Serve o MCP por stdio: uma mensagem JSON por linha, nos dois sentidos. Resolve
 * quando a entrada fecha, isto é, quando o cliente de IA encerra a conexão.
 */
export function serveStdio(
  spec: McpServerSpec,
  input: Readable = stdinStream(),
  output: Writable = process.stdout
): Promise<void> {
  const send = (response: JsonRpcResponse): void => {
    output.write(JSON.stringify(response) + '\n')
  }

  const lines = createInterface({ input, crlfDelay: Infinity })
  lines.on('line', (line) => {
    if (!line.trim()) return
    if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: RPC_ERRORS.invalidRequest, message: 'Mensagem grande demais.' }
      })
      return
    }
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      // Como na Configuração (RN-CFG-05), o erro não repete o texto recebido.
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: RPC_ERRORS.parse, message: 'A mensagem não é um JSON válido.' }
      })
      return
    }
    const response = handleMessage(spec, message)
    if (response) send(response)
  })

  return new Promise((resolve) => lines.on('close', () => resolve()))
}
