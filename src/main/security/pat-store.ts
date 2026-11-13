import { existsSync, readFileSync, statSync, unlinkSync } from 'fs'
// A API síncrona do safeStorage está descontinuada desde o Electron 45 e sai no 46:
// antes de subir para o 46, migrar para `encryptStringAsync`/`decryptStringAsync`.
// O cifrado de hoje continua legível pela API assíncrona, então não há perda de PAT.
import { safeStorage } from 'electron'
import { AppError } from '@shared/errors'
import { writeFileAtomic } from '../profile/atomic-write'
import { secretPath } from '../profile/paths'
import { getActiveProfile, isDemoProfile, requireActiveProfile } from '../profile/profile-store'

/**
 * Per-person read-only PAT, encrypted at rest by the OS (DPAPI on Windows).
 *
 * Golden rule: the PAT never reaches any other server. It lives on this
 * machine and only leaves it over HTTPS to Azure DevOps.
 *
 * Um arquivo por Perfil, em `segredos/<perfilId>.bin` — **fora** da pasta do
 * Perfil (RN-CFG-06). A pasta do Perfil é a que o app abre para o PO e para a
 * IA dele; o segredo não pode estar ao alcance de quem lê aquela pasta.
 *
 * Sem `profileId`, vale o Perfil ativo.
 */
function patFilePath(profileId?: string): string | null {
  const id = profileId ?? getActiveProfile()?.id
  return id ? secretPath(id) : null
}

/** Sem `profileId`, vale o Perfil ativo. */
function isDemo(profileId?: string): boolean {
  return profileId === undefined ? getActiveProfile()?.kind === 'demo' : isDemoProfile(profileId)
}

/**
 * RN-SEC-27: o Perfil de demonstração não tem PAT e não aceita um. Exposto à
 * parte para o handler recusar **antes** de testar o token no Azure: com a
 * demonstração ativa, nem a checagem sai da máquina.
 */
export function assertPatAllowed(profileId?: string): void {
  if (isDemo(profileId)) {
    throw new AppError(
      'PROFILE_INVALID',
      'O Perfil de demonstração não usa token. Para ver os seus dados, crie um Perfil com o seu Azure.'
    )
  }
}

/**
 * Há token guardado nesta máquina?
 *
 * Deliberadamente **não** usa `existsSync`: ele devolve `false` tanto para
 * "não existe" quanto para "não consegui acessar" — e as duas respostas levavam
 * à mesma tela, pedindo um token que já estava guardado. Só `ENOENT` é ausência;
 * qualquer outro erro é problema de acesso e precisa aparecer como erro.
 */
export function hasPat(profileId?: string): boolean {
  if (isDemo(profileId)) return false
  const file = patFilePath(profileId)
  if (!file) return false
  try {
    statSync(file)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      console.warn(`[pat] nenhum token em ${file}`)
      return false
    }

    console.error(`[pat] o token existe mas o acesso falhou (${code}) em ${file}:`, error)
    throw new AppError(
      'PAT_UNREADABLE',
      `O arquivo do token existe em ${file}, mas o sistema recusou o acesso (${code}). ` +
        'Antivírus ou permissão de pasta costumam ser a causa. O token não foi apagado.'
    )
  }
}

/** Reads and decrypts the stored PAT. Main process only. */
export function loadPat(profileId?: string): string | null {
  try {
    const file = patFilePath(profileId)
    if (!file || !existsSync(file)) return null
    return safeStorage.decryptString(readFileSync(file))
  } catch {
    return null
  }
}

/** Same as `loadPat`, but fails loudly — for code paths that cannot proceed without it. */
export function requirePat(): string {
  // O caminho de demonstração nunca chega aqui; se chegar, é defeito no desvio.
  assertPatAllowed()
  const pat = loadPat()
  if (!pat) {
    throw new AppError('PAT_MISSING', 'Nenhum token configurado neste computador.')
  }
  return pat
}

/**
 * RN-SEC-09: sem cifragem do sistema operacional, o token não é guardado — nem
 * em texto puro, nem "provisoriamente". Exposto à parte para quem precisa
 * recusar **antes** de criar qualquer outra coisa (o Perfil, por exemplo).
 */
export function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new AppError(
      'ENCRYPTION_UNAVAILABLE',
      'A criptografia do sistema operacional está indisponível, então o token não pode ser guardado com segurança.'
    )
  }
}

export function savePat(pat: string, profileId?: string): void {
  assertEncryptionAvailable()
  const id = profileId ?? requireActiveProfile().id
  assertPatAllowed(id)
  writeFileAtomic(secretPath(id), safeStorage.encryptString(pat))
}

export function clearPat(profileId?: string): void {
  try {
    const file = patFilePath(profileId)
    if (file && existsSync(file)) unlinkSync(file)
  } catch {
    // Nothing to do — a missing file is the desired end state anyway.
  }
}
