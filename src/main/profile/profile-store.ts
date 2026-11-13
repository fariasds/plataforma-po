import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { AppError } from '@shared/errors'
import { SCRUM_PRESET } from '@shared/config/presets'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import type { ProfileKind } from '@shared/ipc'
import { DEMO_SCENARIO_ID, demoScenario } from '../demo/demo-profile'
import agentsTemplate from '../../../resources/profile-template/AGENTS.md?raw'
import schemaTemplate from '../../../resources/profile-template/configuracao.schema.json?raw'
import { writeFileAtomic } from './atomic-write'
import {
  AGENTS_FILE,
  PROFILE_ID_PATTERN,
  SCHEMA_FILE,
  configPath,
  profileDir,
  profilesIndexPath,
  workDataDir
} from './paths'

/**
 * Lista de Perfis e qual está ativo (`perfis.json`). O modelo já nasce como
 * lista (ADR 0002), mas a v1 só mostra e usa o ativo.
 */

export interface ProfileEntry {
  id: string
  name: string
  /**
   * Só o Perfil de demonstração grava o tipo (RN-GLB-15); sem ele, é um Perfil
   * com Azure de verdade, como todos os que existiam antes.
   */
  kind?: 'demo'
  /** O Cenário que alimenta a demonstração. */
  scenario?: string
}

interface ProfileIndex {
  active: string | null
  profiles: ProfileEntry[]
}

export interface ActiveProfile {
  id: string
  name: string
  dir: string
  kind: ProfileKind
  /** O Cenário da demonstração; `null` num Perfil com Azure de verdade. */
  scenario: string | null
}

export interface CreateProfileInput {
  name: string
  organization: string
}

const MAX_NAME_LENGTH = 80

function isEntry(value: unknown): value is ProfileEntry {
  const entry = value as ProfileEntry
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.id === 'string' &&
    PROFILE_ID_PATTERN.test(entry.id) &&
    typeof entry.name === 'string' &&
    (entry.kind === undefined || (entry.kind === 'demo' && typeof entry.scenario === 'string'))
  )
}

/**
 * Arquivo ausente é "nenhum Perfil ainda". Arquivo ilegível **não** é: tratar
 * como vazio levaria a criar um Perfil novo por cima e esconder o existente.
 */
function readIndex(): ProfileIndex {
  const file = profilesIndexPath()
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { active: null, profiles: [] }
    throw error
  }

  try {
    const parsed = JSON.parse(text) as ProfileIndex
    const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : null
    const active = parsed.active
    if (profiles && profiles.every(isEntry) && (active === null || typeof active === 'string')) {
      return { active, profiles }
    }
  } catch {
    // cai no erro abaixo
  }
  throw new AppError(
    'PROFILE_CORRUPT',
    `A lista de Perfis em ${file} está corrompida. Corrija ou apague o arquivo; as pastas dos Perfis não foram tocadas.`
  )
}

function writeIndex(index: ProfileIndex): void {
  writeFileAtomic(profilesIndexPath(), JSON.stringify(index, null, 2) + '\n')
}

export function listProfiles(): ProfileEntry[] {
  return readIndex().profiles
}

function toActive(entry: ProfileEntry): ActiveProfile {
  return {
    id: entry.id,
    name: entry.name,
    dir: profileDir(entry.id),
    kind: entry.kind === 'demo' ? 'demo' : 'azure',
    scenario: entry.kind === 'demo' ? (entry.scenario ?? null) : null
  }
}

/**
 * Lido do disco a cada chamada, de propósito: é a resposta que o `client.ts` usa
 * para decidir entre o Azure e o Azure fictício (RN-SEC-27), e uma cópia em
 * memória poderia atravessar uma troca de Perfil.
 */
export function getActiveProfile(): ActiveProfile | null {
  const index = readIndex()
  const entry = index.profiles.find((profile) => profile.id === index.active)
  return entry ? toActive(entry) : null
}

/** O Perfil com esse ID é o de demonstração? ID desconhecido não é. */
export function isDemoProfile(profileId: string): boolean {
  return readIndex().profiles.some((p) => p.id === profileId && p.kind === 'demo')
}

export function requireActiveProfile(): ActiveProfile {
  const profile = getActiveProfile()
  if (!profile) throw new AppError('PROFILE_MISSING', 'Nenhum Perfil configurado neste computador.')
  return profile
}

/**
 * Configuração inicial: a organização, o preset Scrum e nenhum Produto. Os
 * valores de calendário e capacidade são pontos de partida neutros; o PO ajusta
 * na tela ou no arquivo.
 */
export function initialConfiguration(organization: string): Record<string, unknown> {
  return {
    $schema: `./${SCHEMA_FILE}`,
    version: 1,
    organization,
    processProfiles: { scrum: SCRUM_PRESET },
    products: [],
    groups: [],
    calendar: {
      country: 'BR',
      extraHolidays: [],
      workingHours: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      productiveHoursPerDay: 6
    },
    storyPoints: { '1': 2, '2': 4, '3': 8, '5': 16, '8': 32, '13': 56 },
    capacityDefaults: {
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
  } satisfies Partial<Record<keyof Configuration, unknown>>
}

/** "Time Loja — Açaí" → "time-loja-acai". Nunca vazio. */
function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')
  return slug || 'perfil'
}

function uniqueId(name: string, taken: ProfileEntry[]): string {
  const base = slugify(name)
  const used = (id: string): boolean => taken.some((p) => p.id === id) || existsSync(profileDir(id))
  if (!used(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = base.slice(0, 40 - suffix.length).replace(/-+$/, '') + suffix
    if (!used(candidate)) return candidate
  }
}

/**
 * Cria a pasta do Perfil a partir do template, grava a Configuração inicial e
 * torna o novo Perfil o ativo. O PAT não passa por aqui: vai para
 * `segredos/`, fora desta pasta (RN-CFG-06).
 */
export function createProfile(input: CreateProfileInput): ActiveProfile {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const organization = typeof input.organization === 'string' ? input.organization.trim() : ''
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new AppError(
      'PROFILE_INVALID',
      `Dê um nome ao Perfil, com até ${MAX_NAME_LENGTH} caracteres.`
    )
  }

  // Valida antes de criar qualquer pasta: uma organização recusada não deixa
  // Perfil pela metade no disco.
  const config = initialConfiguration(organization)
  const result = validateConfiguration(config)
  if (!result.ok) {
    throw new AppError('PROFILE_INVALID', result.issues.map((issue) => issue.message).join(' '))
  }

  const index = readIndex()
  const id = uniqueId(name, index.profiles)

  mkdirSync(workDataDir(id), { recursive: true })
  writeFileAtomic(join(profileDir(id), SCHEMA_FILE), schemaTemplate)
  writeFileAtomic(join(profileDir(id), AGENTS_FILE), agentsTemplate)
  writeFileAtomic(configPath(id), JSON.stringify(config, null, 2) + '\n')

  writeIndex({ active: id, profiles: [...index.profiles, { id, name }] })
  return toActive({ id, name })
}

// ─── Perfil de demonstração (RN-GLB-15) ──────────────────────────────────────

const DEMO_NAME = 'Demonstração'

/**
 * A pasta da demonstração é a de qualquer Perfil: template, Configuração e
 * Dados de trabalho. A Configuração vem do Cenário; o PO pode editá-la, e vale a
 * última versão válida (RN-CFG-07). Nenhum arquivo nasce em `segredos/`.
 */
function writeDemoFiles(id: string, scenarioId: string): void {
  const scenario = demoScenario(scenarioId)
  mkdirSync(workDataDir(id), { recursive: true })
  writeFileAtomic(join(profileDir(id), SCHEMA_FILE), schemaTemplate)
  writeFileAtomic(join(profileDir(id), AGENTS_FILE), agentsTemplate)
  const config = { $schema: `./${SCHEMA_FILE}`, ...scenario.config }
  writeFileAtomic(configPath(id), JSON.stringify(config, null, 2) + '\n')
}

/**
 * "Explorar com dados de exemplo": torna ativa a demonstração, criando-a na
 * primeira vez. Existe no máximo uma; criar um Perfil real depois não a apaga.
 */
export function startDemoProfile(): ActiveProfile {
  const index = readIndex()
  const existing = index.profiles.find((profile) => profile.kind === 'demo')
  if (existing) {
    if (!existsSync(configPath(existing.id))) {
      writeDemoFiles(existing.id, existing.scenario ?? DEMO_SCENARIO_ID)
    }
    writeIndex({ ...index, active: existing.id })
    return toActive(existing)
  }

  const entry: ProfileEntry = {
    id: uniqueId(DEMO_NAME, index.profiles),
    name: DEMO_NAME,
    kind: 'demo',
    scenario: DEMO_SCENARIO_ID
  }
  writeDemoFiles(entry.id, DEMO_SCENARIO_ID)
  writeIndex({ active: entry.id, profiles: [...index.profiles, entry] })
  return toActive(entry)
}

/**
 * Há um Perfil com Azure de verdade nesta máquina? A v1 tem no máximo um (ADR
 * 0002): com ele criado, a faixa da demonstração volta para ele em vez de
 * oferecer criar outro.
 */
export function hasAzureProfile(): boolean {
  return readIndex().profiles.some((profile) => profile.kind !== 'demo')
}

/**
 * Sai da demonstração para o Perfil com Azure de verdade. Havendo mais de um
 * (de antes desta regra), vale o último criado.
 */
export function leaveDemoProfile(): ActiveProfile {
  const index = readIndex()
  const real = index.profiles.filter((profile) => profile.kind !== 'demo').at(-1)
  if (!real) {
    throw new AppError(
      'PROFILE_MISSING',
      'Ainda não há um Perfil com o seu Azure. Crie um pela faixa da demonstração.'
    )
  }
  writeIndex({ ...index, active: real.id })
  return toActive(real)
}

/** Apaga os Dados de trabalho da demonstração ativa e regrava a Configuração do Cenário. */
export function restoreDemoProfile(): ActiveProfile {
  const profile = requireActiveProfile()
  if (profile.kind !== 'demo' || !profile.scenario) {
    throw new AppError('PROFILE_INVALID', 'Só o Perfil de demonstração pode ser restaurado.')
  }
  rmSync(workDataDir(profile.id), { recursive: true, force: true })
  writeDemoFiles(profile.id, profile.scenario)
  return profile
}
