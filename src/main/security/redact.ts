import { format } from 'util'

/**
 * RN-SEC-19: o PAT não aparece em log nem em erro.
 *
 * Duas redes. A primeira conhece o token: o `client.ts` registra cada PAT que usa,
 * junto das formas codificadas que viajam no cabeçalho. A segunda não conhece
 * nada e pega pela forma — é o que protege um token que ainda não passou pelo
 * cliente, ou um de outro serviço.
 */

export const REDACTED = '[REDACTED]'

/**
 * As formas de `SECRET_VALUE_PATTERNS` (`@shared/config/secrets`) e do hook de
 * pre-commit, reescritas com lookaround para a troca preservar as bordas.
 */
const SECRET_SHAPES: readonly RegExp[] = [
  /(?<![A-Za-z0-9])[a-z2-7]{52}(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9])[A-Za-z0-9]{76}AZDO[A-Za-z0-9]{4}(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{60,}/g
]

/** Credencial no formato de cabeçalho: o valor sai, o rótulo fica para o log fazer sentido. */
const HEADER_SHAPES: ReadonlyArray<[RegExp, string]> = [
  [/(Authorization["']?\s*[:=]\s*["']?)(?:(?:Basic|Bearer)\s+)?[^\s"',}]+/gi, `$1${REDACTED}`],
  [/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._~-]{20,}/g, `$1 ${REDACTED}`]
]

/** Poucos PATs passam por uma sessão; o teto só evita crescer sem fim. */
const MAX_KNOWN_SECRETS = 16
const knownSecrets = new Set<string>()

function encodedForms(secret: string): string[] {
  return [
    secret,
    Buffer.from(`:${secret}`).toString('base64'),
    Buffer.from(secret).toString('base64')
  ]
}

/** Registra um segredo para `redact` apagá-lo, cru ou em base64, onde aparecer. */
export function rememberSecret(secret: string): void {
  if (!secret) return
  for (const form of encodedForms(secret)) {
    knownSecrets.delete(form)
    knownSecrets.add(form)
  }
  while (knownSecrets.size > MAX_KNOWN_SECRETS * 3) {
    knownSecrets.delete(knownSecrets.values().next().value as string)
  }
}

export function redact(text: string, secrets: readonly string[] = []): string {
  let result = text
  const literal = [...secrets.flatMap(encodedForms), ...knownSecrets]
    .filter((s) => s.length >= 4)
    // O mais longo primeiro: o base64 do PAT pode conter o PAT como trecho.
    .sort((a, b) => b.length - a.length)
  for (const secret of literal) result = result.split(secret).join(REDACTED)
  for (const [pattern, replacement] of HEADER_SHAPES) result = result.replace(pattern, replacement)
  for (const pattern of SECRET_SHAPES) result = result.replace(pattern, REDACTED)
  return result
}

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const
let consoleInstalled = false

/**
 * Faz todo `console.*` do main passar por `redact`. Os argumentos são formatados
 * antes (erro, pilha e `cause` inclusos), porque o segredo pode estar dentro de um
 * objeto, e não só em texto.
 */
export function installConsoleRedaction(): void {
  if (consoleInstalled) return
  consoleInstalled = true
  for (const method of CONSOLE_METHODS) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]): void => original(redact(format(...args)))
  }
}
