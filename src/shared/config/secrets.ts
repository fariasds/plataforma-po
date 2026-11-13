/**
 * RN-CFG-05: nada com forma de segredo entra na Configuração.
 *
 * O arquivo existe para ser lido pela IA do PO e compartilhado entre pessoas; um
 * PAT colado ali vazaria pelos dois caminhos. A varredura roda sobre o JSON cru,
 * antes da forma, para pegar o segredo mesmo quando o resto do arquivo está
 * errado — e mesmo em chave que o schema rejeitaria por outro motivo.
 */

/**
 * As mesmas formas que o hook `.githooks/pre-commit` barra, mais o PAT do
 * formato novo do Azure (84 caracteres com a assinatura `AZDO`) e o cabeçalho
 * `Basic`, que é como o PAT viaja codificado. As bordas evitam casar dentro de
 * palavras maiores.
 */
export const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /(^|[^A-Za-z0-9])[a-z2-7]{52}([^A-Za-z0-9]|$)/,
  /(^|[^A-Za-z0-9])[A-Za-z0-9]{76}AZDO[A-Za-z0-9]{4}([^A-Za-z0-9]|$)/,
  /(^|[^A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36}([^A-Za-z0-9]|$)/,
  /(^|[^A-Za-z0-9])github_pat_[A-Za-z0-9_]{60,}([^A-Za-z0-9]|$)/,
  /Basic\s+[A-Za-z0-9+/=]{20,}/
]

/**
 * `pat`, `token`, `password`, `secret` — sozinhas, depois de separador
 * (`azure_pat`) ou como palavra final em camelCase (`accessToken`). O camelCase
 * exige a maiúscula para `compat` e `format` não caírem aqui.
 */
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /^(pat|token|password|secret)$/i,
  /[_-](pat|token|password|secret)$/i,
  /[a-z0-9](Pat|PAT|Token|Password|Secret)$/
]

export interface SecretIssue {
  path: (string | number)[]
  message: string
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export function looksLikeSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Percorre qualquer valor JSON e aponta cada chave ou valor suspeito. A
 * mensagem **nunca repete o valor**: o erro vai para tela e log, e repetir o
 * segredo ali seria vazá-lo por outro caminho.
 */
export function findSecrets(value: unknown, path: (string | number)[] = []): SecretIssue[] {
  if (typeof value === 'string') {
    return looksLikeSecret(value)
      ? [
          {
            path,
            message:
              'Este valor tem forma de token ou senha. O PAT nunca entra na Configuração: ele é informado na tela do app e guardado cifrado, fora desta pasta.'
          }
        ]
      : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findSecrets(item, [...path, i]))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      const here = [...path, key]
      const keyIssues: SecretIssue[] = isSecretKey(key)
        ? [
            {
              path: here,
              message: `A chave "${key}" não é permitida: a Configuração não guarda PAT, token, senha nem segredo.`
            }
          ]
        : []
      return [...keyIssues, ...findSecrets(item, here)]
    })
  }
  return []
}
