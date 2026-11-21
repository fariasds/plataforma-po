import { watch, readFileSync, type FSWatcher } from 'fs'
import { AppError } from '@shared/errors'
import type { Configuration } from '@shared/config/schema'
import {
  IMPORT_MODES,
  parseConfigurationText,
  planImport,
  removedFromDiff,
  type ImportMode
} from '@shared/config/import'
import type { ConfigurationIssue, ConfigurationResult } from '@shared/config/validate'
import type { ImportConfigResult, ImportPreview, ProfileState } from '@shared/ipc'
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
  return parseConfigurationText(text)
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

/** O modo chega da janela: fora dos dois conhecidos, é recusado. */
function importMode(mode: unknown): ImportMode {
  if (mode === undefined) return 'replace'
  if (IMPORT_MODES.includes(mode as ImportMode)) return mode as ImportMode
  throw new AppError('PROFILE_INVALID', 'Modo de importação desconhecido.')
}

/**
 * Prévia da importação (RN-CFG-09): valida e mostra o que muda, sem gravar.
 */
export function previewImport(json: string, mode: ImportMode = 'replace'): ImportPreview {
  requireActiveProfile()
  const plan = planImport(getActiveConfig(), json, importMode(mode))
  return plan.ok
    ? { ok: true, kind: plan.kind, diff: plan.diff }
    : { ok: false, issues: plan.issues }
}

/**
 * Substitui a Configuração do Perfil ativo pelo JSON que chegou. Passa pelo mesmo
 * plano da prévia: um arquivo recusado não chega ao disco, e a resposta traz os
 * erros.
 */
export function importConfiguration(
  json: string,
  mode: ImportMode = 'replace'
): ImportConfigResult {
  const profile = requireActiveProfile()
  if (typeof json !== 'string') {
    throw new AppError('PROFILE_INVALID', 'A Configuração precisa chegar como texto JSON.')
  }
  const plan = planImport(getActiveConfig(), json, importMode(mode))
  if (!plan.ok) return { saved: false, issues: plan.issues }

  writeFileAtomic(configPath(profile.id), JSON.stringify(plan.content, null, 2) + '\n')
  reloadProfileState()
  return { saved: true, removed: removedFromDiff(plan.diff), diff: plan.diff }
}

/** Para testes: esquece o estado e para o observador. */
export function resetConfigLoader(): void {
  stopWatching()
  loaded = null
  state = null
  listeners.clear()
}
