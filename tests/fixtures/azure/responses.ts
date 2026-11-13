import { readFileSync } from 'fs'
import { join } from 'path'

/** Lê uma resposta fictícia desta pasta como `Response` de sucesso. */
export function fixtureResponse(name: 'projects' | 'wiql'): Response {
  const body = readFileSync(join(__dirname, `${name}.json`), 'utf8')
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
}

/**
 * Pior caso de servidor: erro 500 que devolve o cabeçalho `Authorization` no
 * status e no corpo. É o que um proxy mal configurado faz — e o que obriga a
 * redação a funcionar, porque o status entra na mensagem do erro.
 */
export function echoAuthorizationError(init?: RequestInit): Response {
  const headers = new Headers(init?.headers)
  const auth = headers.get('authorization') ?? ''
  return new Response(JSON.stringify({ message: `echo ${auth}` }), {
    status: 500,
    statusText: `Authorization: ${auth}`
  })
}
