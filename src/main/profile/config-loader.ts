import { watch, readFileSync, type FSWatcher } from 'fs'
import { AppError } from '@shared/errors'
import type { Configuration } from '@shared/config/schema'
import {
  removedIds,
  validateConfiguration,
  type ConfigurationIssue,
  type ConfigurationResult
} from '@shared/config/validate'
import type { ImportConfigResult, ProfileState } from '@shared/ipc'
import { hasPat } from '../security/pat-store'
import { writeFileAtomic } from './atomic-write'
import { CONFIG_FILE, configPath } from './paths'
import { getActiveProfile, hasAzureProfile, requireActiveProfile } from './profile-store'

/**
 * Carrega a Configuração do Perfil ativo, observa o arquivo e publica o estado.
 *
 * RN-CFG-07: um arquivo inválido **não derruba** o que está em uso. O app segue
 * com a última versão válida e publica os erros, para a tela e a IA do PO
 * corrigirem. Só quando nunca houve versão válida o estado vira `invalid-config`.
 */

const DEBOUNCE_MS = 300
const MAX_CONFIG_BYTES = 1024 * 1024

interface Loaded {
  profileId: string
  lastValid: Configuration | null
  errors: ConfigurationIssue[]
}

let loaded: Loaded | null = null
let state: ProfileState | null = null
let watcher: FSWatcher | null = null
let watchedDir: string | null = null
let pending: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(state: ProfileState) => void>()

/**
 * A mensagem do `JSON.parse` do V8 cita um trecho do texto. Se o PO colou um
 * token no arquivo e quebrou o JSON, esse trecho iria para a tela e o log —
 * o mesmo vazamento que a RN-CFG-05 fecha. Fica só a posição.
 */
function syntaxIssue(error: unknown): ConfigurationIssue {
  const message = error instanceof Error ? error.message : ''
  const line = /line (\d+) column (\d+)/.exec(message)
  const position = /position (\d+)/.exec(message)
  const where = line
    ? ` (linha ${line[1]}, coluna ${line[2]})`
    : position
      ? ` (caractere ${position[1]})`
      : ''
  return { path: '', message: `O arquivo não é um JSON válido${where}.` }
}

function parseAndValidate(text: string): ConfigurationResult {
  if (Buffer.byteLength(text, 'utf8') > MAX_CONFIG_BYTES) {
    return { ok: false, issues: [{ path: '', message: 'A Configuração passa de 1 MB.' }] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    return { ok: false, issues: [syntaxIssue(error)] }
  }
  return validateConfiguration(raw)
}

function readConfiguration(profileId: string): ConfigurationResult {
  let text: string
  try {
    text = readFileSync(configPath(profileId), 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    const message =
      code === 'ENOENT'
        ? `O arquivo ${CONFIG_FILE} não existe na pasta do Perfil.`
        : `Não consegui ler ${CONFIG_FILE} (${code}).`
    return { ok: false, issues: [{ path: '', message }] }
  }
  return parseAndValidate(text)
}

function publish(next: ProfileState): ProfileState {
  const changed = JSON.stringify(next) !== JSON.stringify(state)
  state = next
  if (changed) {
    for (const listener of listeners) listener(next)
  }
  return next
}

function stopWatching(): void {
  if (pending) clearTimeout(pending)
  pending = null
  watcher?.close()
  watcher = null
  watchedDir = null
}

/**
 * Observa a **pasta**, não o arquivo: editores e a própria gravação atômica
 * salvam num temporário e renomeiam, e um observador preso ao arquivo antigo
 * deixaria de ouvir depois da primeira troca.
 */
function watchDir(dir: string): void {
  if (watchedDir === dir) return
  stopWatching()
  try {
    watcher = watch(dir, (_event, filename) => {
      if (filename && filename !== CONFIG_FILE) return
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = null
        try {
          reloadProfileState()
        } catch (error) {
          console.error('[config] falha ao recarregar a Configuração:', error)
        }
      }, DEBOUNCE_MS)
    })
    watcher.on('error', (error) => {
      console.error('[config] o observador da Configuração parou:', error)
      stopWatching()
    })
    watchedDir = dir
  } catch (error) {
    // Sem observador o app funciona; só deixa de perceber edições feitas fora dele.
    console.error(`[config] não consegui observar ${dir}:`, error)
  }
}

/** Relê tudo do disco, publica se mudou e devolve o estado. */
export function reloadProfileState(): ProfileState {
  const profile = getActiveProfile()
  if (!profile) {
    loaded = null
    stopWatching()
    return publish({
      status: 'no-profile',
      profile: null,
      config: null,
      errors: [],
      hasAzureProfile: false
    })
  }

  const result = readConfiguration(profile.id)
  const previous = loaded?.profileId === profile.id ? loaded.lastValid : null
  loaded = {
    profileId: profile.id,
    lastValid: result.ok ? result.config : previous,
    errors: result.ok ? [] : result.issues
  }
  if (!result.ok) {
    console.warn(
      `[config] Configuração inválida (${result.issues.length} problema(s))` +
        (previous ? '; seguindo com a última versão válida.' : '.')
    )
  }
  watchDir(profile.dir)

  // A demonstração não tem PAT e não pede um (RN-SEC-27).
  const needsPat = profile.kind !== 'demo' && !hasPat(profile.id)
  const status = needsPat ? 'needs-pat' : loaded.lastValid ? 'ready' : 'invalid-config'
  return publish({
    status,
    profile: { id: profile.id, name: profile.name, dir: profile.dir, kind: profile.kind },
    config: loaded.lastValid,
    errors: loaded.errors,
    hasAzureProfile: hasAzureProfile()
  })
}

export function getProfileState(): ProfileState {
  return state ?? reloadProfileState()
}

/** Configuração em uso pelos serviços do main: a última válida, ou `null`. */
export function getActiveConfig(): Configuration | null {
  getProfileState()
  return loaded?.lastValid ?? null
}

export function onProfileStateChanged(listener: (state: ProfileState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Substitui a Configuração do Perfil ativo por um JSON colado. Valida **antes**
 * de gravar: um arquivo recusado não chega ao disco, e a resposta traz os erros.
 */
export function importConfiguration(json: string): ImportConfigResult {
  const profile = requireActiveProfile()
  if (typeof json !== 'string') {
    throw new AppError('PROFILE_INVALID', 'A Configuração precisa chegar como texto JSON.')
  }
  const result = parseAndValidate(json)
  if (!result.ok) return { saved: false, issues: result.issues }

  const previous = getActiveConfig()
  const removed = previous ? removedIds(previous, result.config) : { products: [], groups: [] }

  const raw = JSON.parse(json.replace(/^\uFEFF/, ''))
  writeFileAtomic(configPath(profile.id), JSON.stringify(raw, null, 2) + '\n')
  reloadProfileState()
  return { saved: true, removed }
}

/** Para testes: esquece o estado e para o observador. */
export function resetConfigLoader(): void {
  stopWatching()
  loaded = null
  state = null
  listeners.clear()
}
