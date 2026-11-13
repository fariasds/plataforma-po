/**
 * Error codes crossing the IPC boundary.
 * The renderer switches on `code` to decide what to show — never on the message.
 */
export type AppErrorCode =
  | 'UNEXPECTED'
  /** No PAT stored yet — the app must ask for one. */
  | 'PAT_MISSING'
  /**
   * O arquivo do token está lá, mas o sistema recusou o acesso — antivírus,
   * permissão ou bloqueio momentâneo. **Não é ausência**, e tratar como se
   * fosse faria o app pedir um token que já existe.
   */
  | 'PAT_UNREADABLE'
  /** The OS refused to encrypt (safeStorage unavailable). */
  | 'ENCRYPTION_UNAVAILABLE'
  /** Azure rejected the credentials (401/403) — wrong, expired or under-scoped PAT. */
  | 'AZURE_UNAUTHORIZED'
  /** Could not reach Azure DevOps at all (offline, DNS, proxy). */
  | 'AZURE_UNREACHABLE'
  /** Azure answered, but with an error status. */
  | 'AZURE_REQUEST_FAILED'
  /**
   * A requisição nem saiu: host, organização ou método fora do permitido
   * (RN-SEC-18, RN-SEC-20). É defeito ou ataque, nunca uso normal.
   */
  | 'AZURE_BLOCKED'
  /** Nenhum Perfil ativo nesta máquina — o app precisa criar um. */
  | 'PROFILE_MISSING'
  /** ID de Perfil fora do formato, ou dado de entrada do Perfil recusado. */
  | 'PROFILE_INVALID'
  /** `perfis.json` existe mas não é legível; não é tratado como ausência. */
  | 'PROFILE_CORRUPT'
  /** Chave de Dados de trabalho fora do formato (RN-CFG-08). */
  | 'WORK_DATA_INVALID_KEY'
  /** Valor de Dados de trabalho acima do limite, ou que não vira JSON. */
  | 'WORK_DATA_INVALID_VALUE'
  /** O arquivo de Dados de trabalho existe mas não é JSON válido. */
  | 'WORK_DATA_CORRUPT'
  /** A seleção não é um Produto nem um Grupo da Configuração em uso. */
  | 'SELECTION_UNKNOWN'
  /** Pedido do objetivo da sprint fora do formato: nenhum ID, IDs demais ou inválidos. */
  | 'AI_INVALID_REQUEST'

export interface SerializedError {
  code: AppErrorCode
  message: string
}

/**
 * Error carrying a stable code across IPC.
 * Anything thrown inside a handler that is not an AppError becomes `UNEXPECTED`.
 */
export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

/**
 * Forma do erro que atravessa o IPC. A mensagem vai para a tela e para o log, e
 * pode carregar o que o Azure respondeu — por isso passa por `redact` (RN-SEC-19).
 * O redator é parâmetro obrigatório porque ele mora no main, que este módulo
 * compartilhado não pode importar.
 */
export function serializeError(error: unknown, redact: (text: string) => string): SerializedError {
  if (error instanceof AppError) {
    return { code: error.code, message: redact(error.message) }
  }
  return {
    code: 'UNEXPECTED',
    message: redact(error instanceof Error ? error.message : String(error))
  }
}
